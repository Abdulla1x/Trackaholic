"""Thirty days of made-up data for a demo account.

A port of `seed()` in scripts/screenshots.mjs, which is what the README's
screenshots are taken from, so a visitor sees the same app the screenshots
show. The numbers and their reasons are kept together with the data rather than
summarised: each one was chosen so that a screen reads as a real account would,
and the comments say which screen.

Two differences from the JS, both because this runs inside a request:

- Rows are added through the ORM, not posted to the API. About 450 requests per
  visitor would make the demo's first screen wait on its own seed, and the
  endpoints' validation has nothing to check in data written here.
- Nothing here commits. POST /api/demo creates the account, its settings, this
  data and the day's demo count as one transaction, so a failure part way leaves
  no half-seeded account behind.

Dates are calendar dates counted back from `today`, the server-local date (or
the visitor's own, see routers/demo.py), like every other date a user sees.
"""
import json
import math
from datetime import date as date_type
from datetime import timedelta

from sqlalchemy.orm import Session

from .models import (
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
from .targets import apply_auto_targets

SEED_DAYS = 30

# (name, calories, protein, carbs, fat). Five days of four meals, rotated.
MENUS = [
    [
        ("Overnight oats with blueberries", 526, 27, 72, 14),
        ("Chicken, basmati rice & broccoli", 765, 65, 82, 16),
        ("Greek yoghurt with honey", 260, 25, 30, 5),
        ("Salmon, new potatoes & green beans", 798, 55, 59, 35),
    ],
    [
        ("Scrambled eggs on sourdough", 578, 34, 48, 27),
        ("Chicken shawarma wrap", 863, 56, 78, 32),
        ("Apple and peanut butter", 331, 10, 34, 19),
        ("Beef mince with pasta", 880, 58, 89, 32),
    ],
    [
        ("Protein shake with banana", 423, 43, 48, 6),
        ("Tuna pasta salad", 685, 51, 72, 18),
        ("Cottage cheese with pineapple", 245, 28, 22, 4),
        ("Grilled halloumi & couscous bowl", 820, 41, 79, 38),
    ],
    [
        ("Greek yoghurt, granola & berries", 495, 30, 60, 14),
        ("Turkey and avocado sandwich", 718, 48, 64, 28),
        ("Handful of almonds", 223, 8, 8, 19),
        ("Chicken curry with rice", 928, 60, 98, 30),
    ],
    [
        ("Two boiled eggs and toast", 440, 26, 38, 20),
        ("Lentil soup with bread", 608, 30, 85, 15),
        ("Skyr with strawberries", 215, 26, 21, 1),
        ("Steak, sweet potato & salad", 898, 65, 68, 38),
    ],
]

# (name, serving_size g, calories, protein, carbs, fat) per serving.
LIBRARY = [
    ("Chicken breast, raw", 100, 165, 31, 0, 3.6),
    ("Basmati rice, dry", 100, 356, 8.1, 78, 0.9),
    ("Rolled oats", 40, 152, 5.4, 26, 3),
    ("Greek yoghurt 0%", 170, 100, 17, 6, 0),
    ("Salmon fillet, raw", 100, 208, 20, 0, 13),
    ("Olive oil", 14, 119, 0, 0, 13.5),
    ("Whole egg, large", 58, 78, 6.3, 0.6, 5.3),
    ("Skyr, natural", 150, 96, 17, 6, 0.3),
    ("Almonds", 30, 174, 6.4, 6.1, 15),
    ("Sweet potato, raw", 100, 86, 1.6, 20, 0.1),
]

# More than the six Quick log shows before folding the rest away, so the
# control that expands it is there to try.
TEMPLATES = [
    ("Overnight oats with blueberries", 526, 27, 72, 14),
    ("Chicken, basmati rice & broccoli", 765, 65, 82, 16),
    ("Protein shake with banana", 423, 43, 48, 6),
    ("Greek yoghurt with honey", 260, 25, 30, 5),
    ("Scrambled eggs on sourdough", 578, 34, 48, 27),
    ("Tuna pasta salad", 685, 51, 72, 18),
    ("Salmon, new potatoes & green beans", 798, 55, 59, 35),
    ("Handful of almonds", 223, 8, 8, 19),
]

SUPPLEMENTS = [
    ("Creatine monohydrate", "5 g", ["08:00"]),
    ("Vitamin D3", "2000 IU", ["08:00"]),
    ("Omega-3", "1000 mg", ["08:00", "20:00"]),
    ("Magnesium glycinate", "200 mg", ["22:00"]),
]

WEIGHT_NOISE = [0, 0.28, -0.19, 0.12, -0.3, 0.22, -0.08]
STEPS = [11240, 8630, 13010, 6420, 9870, 12360, 7180]


def _round(value: float) -> int:
    """JavaScript's Math.round (halves go up), so the seed matches the JS one.
    Python's round() sends halves to the even neighbour."""
    return math.floor(value + 0.5)


def seed_demo(db: Session, user: User, setting: Setting, today: date_type) -> None:
    """Fill a new demo account with SEED_DAYS days ending on `today`.

    `user` must already have an id (the caller flushes it). Does not commit.
    """
    uid = user.id

    db.add_all(
        Food(user_id=uid, name=name, serving_size=size, calories=kcal,
             protein=protein, carbs=carbs, fat=fat)
        for name, size, kcal, protein, carbs, fat in LIBRARY
    )
    db.add_all(
        MealTemplate(user_id=uid, name=name, calories=kcal, protein=protein,
                     carbs=carbs, fat=fat, items_json=None)
        for name, kcal, protein, carbs, fat in TEMPLATES
    )
    supplements = [
        Supplement(user_id=uid, name=name, dose=dose, times_json=json.dumps(times))
        for name, dose, times in SUPPLEMENTS
    ]
    db.add_all(supplements)

    for day in range(SEED_DAYS):
        on = today - timedelta(days=day)
        menu = MENUS[day % len(MENUS)]
        # Today is part-logged: two meals, not four. That is what a real
        # Today looks like at midday, and it is the case the weekly review's
        # "the week ends yesterday" rule exists for.
        meals = menu[:2] if day == 0 else menu
        # The five menus rotate, so without this the calorie chart is a perfect
        # five-day sawtooth that reads as generated rather than logged. A
        # deterministic +/-6% breaks the period; it is symmetric, so mean
        # intake, and the measured burn derived from it, is unmoved.
        jitter = 1 + (((day * 37) % 13) - 6) / 100
        db.add_all(
            Meal(user_id=uid, date=on, name=name,
                 calories=_round(kcal * jitter), protein=_round(protein * jitter),
                 carbs=_round(carbs * jitter), fat=_round(fat * jitter))
            for name, kcal, protein, carbs, fat in meals
        )
        # A weigh-in most days but not all: the gaps are what make the trend
        # line's smoothing visible.
        if day % 7 != 3:
            # ⚠️ `day` counts BACKWARDS from today, so the drift must be
            # POSITIVE for the trend to FALL: the oldest day is the heaviest.
            # Signed the other way it seeds a gain, and the measured burn, the
            # auto targets and the review's rate check all invert with it.
            # 0.05 kg/day is 0.35 kg/week, the goal rate set below.
            weight = round(82.9 + 0.05 * day + WEIGHT_NOISE[day % 7], 1)
            db.add(WeightEntry(user_id=uid, date=on, weight_kg=weight))
        # 3,000 ml most days and 2,750 every third, against the ~2,900 ml goal
        # the app derives from the weigh-ins (35 ml/kg), so the review's water
        # check reports most days met rather than "0 of 7".
        db.add_all(
            WaterLog(user_id=uid, date=on, ml=ml)
            for ml in (500, 750, 500, 750, 250 if day % 3 == 0 else 500)
        )
        db.add(StepEntry(user_id=uid, date=on, steps=STEPS[day % 7]))

    setting.calorie_goal = 2100
    setting.protein_goal = 150
    setting.carbs_goal = 230
    setting.fat_goal = 70
    setting.track_carbs = True
    setting.track_fat = True
    setting.weight_unit = "kg"
    setting.height_cm = 179
    setting.birth_date = date_type(1996, 3, 14)
    setting.sex = "male"
    setting.activity_level = "moderate"
    setting.goal_rate_kg_per_week = -0.35
    # Below the weigh-ins, which end near 82.9 kg and are falling: ~4.9 kg at
    # the measured rate lands on the 'on_course' projection, the one status
    # that names a date.
    setting.goal_weight_kg = 78
    setting.targets_auto = True
    setting.steps_goal = 9000
    # A new account shows only the weigh-in until it chooses more.
    setting.trackers_json = json.dumps(["water", "steps", "supplements"])

    # The supplements need ids for their logs, and the targets read the
    # weigh-ins from the database, so both wait for a flush.
    db.flush()
    # Two of today's doses ticked, so the card shows both states.
    db.add_all(
        SupplementLog(user_id=uid, supplement_id=s.id, date=today,
                      time_of_day=json.loads(s.times_json)[0])
        for s in supplements[:2]
    )
    # Last, after the weigh-ins: targets_auto recomputes the four goals from
    # the profile and the measured burn, and it needs the weights to read.
    # Also what marks the target as chosen (Setting.target_set).
    apply_auto_targets(setting, db, today=today)
