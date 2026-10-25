"""What each AI call records, and what each refused one leaves behind.

Migration 0027: ai_analyses rows carry the model that answered, the requests
the action sent and Google's token counts; ai_refusals counts the calls that
ended without an answer, by day, kind and cause, with no user_id.
"""
import json

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_engine
from app.models import AIAnalysis, AIRefusal
from app.routers import ai as ai_router
from app.services import meal_ai
from conftest import FAKE_REPORT, TEST_PASSWORD, utc_today
from tests.test_meal_ai import (
    FOOD,
    configure,
    configure_probe,
    configure_transcribe,
    post_voice_note,
)
from tests.test_review import configure_phrase, log_meal


@pytest.fixture(autouse=True)
def _clear_probe_cache():
    ai_router._probe_cache = None
    yield
    ai_router._probe_cache = None


def _refusals() -> list[tuple]:
    with Session(get_engine()) as db:
        return [
            (row.date, row.kind, row.cause, row.count, row.attempts)
            for row in db.scalars(select(AIRefusal).order_by(AIRefusal.id)).all()
        ]


def _row(analysis_id: int) -> AIAnalysis:
    with Session(get_engine()) as db:
        row = db.get(AIAnalysis, analysis_id)
        db.expunge(row)
        return row


def _failing(exc: Exception, attempts: int):
    exc.attempts = attempts

    async def fake(*_args, **_kwargs):
        raise exc

    return fake


# --- answered calls ------------------------------------------------------------


def test_an_answered_analysis_records_its_model_requests_and_tokens(client, monkeypatch):
    configure(monkeypatch)
    body = client.post("/api/ai/analyze", data={"text": "chicken"}).json()
    row = _row(body["analysis_id"])
    assert row.model == FAKE_REPORT.model
    assert row.attempts == 1
    assert (row.input_tokens, row.audio_input_tokens) == (1000, 0)
    assert (row.output_tokens, row.thinking_tokens) == (200, 300)
    assert row.attached_food_ids is None


def test_an_analysis_records_which_saved_foods_were_attached(client, monkeypatch):
    configure(monkeypatch)
    first = client.post("/api/foods", json=FOOD).json()["id"]
    second = client.post("/api/foods", json={**FOOD, "name": "Rice, cooked"}).json()["id"]
    body = client.post(
        "/api/ai/analyze",
        data={"text": "chicken and rice", "food_id": [str(second), str(first), str(second)]},
    ).json()
    # In the order sent, deduped -- exactly what was quoted into the prompt.
    assert json.loads(_row(body["analysis_id"]).attached_food_ids) == [second, first]


def test_a_transcription_records_its_report(client, monkeypatch):
    configure_transcribe(monkeypatch)
    assert post_voice_note(client).status_code == 200
    with Session(get_engine()) as db:
        row = db.scalars(select(AIAnalysis).where(AIAnalysis.kind == "transcription")).one()
        assert (row.model, row.attempts, row.input_tokens) == ("fake-model", 1, 1000)


def test_an_unusable_answer_keeps_its_row_and_its_cost(client, monkeypatch):
    error = meal_ai.MealAIBadResponse("no JSON")
    error.report = meal_ai.CallReport(model="gemini-b", attempts=2, input_tokens=900)

    async def fake(*_args, **_kwargs):
        raise error

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(meal_ai, "analyze_meal", fake)
    assert client.post("/api/ai/analyze", data={"text": "chicken"}).status_code == 502
    with Session(get_engine()) as db:
        row = db.scalars(select(AIAnalysis)).one()
        assert (row.model, row.attempts, row.input_tokens) == ("gemini-b", 2, 900)
    assert _refusals() == []


def test_a_probe_records_one_request(client, monkeypatch):
    configure_probe(monkeypatch)
    assert client.get("/api/ai/status?probe=true").json()["probe"]["status"] == "ok"
    with Session(get_engine()) as db:
        row = db.scalars(select(AIAnalysis).where(AIAnalysis.kind == "probe")).one()
        assert row.attempts == 1
        assert row.model == meal_ai.provider_info()["model"]


# --- refused calls -------------------------------------------------------------


def test_a_provider_failure_is_refunded_and_counted_with_its_requests(client, monkeypatch):
    configure(monkeypatch, _failing(meal_ai.MealAIUnavailable("503"), attempts=4))
    assert client.post("/api/ai/analyze", data={"text": "pizza"}).status_code == 503
    with Session(get_engine()) as db:
        assert db.scalars(select(AIAnalysis)).all() == []
    assert _refusals() == [(utc_today(), "analysis", "overloaded", 1, 4)]


@pytest.mark.parametrize(
    "exc, cause",
    [
        (meal_ai.MealAIDailyQuotaExhausted("day", ai_router._next_utc_midnight()), "daily_quota"),
        (meal_ai.MealAIRateLimited("minute"), "rate_limited"),
        (meal_ai.MealAIUnreachable("timeout"), "unreachable"),
        (meal_ai.MealAIModelNotFound("404"), "model_missing"),
        (meal_ai.MealAIBadRequest("400"), "misconfigured"),
        (meal_ai.MealAIInternalError("TypeError"), "internal_error"),
        (RuntimeError("our own bug"), "internal_error"),
    ],
)
def test_each_failure_is_counted_under_its_own_cause(client, monkeypatch, exc, cause):
    configure(monkeypatch, _failing(exc, attempts=1))
    client.post("/api/ai/analyze", data={"text": "pizza"})
    # A plain exception has no attempts attribute until _failing gives it one;
    # what matters here is the cause column.
    assert [(kind, c) for _d, kind, c, _n, _a in _refusals()] == [("analysis", cause)]


def test_refusals_of_one_kind_and_cause_add_up_in_one_row(client, monkeypatch):
    configure(monkeypatch, _failing(meal_ai.MealAIUnavailable("503"), attempts=2))
    client.post("/api/ai/analyze", data={"text": "pizza"})
    configure(monkeypatch, _failing(meal_ai.MealAIUnavailable("503"), attempts=3))
    client.post("/api/ai/analyze", data={"text": "pizza"})
    assert _refusals() == [(utc_today(), "analysis", "overloaded", 2, 5)]


def test_the_own_daily_limit_is_counted_and_sends_nothing(client, monkeypatch):
    monkeypatch.setenv("AI_DAILY_LIMIT", "1")
    configure(monkeypatch)
    assert client.post("/api/ai/analyze", data={"text": "pizza"}).status_code == 200
    assert client.post("/api/ai/analyze", data={"text": "pizza"}).status_code == 429
    assert _refusals() == [(utc_today(), "analysis", "user_limit", 1, 0)]


def test_the_app_wide_limit_is_counted_apart(client, monkeypatch):
    monkeypatch.setenv("AI_GLOBAL_DAILY_LIMIT", "1")
    configure(monkeypatch)
    configure_transcribe(monkeypatch)
    assert client.post("/api/ai/analyze", data={"text": "pizza"}).status_code == 200
    assert post_voice_note(client).status_code == 503
    assert _refusals() == [(utc_today(), "transcription", "app_limit", 1, 0)]


def test_a_failed_transcription_is_counted_as_one(client, monkeypatch):
    configure_transcribe(monkeypatch, _failing(meal_ai.MealAIUnavailable("503"), attempts=3))
    assert post_voice_note(client).status_code == 503
    assert _refusals() == [(utc_today(), "transcription", "overloaded", 1, 3)]


def test_a_failed_review_summary_is_counted_as_one(client, monkeypatch):
    log_meal(client, -1)
    configure_phrase(monkeypatch, _failing(meal_ai.MealAIUnavailable("503"), attempts=2))
    assert client.post("/api/review/summary").status_code == 503
    assert _refusals() == [(utc_today(), "review", "overloaded", 1, 2)]


def test_refusals_outlive_the_account_that_met_them(client, monkeypatch):
    """No user_id, so deleting the account leaves the history intact."""
    configure(monkeypatch, _failing(meal_ai.MealAIUnavailable("503"), attempts=1))
    client.post("/api/ai/analyze", data={"text": "pizza"})
    response = client.request(
        "DELETE", "/api/auth/account", json={"password": TEST_PASSWORD}
    )
    assert response.status_code == 204
    assert _refusals() == [(utc_today(), "analysis", "overloaded", 1, 1)]


# --- the export --------------------------------------------------------------


def test_the_export_carries_the_model_tokens_and_attached_foods(client, monkeypatch):
    configure(monkeypatch)
    food = client.post("/api/foods", json=FOOD).json()["id"]
    client.post("/api/ai/analyze", data={"text": "chicken", "food_id": str(food)})
    (row,) = client.get("/api/data/export/all").json()["ai_analyses"]
    assert row["model"] == "fake-model"
    assert row["attempts"] == 1
    assert (row["input_tokens"], row["output_tokens"], row["thinking_tokens"]) == (1000, 200, 300)
    assert row["attached_food_ids"] == [food]
