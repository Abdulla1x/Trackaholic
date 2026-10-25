"""The lighter AI: a meal estimate the user chose to send to Flash-Lite.

POST /api/ai/analyze with lighter=true asks services/meal_ai.py's
ANALYSIS_LITE chain. It counts toward the user's own AI_DAILY_LIMIT, like any
estimate, but sits outside AI_GLOBAL_DAILY_LIMIT under its own app-wide
ceiling, AI_LITE_DAILY_LIMIT.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_engine
from app.models import AIAnalysis, AIRefusal
from app.services import meal_ai
from conftest import utc_today
from tests.test_meal_ai import SAMPLE, configure
from tests.test_review import log_meal


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
