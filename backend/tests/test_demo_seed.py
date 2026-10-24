"""The demo account's seed (app/demo_seed.py), read back through the API.

The checks go through the endpoints a visitor's first screens call, not only
row counts: a seed that writes the right number of rows in a shape the routers
read differently would pass a count and still show an empty app.
"""
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.security import create_access_token
from app.db import get_engine
from app.demo_seed import SEED_DAYS, seed_demo
from app.models import (
    Food,
    Meal,
    MealTemplate,
    Setting,
    StepEntry,
    Supplement,
    SupplementLog,
    User,
    WaterLog,
    WeightEntry,
)


def _seeded_user(today: date) -> int:
    with Session(get_engine()) as db:
        user = User(email="demo-seedtest@demo.invalid", is_demo=True)
        db.add(user)
        db.flush()
        setting = Setting(user_id=user.id)
        db.add(setting)
        seed_demo(db, user, setting, today)
        db.commit()
        return user.id


def _count(db: Session, model, user_id: int) -> int:
    return db.scalar(select(func.count()).select_from(model).where(model.user_id == user_id))


def test_seed_writes_thirty_days_ending_today(anon_client):
    today = date.today()
    uid = _seeded_user(today)
    with Session(get_engine()) as db:
        # Four meals a day, two today.
        assert _count(db, Meal, uid) == 4 * SEED_DAYS - 2
        assert db.scalar(select(func.max(Meal.date)).where(Meal.user_id == uid)) == today
        assert db.scalar(select(func.min(Meal.date)).where(Meal.user_id == uid)) == (
            today - timedelta(days=SEED_DAYS - 1)
        )
        # Every day but the one in seven left out.
        assert _count(db, WeightEntry, uid) == sum(1 for d in range(SEED_DAYS) if d % 7 != 3)
        assert _count(db, WaterLog, uid) == 5 * SEED_DAYS
        assert _count(db, StepEntry, uid) == SEED_DAYS
        assert _count(db, Food, uid) == 10
        assert _count(db, MealTemplate, uid) == 8
        assert _count(db, Supplement, uid) == 4
        assert _count(db, SupplementLog, uid) == 2



def test_seeded_meals_carry_no_logged_time(anon_client):
    # Written all at once, so a stamp would show the same minute beside
    # today's breakfast and lunch. Explicit None must beat the column default.
    uid = _seeded_user(date.today())
    with Session(get_engine()) as db:
        stamped = db.scalar(
            select(func.count()).select_from(Meal)
            .where(Meal.user_id == uid, Meal.created_at.is_not(None))
        )
    assert stamped == 0

def test_seeded_account_reads_like_a_real_one(anon_client):
    today = date.today()
    uid = _seeded_user(today)
    headers = {"Authorization": f"Bearer {create_access_token(uid)}"}

    meals = anon_client.get(f"/api/meals?date={today.isoformat()}", headers=headers)
    assert meals.status_code == 200
    assert len(meals.json()) == 2

    settings = anon_client.get("/api/settings", headers=headers).json()
    assert settings["targets_auto"] is True
    # Chosen by the formula, so the app shows it rather than "no target yet".
    assert settings["target_set"] is True
    assert settings["trackers"] == ["water", "steps", "supplements"]
    # Rewritten by apply_auto_targets, not left at the placeholder 2100.
    assert settings["calorie_goal"] != 2100

    targets = anon_client.get("/api/settings/targets", headers=headers).json()
    assert targets["missing"] == []
    # Thirty days of intake and weigh-ins are enough to measure the burn.
    assert targets["tdee_source"] == "measured"

    trend = anon_client.get("/api/weights/trend", headers=headers).json()
    # Falling, the direction the goal asks for. A sign slip in the drift
    # seeds a gain and turns every derived number the other way.
    assert trend["weekly_rate_kg"] < 0
    assert trend["projection"]["status"] == "on_course"
