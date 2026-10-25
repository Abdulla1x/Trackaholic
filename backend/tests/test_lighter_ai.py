"""The lighter AI: a meal estimate the user chose to send to Flash-Lite.

POST /api/ai/analyze with lighter=true asks services/meal_ai.py's
ANALYSIS_LITE chain. It counts toward the user's own AI_DAILY_LIMIT, like any
estimate, but sits outside AI_GLOBAL_DAILY_LIMIT under its own app-wide
ceiling, AI_LITE_DAILY_LIMIT.
"""
from datetime import datetime, time, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_engine
from app.models import AIAnalysis, AIRefusal
from app.services import meal_ai
from conftest import utc_today
from tests.test_demo import auth, start
from tests.test_meal_ai import SAMPLE, configure
from tests.test_review import log_meal

FLASH = ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-2.5-flash"]
LITE = "gemini-3.5-flash-lite"
# 12:00 UTC on 25 Oct is 16:00 in Dubai: Google's next reset, midnight Pacific
# (PDT, UTC-7), is 07:00 UTC on the 26th, which is 11:00 in Dubai.
BEFORE_DST_ENDS = datetime(2026, 10, 25, 12, tzinfo=timezone.utc)
AFTER_DST_ENDS = datetime(2026, 11, 2, 12, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def _fresh_provider_memory(monkeypatch):
    monkeypatch.setattr(meal_ai, "_exhausted", {})
    monkeypatch.setattr(meal_ai, "_missing", {})
    for name in ("MEAL_AI_MODEL", "MEAL_AI_FALLBACK_MODEL", *meal_ai.CHAIN_ENV.values()):
        monkeypatch.delenv(name, raising=False)


def _clock(monkeypatch, now: datetime):
    monkeypatch.setattr(meal_ai, "_utcnow", lambda: now)


def _out(*models: str):
    for model in models:
        meal_ai._exhausted[model] = datetime(2099, 1, 1, tzinfo=timezone.utc)


def _failing(exc: Exception):
    async def fake(*_args, **_kwargs):
        raise exc

    return fake


def _next_utc_midnight() -> datetime:
    today = datetime.now(timezone.utc).date()
    return datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc)


def _at(value: str) -> datetime:
    return datetime.fromisoformat(value)


def _recording(kinds: list[str]):
    async def fake(images, text, prior_analysis=None, **kwargs):
        kinds.append(kwargs.get("kind", meal_ai.ANALYSIS))
        return SAMPLE

    return fake


def _estimate(client, lighter: bool = False):
    data = {"text": "150 g chicken"}
    if lighter:
        data["lighter"] = "true"
    return client.post("/api/ai/analyze", data=data)


def _kind(analysis_id: int) -> str:
    with Session(get_engine()) as db:
        return db.get(AIAnalysis, analysis_id).kind


def _refusals() -> list[tuple]:
    with Session(get_engine()) as db:
        return [
            (row.date, row.kind, row.cause, row.count)
            for row in db.scalars(select(AIRefusal).order_by(AIRefusal.id)).all()
        ]


def test_a_lighter_estimate_asks_the_lighter_chain_and_says_so(client, monkeypatch):
    kinds: list[str] = []
    configure(monkeypatch, _recording(kinds))

    main = _estimate(client)
    lite = _estimate(client, lighter=True)

    assert main.status_code == lite.status_code == 200
    assert kinds == [meal_ai.ANALYSIS, meal_ai.ANALYSIS_LITE]
    assert (main.json()["lighter"], lite.json()["lighter"]) == (False, True)
    assert _kind(main.json()["analysis_id"]) == "analysis"
    assert _kind(lite.json()["analysis_id"]) == "analysis_lite"


def test_lighter_estimates_sit_outside_the_shared_daily_limit(client, monkeypatch):
    configure(monkeypatch)
    monkeypatch.setenv("AI_GLOBAL_DAILY_LIMIT", "1")

    assert _estimate(client).status_code == 200
    assert _estimate(client).status_code == 503
    assert _estimate(client, lighter=True).status_code == 200


def test_lighter_estimates_leave_the_shared_limit_untouched(client, monkeypatch):
    configure(monkeypatch)
    monkeypatch.setenv("AI_GLOBAL_DAILY_LIMIT", "1")

    assert _estimate(client, lighter=True).status_code == 200
    assert _estimate(client).status_code == 200


def test_the_lighter_ai_stops_at_its_own_ceiling(client, monkeypatch):
    configure(monkeypatch)
    monkeypatch.setenv("AI_LITE_DAILY_LIMIT", "1")

    assert _estimate(client, lighter=True).status_code == 200
    refused = _estimate(client, lighter=True)

    assert refused.status_code == 503
    assert "lighter AI" in refused.json()["detail"]
    assert _refusals() == [(utc_today(), "analysis_lite", "app_limit", 1)]
    # The main AI's shared limit is a separate count.
    assert _estimate(client).status_code == 200


def test_a_ceiling_of_zero_turns_the_lighter_ai_off(client, monkeypatch):
    configure(monkeypatch)
    monkeypatch.setenv("AI_LITE_DAILY_LIMIT", "0")
    assert _estimate(client, lighter=True).status_code == 503


def test_the_lighter_ceiling_defaults_to_200(monkeypatch):
    from app.routers.ai import lite_daily_limit

    monkeypatch.delenv("AI_LITE_DAILY_LIMIT", raising=False)
    assert lite_daily_limit() == 200


def test_both_kinds_of_estimate_share_the_users_own_allowance(client, monkeypatch):
    configure(monkeypatch)
    monkeypatch.setenv("AI_DAILY_LIMIT", "2")

    assert _estimate(client).status_code == 200
    assert _estimate(client, lighter=True).status_code == 200
    assert _estimate(client).status_code == 429
    assert _estimate(client, lighter=True).status_code == 429


def test_the_users_allowance_is_shared_whichever_kind_spends_it_first(client, monkeypatch):
    configure(monkeypatch)
    monkeypatch.setenv("AI_DAILY_LIMIT", "1")

    assert _estimate(client, lighter=True).status_code == 200
    assert _estimate(client).status_code == 429


def test_lighter_estimates_stay_out_of_the_ai_accuracy_figures(client, monkeypatch):
    """The accuracy page and the review's line describe the main AI only."""
    configure(monkeypatch)
    lite = _estimate(client, lighter=True).json()
    meal = log_meal(client, 0).json()
    linked = client.patch(
        f"/api/ai/analyses/{lite['analysis_id']}", json={"meal_id": meal["id"]}
    )
    assert linked.status_code == 204

    calibration = client.get("/api/ai/calibration").json()
    assert (calibration["analyses"], calibration["linked"]) == (0, 0)


def test_the_shared_limit_on_admin_leaves_lighter_estimates_out(client, monkeypatch):
    from app.routers.ai import global_calls_today

    configure(monkeypatch)
    _estimate(client)
    _estimate(client, lighter=True)
    with Session(get_engine()) as db:
        assert global_calls_today(db) == 1


# --- telling the Log panel the main AI is out ----------------------------------


def test_status_says_nothing_while_the_main_ai_is_not_known_to_be_out(client, monkeypatch):
    configure(monkeypatch)
    assert client.get("/api/ai/status").json()["main_out"] is None


@pytest.mark.parametrize(
    "now, back",
    [
        # 11:00 in Dubai while California is on summer time...
        (BEFORE_DST_ENDS, datetime(2026, 10, 26, 7, tzinfo=timezone.utc)),
        # ...and 12:00 once it isn't (1 November).
        (AFTER_DST_ENDS, datetime(2026, 11, 3, 8, tzinfo=timezone.utc)),
    ],
)
def test_status_says_when_every_flash_model_is_out_and_when_it_is_back(
    client, monkeypatch, now, back
):
    configure(monkeypatch)
    _clock(monkeypatch, now)
    _out(*FLASH)

    out = client.get("/api/ai/status").json()["main_out"]
    assert out["reason"] == "daily_quota"
    assert _at(out["back_at"]) == back
    assert out["lighter"] is True


def test_one_flash_model_still_in_is_not_out(client, monkeypatch):
    configure(monkeypatch)
    _out(*FLASH[:2])
    assert client.get("/api/ai/status").json()["main_out"] is None


def test_status_says_when_the_apps_shared_limit_is_used_up(client, monkeypatch):
    configure(monkeypatch)
    monkeypatch.setenv("AI_GLOBAL_DAILY_LIMIT", "1")
    _estimate(client)

    out = client.get("/api/ai/status").json()["main_out"]
    assert out["reason"] == "app_limit"
    assert _at(out["back_at"]) == _next_utc_midnight()
    assert out["lighter"] is True


def test_both_spent_means_back_at_the_later_reset(client, monkeypatch):
    configure(monkeypatch)
    monkeypatch.setenv("AI_GLOBAL_DAILY_LIMIT", "1")
    _estimate(client)
    _out(*FLASH)

    out = client.get("/api/ai/status").json()["main_out"]
    assert _at(out["back_at"]) == max(meal_ai.next_quota_reset(), _next_utc_midnight())


@pytest.mark.parametrize(
    "spend",
    [
        lambda monkeypatch, client: monkeypatch.setenv("AI_LITE_DAILY_LIMIT", "0"),
        lambda monkeypatch, client: _out(LITE),
        lambda monkeypatch, client: monkeypatch.setenv("AI_DAILY_LIMIT", "0"),
    ],
    ids=["lighter ceiling", "lite out for the day", "own allowance"],
)
def test_status_says_when_the_lighter_ai_cannot_take_it_either(client, monkeypatch, spend):
    configure(monkeypatch)
    _out(*FLASH)
    spend(monkeypatch, client)
    assert client.get("/api/ai/status").json()["main_out"]["lighter"] is False


def test_a_demo_is_never_told_the_main_ai_is_out(anon_client, monkeypatch):
    configure(monkeypatch)
    _out(*FLASH)
    headers = auth(start(anon_client)["access_token"])
    assert anon_client.get("/api/ai/status", headers=headers).json()["main_out"] is None


def test_an_estimate_refused_for_the_day_says_so_and_offers_the_lighter_ai(client, monkeypatch):
    _clock(monkeypatch, BEFORE_DST_ENDS)
    resets = meal_ai.next_quota_reset()
    configure(monkeypatch, _failing(meal_ai.MealAIDailyQuotaExhausted("out", resets)))

    response = _estimate(client)
    body = response.json()
    assert response.status_code == 429
    assert body["detail"].startswith("The AI has reached its daily limit.")
    assert body["main_out"]["reason"] == "daily_quota"
    assert _at(body["main_out"]["back_at"]) == resets
    assert body["main_out"]["lighter"] is True


@pytest.mark.parametrize(
    "exc",
    [meal_ai.MealAIUnavailable("503"), meal_ai.MealAIUnreachable("timeout"), meal_ai.MealAIRateLimited("rpm")],
    ids=["overloaded", "unreachable", "per-minute"],
)
def test_an_estimate_refused_as_busy_offers_the_lighter_ai_until_googles_reset(
    client, monkeypatch, exc
):
    _clock(monkeypatch, BEFORE_DST_ENDS)
    configure(monkeypatch, _failing(exc))

    out = _estimate(client).json()["main_out"]
    assert out["reason"] == "busy"
    assert _at(out["back_at"]) == meal_ai.next_quota_reset()


def test_an_estimate_refused_at_the_apps_shared_limit_offers_the_lighter_ai(client, monkeypatch):
    configure(monkeypatch)
    monkeypatch.setenv("AI_GLOBAL_DAILY_LIMIT", "0")

    response = _estimate(client)
    assert response.status_code == 503
    assert response.json()["main_out"]["reason"] == "app_limit"


@pytest.mark.parametrize(
    "setup",
    [
        lambda monkeypatch: (configure(monkeypatch), monkeypatch.setenv("AI_DAILY_LIMIT", "0")),
        lambda monkeypatch: configure(monkeypatch, _failing(meal_ai.MealAIBadRequest("bad"))),
    ],
    ids=["own allowance", "misconfigured"],
)
def test_other_refusals_offer_nothing(client, monkeypatch, setup):
    setup(monkeypatch)
    body = _estimate(client).json()
    assert "main_out" not in body
    assert body["detail"]


def test_a_refused_lighter_estimate_offers_nothing_more(client, monkeypatch):
    configure(monkeypatch, _failing(meal_ai.MealAIUnavailable("503")))
    response = _estimate(client, lighter=True)
    assert response.status_code == 503
    assert "main_out" not in response.json()


def test_other_kinds_at_the_shared_limit_offer_nothing(client, monkeypatch):
    """Only a meal estimate has a lighter AI to fall back on."""
    from tests.test_meal_ai import configure_transcribe, post_voice_note

    configure_transcribe(monkeypatch)
    monkeypatch.setenv("AI_GLOBAL_DAILY_LIMIT", "0")
    response = post_voice_note(client)
    assert response.status_code == 503
    assert "main_out" not in response.json()
