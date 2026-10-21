"""/api/health has to answer while every worker thread is busy.

Render restarts the instance when its health check goes unanswered for five
seconds. On 2026-10-21 that happened three times in nine minutes, while one
person held the date arrow on Today: each day fired half a dozen requests, they
queued for the threadpool behind each other on 0.1 CPU, and the health check
queued with them. Render read a server that was working through a backlog as a
dead one and killed it, failing every request still in flight.

So the test holds the threadpool's only slot itself and asks for /api/health. A
sync endpoint waits for that slot and never answers; an async one runs on the
event loop and answers at once.
"""
import anyio
import httpx
import pytest
from anyio.to_thread import current_default_thread_limiter

from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_health_answers_while_the_threadpool_is_full():
    limiter = current_default_thread_limiter()
    original = limiter.total_tokens
    limiter.total_tokens = 1
    # On behalf of a stand-in, not this task: the request below runs in this
    # task too, and anyio refuses a second token to a borrower holding one.
    holder = object()
    await limiter.acquire_on_behalf_of(holder)
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            with anyio.fail_after(2):
                response = await client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
    finally:
        limiter.release_on_behalf_of(holder)
        limiter.total_tokens = original
