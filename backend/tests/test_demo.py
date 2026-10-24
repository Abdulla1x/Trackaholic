"""POST /api/demo and DELETE /api/demo (routers/demo.py), and the purge (app/demo.py)."""
from datetime import date, timedelta

import jwt
import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.deps import AI_NOT_IN_DEMO
from app.auth.security import get_jwt_secret
from app.db import get_engine
from app.demo import PURGE_BATCH
from app.demo_samples import SAMPLES
from app.models import AIAnalysis, DemoStart, Meal, User, utcnow
from app.rate_limit import limiter
from app.routers.ai import KIND_ANALYSIS, calls_today

from conftest import utc_today
from test_admin import make_admin


def start(client, body=None):
    response = client.post("/api/demo", json=body) if body is not None else client.post("/api/demo")
    assert response.status_code == 201, response.text
    return response.json()


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def session() -> Session:
    return Session(get_engine())


def backdate(user_id: int, hours: float) -> None:
    """Move an account's creation (and last visit) into the past."""
    with session() as db:
        user = db.get(User, user_id)
        user.created_at = utcnow() - timedelta(hours=hours)
        user.last_seen_at = utcnow() - timedelta(days=1)
        db.commit()


def exists(user_id: int) -> bool:
    with session() as db:
        return db.get(User, user_id) is not None


def meal_count(user_id: int) -> int:
    with session() as db:
        return db.scalar(select(func.count()).select_from(Meal).where(Meal.user_id == user_id))


# --- Starting a demo ---------------------------------------------------------


def test_start_signs_in_to_a_seeded_demo_account(anon_client):
    payload = start(anon_client)
    user = payload["user"]
    assert user["is_demo"] is True
    assert user["has_password"] is False
    assert user["email"].endswith("@demo.invalid")

    me = anon_client.get("/api/auth/me", headers=auth(payload["access_token"]))
    assert me.status_code == 200
    assert me.json()["is_demo"] is True
    assert meal_count(user["id"]) > 0


def test_every_visitor_gets_their_own_account(anon_client):
    first = start(anon_client)["user"]
    second = start(anon_client)["user"]
    assert first["id"] != second["id"]
    assert first["email"] != second["email"]


def test_a_real_account_is_not_a_demo(client):
    assert client.get("/api/auth/me").json()["is_demo"] is False


def test_token_lasts_a_day(anon_client):
    token = start(anon_client)["access_token"]
    claims = jwt.decode(token, get_jwt_secret(), algorithms=["HS256"])
    assert claims["exp"] - claims["iat"] == 24 * 3600


def test_seed_ends_on_the_visitors_date_within_a_day(anon_client):
    tomorrow = date.today() + timedelta(days=1)
    payload = start(anon_client, {"today": tomorrow.isoformat()})
    with session() as db:
        last = db.scalar(select(func.max(Meal.date)).where(Meal.user_id == payload["user"]["id"]))
    assert last == tomorrow


def test_an_implausible_date_falls_back_to_the_servers(anon_client):
    far = date.today() + timedelta(days=2)
    payload = start(anon_client, {"today": far.isoformat()})
    with session() as db:
        last = db.scalar(select(func.max(Meal.date)).where(Meal.user_id == payload["user"]["id"]))
    assert last == date.today()


def test_each_start_is_counted_for_the_utc_day(anon_client):
    start(anon_client)
    start(anon_client)
    with session() as db:
        assert db.scalar(select(DemoStart.count).where(DemoStart.date == utc_today())) == 2


def test_daily_cap_refuses_once_reached(anon_client, monkeypatch):
    monkeypatch.setenv("DEMO_DAILY_LIMIT", "1")
    start(anon_client)
    refused = anon_client.post("/api/demo")
    assert refused.status_code == 503
    assert "busy" in refused.json()["detail"]
    with session() as db:
        # A refused start creates nothing and counts nothing.
        assert db.scalar(select(func.count()).select_from(User).where(User.is_demo)) == 1
        assert db.scalar(select(DemoStart.count).where(DemoStart.date == utc_today())) == 1


def test_a_limit_of_zero_turns_the_demo_off(anon_client, monkeypatch):
    monkeypatch.setenv("DEMO_DAILY_LIMIT", "0")
    assert anon_client.post("/api/demo").status_code == 503


def test_per_client_rate_limit(anon_client):
    limiter.reset()
    limiter.enabled = True
    try:
        for _ in range(5):
            assert anon_client.post("/api/demo").status_code == 201
        assert anon_client.post("/api/demo").status_code == 429
    finally:
        limiter.enabled = False
        limiter.reset()


def test_starting_a_demo_moves_no_usage_number(client, anon_client, monkeypatch):
    make_admin(client, monkeypatch)
    before = client.get("/api/admin/stats").json()
    start(anon_client)
    after = client.get("/api/admin/stats").json()
    assert after["total_users"] == before["total_users"]
    assert after["total_meals"] == before["total_meals"]
    assert after["demos_started_30d"] == before["demos_started_30d"] + 1


# --- Isolation ---------------------------------------------------------------


def test_a_demo_cannot_read_another_account(client, anon_client):
    client.post("/api/meals", json={"date": date.today().isoformat(), "name": "Mine",
                                    "calories": 500, "protein": 30})
    demo = start(anon_client)
    meals = anon_client.get(f"/api/meals?date={date.today().isoformat()}",
                            headers=auth(demo["access_token"])).json()
    assert "Mine" not in {meal["name"] for meal in meals}


# --- Ending a demo -----------------------------------------------------------


def test_end_demo_deletes_the_account_and_its_data(anon_client):
    payload = start(anon_client)
    uid, headers = payload["user"]["id"], auth(payload["access_token"])
    assert anon_client.delete("/api/demo", headers=headers).status_code == 204
    assert not exists(uid)
    assert meal_count(uid) == 0
    assert anon_client.get("/api/auth/me", headers=headers).status_code == 401


def test_end_demo_refuses_a_real_account(client):
    assert client.delete("/api/demo").status_code == 403
    assert client.get("/api/auth/me").status_code == 200


def test_end_demo_needs_a_token(anon_client):
    assert anon_client.delete("/api/demo").status_code == 401


# --- The purge ---------------------------------------------------------------


def test_next_start_purges_a_demo_older_than_a_day(anon_client):
    old = start(anon_client)["user"]["id"]
    young = start(anon_client)["user"]["id"]
    backdate(old, hours=25)
    backdate(young, hours=23)
    start(anon_client)
    assert not exists(old)
    assert meal_count(old) == 0
    assert exists(young)


def test_purge_never_touches_a_real_account(client, anon_client):
    real = client.get("/api/auth/me").json()["id"]
    backdate(real, hours=24 * 400)
    start(anon_client)
    assert exists(real)


def test_purge_is_bounded_per_call(anon_client):
    with session() as db:
        old = utcnow() - timedelta(days=2)
        db.add_all(
            User(email=f"demo-old{i}@demo.invalid", is_demo=True, created_at=old)
            for i in range(PURGE_BATCH + 3)
        )
        db.commit()
    start(anon_client)
    with session() as db:
        left = db.scalar(select(func.count()).select_from(User).where(User.email.like("demo-old%")))
    assert left == 3


def test_daily_visit_hook_also_purges(client, anon_client):
    old = start(anon_client)["user"]["id"]
    backdate(old, hours=25)
    # The real account's first request of a UTC day runs the hook.
    backdate(client.get("/api/auth/me").json()["id"], hours=0)
    assert client.get("/api/settings").status_code == 200
    assert not exists(old)


def test_the_hook_spares_the_account_making_the_request(anon_client):
    payload = start(anon_client)
    uid = payload["user"]["id"]
    backdate(uid, hours=25)
    # Its own first visit of the day must not delete it from under itself.
    assert anon_client.get("/api/settings", headers=auth(payload["access_token"])).status_code == 200
    assert exists(uid)


def test_backdate_helper_moves_the_clock(anon_client):
    # Guards the helpers above: a backdate that silently did nothing would
    # make every purge test pass by never having an expired account.
    uid = start(anon_client)["user"]["id"]
    backdate(uid, hours=25)
    with session() as db:
        assert db.get(User, uid).created_at < utcnow() - timedelta(hours=24)


# --- What a demo account can't do --------------------------------------------

CSV = ("data.csv", b"date,name,calories,protein\n", "text/csv")

# (method, path, request kwargs). Each is refused for a demo before the handler
# runs, and reaches the handler as before for a real account.
BLOCKED = [
    ("POST", "/api/auth/change-password",
     {"json": {"current_password": "wrong-password", "new_password": "a-new-password-1"}}),
    ("DELETE", "/api/auth/account", {"json": {"password": "wrong-password"}}),
    ("POST", "/api/data/import", {"files": {"file": CSV}}),
    ("POST", "/api/data/import/steps", {"files": {"file": CSV}}),
    ("POST", "/api/ai/analyze", {"data": {"text": "an apple"}}),
    ("POST", "/api/ai/transcribe", {"files": {"audio": ("note.webm", b"x", "audio/webm")}}),
    ("POST", "/api/review/summary", {}),
]


def _never_called(*_args, **_kwargs):
    raise AssertionError("a demo account reached the AI provider")


def _ai_looks_configured(monkeypatch):
    from app.services import meal_ai

    monkeypatch.setattr(meal_ai, "is_configured", lambda: True)
    for name in ("analyze_meal", "transcribe_audio", "phrase_review", "probe"):
        monkeypatch.setattr(meal_ai, name, _never_called)


@pytest.mark.parametrize(("method", "path", "kwargs"), BLOCKED)
def test_a_demo_is_refused(anon_client, monkeypatch, method, path, kwargs):
    _ai_looks_configured(monkeypatch)
    headers = auth(start(anon_client)["access_token"])
    response = anon_client.request(method, path, headers=headers, **kwargs)
    assert response.status_code == 403, response.text
    assert "demo" in response.json()["detail"].lower()


@pytest.mark.parametrize(("method", "path", "kwargs"), BLOCKED)
def test_a_real_account_is_not_refused(client, method, path, kwargs):
    # Whatever the route answered before (a wrong password, an empty CSV, no
    # provider key, nothing logged): anything but the demo's 403.
    assert client.request(method, path, **kwargs).status_code != 403


def test_a_demo_spends_no_ai_quota(anon_client, monkeypatch):
    _ai_looks_configured(monkeypatch)
    headers = auth(start(anon_client)["access_token"])
    anon_client.post("/api/ai/analyze", headers=headers, data={"text": "an apple"})
    status = anon_client.get("/api/ai/status?probe=true", headers=headers)
    assert status.status_code == 200
    # The free form, without running or reserving a probe.
    assert status.json().get("probe") is None
    with session() as db:
        assert db.scalar(select(func.count()).select_from(AIAnalysis)) == 0


# --- The AI replay -------------------------------------------------------------


FIRST = next(iter(SAMPLES))


def _analyze_sample(client, headers, sample_id, **extra):
    return client.post(
        "/api/ai/analyze", headers=headers, data={"sample": sample_id, **extra}
    )


def test_a_demo_gets_the_saved_estimate_for_each_sample(anon_client, monkeypatch):
    _ai_looks_configured(monkeypatch)
    headers = auth(start(anon_client)["access_token"])
    for sample_id, sample in SAMPLES.items():
        response = _analyze_sample(anon_client, headers, sample_id)
        assert response.status_code == 200, response.text
        body = response.json()
        assert body.pop("analysis_id") is None
        assert body.pop("replayed") is True
        assert body == sample.analysis.model_dump()


def test_the_replay_needs_no_provider_key(anon_client, monkeypatch):
    # The demo must keep working on a server whose key was pulled.
    from app.services import meal_ai

    monkeypatch.setattr(meal_ai, "is_configured", lambda: False)
    headers = auth(start(anon_client)["access_token"])
    assert _analyze_sample(anon_client, headers, FIRST).status_code == 200


def test_a_replay_stores_nothing_and_spends_no_quota(anon_client, monkeypatch):
    _ai_looks_configured(monkeypatch)
    payload = start(anon_client)
    headers = auth(payload["access_token"])
    # A note and a "photo" alongside: still the replay. The bytes are not an
    # image, so reading them would have been refused.
    response = anon_client.post(
        "/api/ai/analyze", headers=headers,
        data={"sample": FIRST, "text": "ignored"},
        files={"image": ("plate.jpg", b"not an image", "image/jpeg")},
    )
    assert response.status_code == 200
    with session() as db:
        assert db.scalar(select(func.count()).select_from(AIAnalysis)) == 0
        assert calls_today(db) == 0
        assert calls_today(db, user_id=payload["user"]["id"], kind=KIND_ANALYSIS) == 0


@pytest.mark.parametrize("sample_id", ["dish_0", "", "../../etc/passwd"])
def test_an_unknown_sample_is_refused(anon_client, monkeypatch, sample_id):
    _ai_looks_configured(monkeypatch)
    headers = auth(start(anon_client)["access_token"])
    response = _analyze_sample(anon_client, headers, sample_id, text="an apple")
    assert response.status_code == 403
    assert response.json()["detail"] == AI_NOT_IN_DEMO


def test_a_real_account_sending_a_sample_gets_a_real_analysis(client, monkeypatch):
    from app.services import meal_ai

    calls = []

    async def fake_analyze(images, text, *_args, **_kwargs):
        calls.append(text)
        return SAMPLES[FIRST].analysis

    monkeypatch.setattr(meal_ai, "is_configured", lambda: True)
    monkeypatch.setattr(meal_ai, "analyze_meal", fake_analyze)
    response = client.post("/api/ai/analyze", data={"sample": FIRST, "text": "an apple"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["replayed"] is False
    assert isinstance(body["analysis_id"], int)
    assert calls == ["an apple"]


def test_a_real_account_cannot_get_a_replay_for_free(client, monkeypatch):
    # A sample alone is no input at all for a real account: refused before
    # anything is reserved, exactly as an empty request is.
    from app.services import meal_ai

    monkeypatch.setattr(meal_ai, "is_configured", lambda: True)
    assert client.post("/api/ai/analyze", data={"sample": FIRST}).status_code == 422


def test_the_samples_are_listed(anon_client):
    headers = auth(start(anon_client)["access_token"])
    listed = anon_client.get("/api/demo/samples", headers=headers).json()
    assert [s["id"] for s in listed] == list(SAMPLES)
    assert listed[0] == {
        "id": FIRST,
        "meal_name": SAMPLES[FIRST].analysis.meal_name,
        "note": SAMPLES[FIRST].note,
        "photo": SAMPLES[FIRST].photo,
        "measured_calories": SAMPLES[FIRST].measured_calories,
    }


@pytest.mark.parametrize("sample", SAMPLES.values(), ids=lambda s: s.id)
def test_each_sample_is_close_to_its_lab_value(sample):
    # How the 18 were picked, and the promise the result screen makes when it
    # shows the lab value beside the range: inside it, and within 10%.
    calories = sample.analysis.calories
    assert calories.low <= sample.measured_calories <= calories.high
    assert abs(calories.estimate - sample.measured_calories) <= 0.10 * sample.measured_calories


def test_the_sample_list_needs_a_token(anon_client):
    assert anon_client.get("/api/demo/samples").status_code == 401


def test_a_demo_address_cannot_ask_for_a_reset(anon_client):
    address = start(anon_client)["user"]["email"]
    # Refused at validation: .invalid is a reserved name.
    response = anon_client.post("/api/auth/forgot-password", json={"email": address})
    assert response.status_code == 422


def test_forgot_password_skips_a_demo_row(anon_client, monkeypatch):
    # The skip behind the validator: a demo row whose address would pass it.
    from test_password_reset import configure_email, forgot, signup

    sent = configure_email(monkeypatch)
    signup(anon_client)
    with session() as db:
        db.scalars(select(User).where(User.email == "reset-me@example.com")).one().is_demo = True
        db.commit()
    response = forgot(anon_client)
    assert response.status_code == 200
    assert sent == []
