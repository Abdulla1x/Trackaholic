import math
from collections.abc import Sequence
from datetime import date as date_type
from datetime import timedelta
from typing import Literal, NamedTuple

# Smoothing factor for the weight trend line. 0.25 is a chosen convention, not a
# measured constant: it weights each new weigh-in at a quarter and gives roughly
# a one-week effective window, which is the usual way to see past day-to-day
# water and gut-content swings. Change it and the trend line changes shape; no
# number here is derived from anything.
WEIGHT_TREND_ALPHA = 0.25

# The rate of change is fitted over the last 4 weeks of trend, and refuses to
# answer below a week of weigh-ins. Both are policy choices about how much data
# is enough to show a number, not statistical thresholds.
RATE_WINDOW_DAYS = 28
RATE_MIN_POINTS = 7


class TrendPoint(NamedTuple):
    """One weigh-in with its smoothed value."""

    date: date_type
    weight_kg: float
    trend_kg: float


def weight_trend(
    entries: Sequence[tuple[date_type, float]],
    alpha: float = WEIGHT_TREND_ALPHA,
) -> list[TrendPoint]:
    """Exponentially weighted moving average over logged weigh-ins.

    The EWMA steps *per entry*, not per calendar day: a gap of a week and a gap
    of a day advance the smoothing equally. That is a deliberate simplification
    — at the daily-ish cadence people actually weigh themselves the difference
    is small, and it keeps the series defined without inventing weights for days
    nobody stood on the scale. Entries are sorted by date; the first entry seeds
    the trend at its own value, so early points track raw weight closely.
    """
    if not 0 < alpha <= 1:
        raise ValueError("alpha must be in (0, 1]")

    points: list[TrendPoint] = []
    trend: float | None = None
    for entry_date, weight in sorted(entries, key=lambda item: item[0]):
        trend = weight if trend is None else alpha * weight + (1 - alpha) * trend
        points.append(TrendPoint(entry_date, weight, round(trend, 3)))
    return points


def weekly_rate(
    trend_points: Sequence[TrendPoint],
    window_days: int = RATE_WINDOW_DAYS,
    min_points: int = RATE_MIN_POINTS,
) -> float | None:
    """kg per week, as the least-squares slope of the recent *trend* series.

    Fitted against calendar-day offsets, so missed days do not compress the
    timeline. Returns None rather than a number when the window holds fewer
    than `min_points` weigh-ins — a rate built from two readings is noise
    wearing a decimal point.
    """
    if not trend_points:
        return None

    latest = max(point.date for point in trend_points)
    cutoff = latest - timedelta(days=window_days - 1)
    window = [point for point in trend_points if point.date >= cutoff]
    if len(window) < min_points:
        return None

    origin = min(point.date for point in window)
    xs = [(point.date - origin).days for point in window]
    ys = [point.trend_kg for point in window]
    mean_x = sum(xs) / len(xs)
    mean_y = sum(ys) / len(ys)

    denominator = sum((x - mean_x) ** 2 for x in xs)
    if denominator == 0:  # every point on one day — no slope to fit
        return None
    slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)) / denominator
    return round(slope * 7, 3)


# --- Goal weight -------------------------------------------------------------

# POLICY. How close the trend has to sit to the goal before the app says you
# are there. 0.1 kg is one decimal place -- the precision bathroom scales
# actually report, and the precision `formatWeight` prints. Anything tighter
# would call two numbers different that the UI displays identically.
GOAL_REACHED_TOLERANCE_KG = 0.1

# POLICY. The furthest out a date is worth naming. Two years of a measured rate
# holding is already a generous assumption; past that the date is not something
# anyone can act on, and printing it would dress arithmetic up as a forecast.
MAX_PROJECTION_WEEKS = 104

# The eight answers `goal_projection` can give. Spelled here rather than in
# schemas.py so the API Literal and the function cannot drift apart: schemas
# imports this name.
ProjectionStatus = Literal[
    "no_goal",
    "reached",
    "no_rate",
    "stale",
    "holding",
    "moving_away",
    "too_far",
    "on_course",
]


class GoalProjection(NamedTuple):
    """When the measured trend reaches the goal weight, or why it cannot say.

    `remaining_kg` is signed the way the goal is approached: negative means
    there is still weight to lose. `from_date` is the weigh-in the projection
    is anchored at -- never today -- because that is the last date anything was
    actually measured, and a date computed forward from an unmeasured today
    would be a day of drift per day of not weighing in.
    """

    status: ProjectionStatus
    goal_weight_kg: float | None = None
    remaining_kg: float | None = None
    weeks: float | None = None
    reach_date: date_type | None = None
    from_date: date_type | None = None


def goal_projection(
    goal_weight_kg: float | None,
    trend_points: Sequence[TrendPoint],
    rate_kg_per_week: float | None,
    today: date_type,
    window_days: int = RATE_WINDOW_DAYS,
    max_weeks: int = MAX_PROJECTION_WEEKS,
    tolerance_kg: float = GOAL_REACHED_TOLERANCE_KG,
) -> GoalProjection:
    """Project the goal weight from the **measured** rate, or refuse to.

    Never from `goal_rate_kg_per_week`. Projecting from the rate the user asked
    for would hand their own input back to them as a prediction, which is the
    false precision this app exists to avoid -- the answer would be true by
    construction and tell them nothing.

    `today` is a parameter rather than a `date.today()` inside, so the staleness
    branch is testable without freezing the clock.

    **Staleness reuses `RATE_WINDOW_DAYS` rather than inventing a threshold.**
    `weekly_rate` windows from the latest weigh-in, not from today, so an
    account that stopped weighing in three months ago still gets a
    well-fitted slope -- of a period that is entirely over. Once the last
    weigh-in is older than that window, every point the rate was fitted to has
    aged out, and a forward date drawn from it is a claim about a measurement
    that stopped. `review.py`'s `weight_check` refuses at REVIEW_WINDOW_DAYS (7)
    instead; the two differ on purpose, because a weekly review makes a weekly
    claim and this one does not.

    The order of the checks is the design:

    * `reached` is tested before `no_rate`, so someone with three weigh-ins
      sitting on their goal is told the one thing that is already true rather
      than asked for more data.
    * `reached` is tested before `stale` too, because "you were there at your
      last weigh-in" stays honest at any age -- `from_date` travels with it.

    There is deliberately no "rate too small to count" threshold. `weekly_rate`
    rounds to 3 dp, so an exactly-zero rate is reachable and `holding` catches
    it; anything non-zero divides, and `too_far` handles the absurd end. A
    minimum-rate constant would refuse a genuine 0.1 kg/week as noise.
    """
    if goal_weight_kg is None:
        return GoalProjection(status="no_goal")
    if not trend_points:
        # No weigh-ins is not its own status: `weekly_rate` already answers
        # None for it, and the thing to say -- weigh in more -- is identical.
        return GoalProjection(status="no_rate", goal_weight_kg=goal_weight_kg)

    latest = max(trend_points, key=lambda point: point.date)
    remaining = round(goal_weight_kg - latest.trend_kg, 3)

    def answer(status: ProjectionStatus, **extra: object) -> GoalProjection:
        return GoalProjection(
            status=status,
            goal_weight_kg=goal_weight_kg,
            remaining_kg=remaining,
            from_date=latest.date,
            **extra,
        )

    if abs(remaining) <= tolerance_kg:
        return answer("reached")
    if rate_kg_per_week is None:
        return answer("no_rate")
    if (today - latest.date).days > window_days:
        return answer("stale")
    if rate_kg_per_week == 0:
        return answer("holding")
    # Both are non-zero here, so comparing their signs is enough: the trend is
    # moving away from the goal rather than towards it.
    if (rate_kg_per_week > 0) != (remaining > 0):
        return answer("moving_away")

    weeks = remaining / rate_kg_per_week
    if weeks > max_weeks:
        return answer("too_far", weeks=round(weeks, 1))
    # Days are derived from the unrounded weeks; the rounded `weeks` is for
    # display only, and rounding before multiplying would shift the date.
    return answer(
        "on_course",
        weeks=round(weeks, 1),
        reach_date=latest.date + timedelta(days=round(weeks * 7)),
    )


def scale_macros(
    weight: float,
    serving_size: float,
    per_serving: dict[str, float | None],
) -> dict[str, float | None]:
    """Scale per-serving macro values to the weight actually eaten.

    Keys with None values (untracked macros) stay None.
    """
    if serving_size <= 0:
        raise ValueError("Serving size must be greater than zero")
    if weight < 0:
        raise ValueError("Weight cannot be negative")

    factor = weight / serving_size
    return {
        key: None if value is None else round(value * factor, 2)
        for key, value in per_serving.items()
    }


def total_macros(items: list[dict[str, float | None]]) -> dict[str, float | None]:
    """Sum macros across ingredients. A macro totals to None only if no
    ingredient reported it; otherwise missing values count as 0."""
    keys = ("calories", "protein", "carbs", "fat")
    totals: dict[str, float | None] = {}
    for key in keys:
        values = [item[key] for item in items if item.get(key) is not None]
        totals[key] = round(sum(values), 2) if values else None
    return totals


# --- Body profile → energy targets -------------------------------------------
#
# Read the labels on these constants literally. Exactly one group below is
# derived from published work; the rest are conventions and policy choices that
# this app picked and could just as reasonably have picked differently. Nothing
# here measures anything about the person using it -- that is Phase 5's job,
# and it replaces `estimated_tdee` rather than tuning these.

# PUBLISHED EQUATION. Mifflin MD, St Jeor ST et al. (1990), "A new predictive
# equation for resting energy expenditure in healthy individuals", Am J Clin
# Nutr 51(2):241-7. BMR = 10*kg + 6.25*cm - 5*age + s, where s is +5 for male
# and -161 for female bodies. These four numbers are the only ones in this
# section that are not our choice -- do not "tune" them.
MIFFLIN_WEIGHT_COEFFICIENT = 10.0
MIFFLIN_HEIGHT_COEFFICIENT = 6.25
MIFFLIN_AGE_COEFFICIENT = 5.0
MIFFLIN_SEX_OFFSET = {"male": 5.0, "female": -161.0}

# SOURCE. Physical activity levels (PAL = total burn / basal burn) measured with
# doubly labelled water: FAO/WHO/UNU, Human energy requirements (2001
# consultation, published 2004), Table 5.3 -- "sedentary or light activity"
# 1.40-1.69 (their example: male office workers), "active or moderately
# active" 1.70-1.99, "vigorous" 2.00-2.40. The five levels sit inside those
# bands: the two lightest at the bottom and middle of the first, the next two
# at the bottom and middle of the second, the most active at the start of the
# third.
#
# Until 2026-10 these were the Harris-Benedict-era round numbers (1.2, 1.375,
# 1.55, 1.725, 1.9). Measured data puts an office worker at 1.40 or more, so
# 1.2 set desk workers' day-one targets too low -- the risky direction, since
# an underestimated burn plans a bigger cut than the pace asked for. They are
# still estimates for one person; the measured burn replaces them once there
# is data (targets._measure_tdee).
ACTIVITY_MULTIPLIERS = {
    "sedentary": 1.40,     # mostly sitting: desk or home, no workouts
    "light": 1.55,         # 1-2 workouts a week, or on your feet part of the day
    "moderate": 1.70,      # 3-5 workouts a week, or on your feet most of the day
    "active": 1.85,        # 6-7 workouts a week, or a physical job
    "very_active": 2.00,   # training twice a day, or a physical job plus workouts
}

# APPROXIMATION. The energy in a kilogram of body mass, used to turn a desired
# rate of change into a daily calorie delta. The real figure depends on what
# the tissue is -- fat stores roughly this, lean mass far less -- so it is a
# planning number, not a measurement.
KCAL_PER_KG = 7700.0

# CONVENTION. Atwater factors, rounded the way every nutrition label rounds
# them. Real digestible energy varies by food.
KCAL_PER_G_PROTEIN = 4.0
KCAL_PER_G_CARB = 4.0
KCAL_PER_G_FAT = 9.0

# SOURCE. Protein scales with body weight, not with the calorie target -- that
# is the whole reason this app does not use a fixed percentage split. How much
# per kg depends on the goal and on "What matters most?" (settings.
# protein_focus), as (target, low, high):
#   * keeping muscle while losing: 2.2 (1.8-2.6). Helms, Aragon & Fitschen
#     2014 and the ISSN position stand (Jäger et al. 2017): 2.3-3.1 g per kg
#     of LEAN mass for trained people in a deficit, which is 1.8-2.6 per kg
#     of body weight at 15-25% body fat;
#   * building muscle, at maintenance or above: 1.9 (1.6-2.2). Iraki et al.
#     2019: "1.6-2.2 g/kg/day"; Morton et al. 2018 found no further gain in
#     lean mass past 1.62;
#   * just the scale: 1.4 (1.2-1.6). Leidy et al. 2015 (AJCN): 1.2-1.6 g/kg a
#     day improves appetite and weight management;
#   * not answered: 1.8 (1.6-2.2), the value every account had before the
#     question; inside the ISSN's 1.4-2.0 for exercisers and Iraki's range.
# Fat then takes a quarter of calories (IOM AMDR 20-35%) and carbohydrate is
# whatever is left, because carbohydrate is the macro with no established
# minimum.
PROTEIN_G_PER_KG = 1.8
PROTEIN_UNANSWERED = (PROTEIN_G_PER_KG, 1.6, 2.2)
PROTEIN_MUSCLE_LOSING = (2.2, 1.8, 2.6)
PROTEIN_MUSCLE = (1.9, 1.6, 2.2)
PROTEIN_SCALE = (1.4, 1.2, 1.6)
# SOURCE. Weijs 2024 (Curr Opin Clin Nutr Metab Care 28(1)): during weight
# loss, "at least 1.2 g/kg body weight per day with a maximum weight of BMI
# 30". Fat mass needs no protein, so above BMI 30 protein -- and the fat
# minimum below -- is worked out from the weight at BMI 30 for the height.
# Lean, heavy lifters rarely pass BMI 30 by muscle alone; anyone with a coach's
# numbers types their own.
PROTEIN_REFERENCE_MAX_BMI = 30.0
FAT_FRACTION_OF_CALORIES = 0.25
# SOURCE. Iraki, Fitschen, Espinar & Helms 2019 (Sports 7:154): fat at "0.5-1.5
# g/kg/day". The quarter of calories above stays the rule, but never below the
# bottom of that range: at a 1,200 kcal floor a quarter is only 33 g.
MIN_FAT_G_PER_KG = 0.5

# SOURCE. How fast a plan may lose. Helms, Aragon & Fitschen 2014 (JISSN 11:20):
# "approximately 0.5 to 1%/wk to maximize muscle retention"; CDC: "about 1 to 2
# pounds a week" (0.45-0.9 kg). The cap is the top of Helms's range and never
# more than 1 kg a week, whether the burn is estimated or measured: nothing
# trusted supports planning faster without medical supervision.
MAX_LOSS_FRACTION_OF_WEIGHT = 0.01
MAX_LOSS_KG_PER_WEEK = 1.0
# SOURCE. How fast a plan may gain. Iraki et al. 2019: "~0.25-0.5% of
# bodyweight/week" for novice and intermediate lifters; the cap is the top.
# Below a healthy BMI the NHS's advice for underweight adults is larger and
# wins: "adding around 300 to 500 extra calories a day". Never over 1 kg.
MAX_GAIN_FRACTION_OF_WEIGHT = 0.005
MAX_GAIN_KG_PER_WEEK = 1.0
UNDERWEIGHT_SURPLUS_KCAL = 500.0
# SOURCE. WHO BMI classification: under 18.5 is underweight. No loss is planned
# below it; maintaining or gaining still is.
UNDERWEIGHT_BMI = 18.5
# CONVENTION, then SOURCE. The lowest target set without a clinician: 1,200
# kcal for women and 1,500 for men, widely attributed to Harvard Health (the
# original could not be checked, and secondary sources disagree on the men's
# figure). NHLBI's guidance sets targets by weight instead -- 1,500-1,800 kcal
# at 250 lb (113.4 kg) or more -- so from there the floor is 1,500 for anyone.
# Under 800 kcal is a very-low-calorie diet, which needs supervision (NIH Task
# Force on the Prevention and Treatment of Obesity, JAMA 1993).
MIN_TARGET_KCAL = {"male": 1500.0, "female": 1200.0}
HEAVY_WEIGHT_KG = 113.4
HEAVY_MIN_TARGET_KCAL = 1500.0

# POLICY. How much logging is enough before an energy-balance TDEE is allowed to
# drive a target. All three are refusals, chosen against real data rather than
# picked round: on a genuinely dense fortnight (24/24 logged days, 23 weigh-ins)
# a 7-day window produced 2700 kcal against 2498 from the formula, because trend
# weight had moved -0.01 kg over 6 days and dividing 7700 kcal/kg by that much
# noise amplifies it. Every window of 10 days or more landed within 2-4% of the
# formula. 14 is where the number stopped moving.
#
# The span is measured between the first and last weigh-in *inclusive*, not from
# the window's nominal width -- what matters is the period the slope was
# actually fitted over.
TDEE_MIN_SPAN_DAYS = 14
TDEE_MIN_LOGGED_DAYS = 10
TDEE_MIN_WEIGH_INS = 10

# POLICY. And how much of the measured period has to be logged, as a fraction.
# The mean intake stands in for every day in the span, including the unlogged
# ones, so this bounds how far that extrapolation is allowed to reach. The
# absolute floor above binds at the shortest allowed span; this one binds as
# the span grows, which is where a 10-of-28-days average would otherwise start
# describing mostly days nobody recorded.
TDEE_MIN_LOGGED_FRACTION = 0.7

# POLICY. The band a measured TDEE has to land in to be believable, as a
# multiple of the same person's BMR. The lower bound is the one that matters:
# nobody expends less than they would lying still, so a measured value beneath
# it is proof the inputs are wrong -- almost always meals that were eaten and
# not logged -- rather than a discovery about their metabolism. The upper bound
# catches the mirror error (a mistyped weigh-in inventing a large loss).
TDEE_PLAUSIBLE_BMR_RANGE = (1.1, 2.5)


class TargetCalories(NamedTuple):
    """A calorie target, and why it is not the one the rate asked for.

    `clamped_reason` is None when the target is exactly what the requested rate
    implies. When it is set, the UI is expected to show it: a target that
    silently disagrees with the rate the user typed is worse than no target,
    because the user goes on believing the rate.
    """

    calories: float
    clamped_reason: str | None
    # The same story as data, so a screen can say it in its own words: the
    # pace asked for and the pace planned (kg a week, signed), the fastest
    # this person can be planned to lose or gain, and the lowest target set
    # for them.
    requested_rate: float = 0.0
    applied_rate: float = 0.0
    max_loss_kg_per_week: float = 0.0
    max_gain_kg_per_week: float = 0.0
    floor_kcal: float = 0.0
    loss_refused: bool = False


def age_years(birth_date: date_type, on: date_type | None = None) -> int:
    """Whole years old, on `on` (default today).

    The birthday itself counts as the new age. Stored as a date rather than a
    number precisely so this can be recomputed instead of going stale.
    """
    today = on or date_type.today()
    had_birthday = (today.month, today.day) >= (birth_date.month, birth_date.day)
    return today.year - birth_date.year - (0 if had_birthday else 1)


def bmi(weight_kg: float | None, height_cm: float | None) -> float | None:
    """Body mass index in kg/m², or None if either input is missing.

    Returns None rather than raising because both inputs are optional profile
    fields: "we don't know yet" is an ordinary state here, not an error.
    """
    if not weight_kg or not height_cm:
        return None
    height_m = height_cm / 100
    return round(weight_kg / (height_m * height_m), 1)


def bmr_mifflin_st_jeor(
    weight_kg: float,
    height_cm: float,
    age: int,
    sex: str,
    sex_offset: dict[str, float] = MIFFLIN_SEX_OFFSET,
) -> float:
    """Resting energy expenditure, in kcal/day, by Mifflin-St Jeor.

    Takes a binary sex term because the published equation does. That is a
    limitation of the formula rather than a claim about people, which is why
    the field is optional in the UI and why Phase 5's measured TDEE is intended
    to replace this entirely rather than refine it.
    """
    if sex not in sex_offset:
        raise ValueError(f"unknown sex: {sex!r}")
    if weight_kg <= 0 or height_cm <= 0:
        raise ValueError("weight and height must be greater than zero")

    return round(
        MIFFLIN_WEIGHT_COEFFICIENT * weight_kg
        + MIFFLIN_HEIGHT_COEFFICIENT * height_cm
        - MIFFLIN_AGE_COEFFICIENT * age
        + sex_offset[sex],
        1,
    )


def activity_multiplier(
    level: str, multipliers: dict[str, float] = ACTIVITY_MULTIPLIERS
) -> float:
    """The chosen multiplier for an activity level. Raises on an unknown one.

    Raising rather than defaulting to sedentary: a silent fallback would make a
    typo in a stored level read as a real, plausible, wrong TDEE.
    """
    if level not in multipliers:
        raise ValueError(f"unknown activity level: {level!r}")
    return multipliers[level]


def estimated_tdee(
    weight_kg: float, height_cm: float, age: int, sex: str, activity_level: str
) -> float:
    """Total daily energy expenditure, estimated from the profile alone.

    "Estimated" is load-bearing: this is a formula applied to five numbers the
    user typed, and it can be out by several hundred kcal for an individual.
    Phase 5 measures the same quantity from logged intake and weight change,
    and that number supersedes this one wherever both exist.

    Phase 7 asked whether logged steps should refine the activity multiplier
    here, since this is the one TDEE a step term could safely reach, and the
    answer was no. This estimate exists for the account that has almost no
    data -- which is the same account that has no step history either -- so the
    refinement would only ever fire for someone logging steps but not meals.
    It would also make today's walking move today's calorie target, which is
    the feedback loop `measured_tdee`'s window deliberately ends yesterday to
    avoid, and it would put a visible step in the target on the day the
    measurement takes over and the step term disappears. Steps are recorded and
    shown; they are an input to nothing.
    """
    bmr = bmr_mifflin_st_jeor(weight_kg, height_cm, age, sex)
    return round(bmr * activity_multiplier(activity_level), 1)


def measured_tdee(
    mean_daily_intake: float,
    weekly_rate_kg: float,
    kcal_per_kg: float = KCAL_PER_KG,
) -> float:
    """Total daily energy expenditure, measured from this person's own data.

    Energy balance, and nothing more: what you ate, minus what your body banked
    as tissue, is what you burned. Both inputs must describe the **same days** --
    a mean intake over one period and a weight slope over another is not an
    energy balance, it is two unrelated numbers subtracted. `RATE_WINDOW_DAYS`
    is what keeps them aligned; see `targets.py`.

    Unlike `estimated_tdee` this needs no height, age, sex or activity guess. It
    observes the individual instead of predicting them from a population, which
    is the whole point: the activity multiplier is the roughest step in the
    formula chain and this replaces it outright rather than tuning it.

    Note for Phase 7 (steps): the number returned here **already contains** the
    energy spent on every step taken during the measurement window. Adding a
    step-derived burn on top of it double-counts, and would tell the user to eat
    several hundred kcal more than they should. Steps may feed `estimated_tdee`,
    never this.
    """
    stored_kcal_per_day = (weekly_rate_kg / 7.0) * kcal_per_kg
    return round(mean_daily_intake - stored_kcal_per_day, 1)


class PlausibleTDEE(NamedTuple):
    """A measured TDEE, and why it is not the number the data implied.

    Same shape and same contract as `TargetCalories`: when `clamped_reason` is
    set the UI is expected to show it, because a silently corrected number
    leaves the user believing inputs that are actually wrong.
    """

    calories: float
    clamped_reason: str | None


def clamp_measured_tdee(
    tdee: float,
    bmr: float,
    bounds: tuple[float, float] = TDEE_PLAUSIBLE_BMR_RANGE,
) -> PlausibleTDEE:
    """Hold a measured TDEE inside a believable band around the person's BMR.

    This is the guard that matters most, and the reason it cannot be left to
    `target_calories`'s existing floor is worth stating plainly: that floor is
    computed as a fraction *of the TDEE itself*, so a TDEE dragged down by
    unlogged meals drags its own safety floor down with it and the check passes.
    Anchoring to BMR instead brings in a quantity that under-logging cannot
    move, because it is derived from body measurements rather than from intake.
    """
    low, high = bounds
    floor, ceiling = bmr * low, bmr * high

    if tdee < floor:
        return PlausibleTDEE(
            calories=float(round(floor)),
            clamped_reason=(
                f"Your logged intake works out to {round(tdee):g} kcal a day "
                f"burned, which is below what your body uses at rest — that is "
                f"not possible, and it usually means some meals aren't being "
                f"logged. Using {round(floor):g} kcal until the logs catch up."
            ),
        )
    if tdee > ceiling:
        return PlausibleTDEE(
            calories=float(round(ceiling)),
            clamped_reason=(
                f"Your logs work out to {round(tdee):g} kcal a day burned, which "
                f"is higher than this calculation can credibly explain — usually "
                f"a mistyped weigh-in. Using {round(ceiling):g} kcal instead."
            ),
        )
    return PlausibleTDEE(calories=float(round(tdee)), clamped_reason=None)


def target_floor(sex: str | None, weight_kg: float | None) -> float:
    """The lowest calorie target set for this person (see MIN_TARGET_KCAL).

    An unrecognised or missing sex falls back to the lower of the two: a floor
    too permissive for this person still beats no floor at all.
    """
    floor = MIN_TARGET_KCAL.get(sex or "", min(MIN_TARGET_KCAL.values()))
    if weight_kg is not None and weight_kg >= HEAVY_WEIGHT_KG:
        floor = max(floor, HEAVY_MIN_TARGET_KCAL)
    return floor


def max_daily_deficit(weight_kg: float) -> float:
    """The loss cap as kcal a day below the burn: 1% of body weight a week,
    never more than 1 kg. Calorie banking holds a single day to this too."""
    kg = min(MAX_LOSS_FRACTION_OF_WEIGHT * weight_kg, MAX_LOSS_KG_PER_WEEK)
    return kg * KCAL_PER_KG / 7


def protein_g_per_kg(
    focus: str | None, applied_rate_kg_per_week: float
) -> tuple[float, float, float]:
    """(target, low, high) grams per kg for the answer and the planned pace."""
    if focus == "muscle":
        return PROTEIN_MUSCLE_LOSING if applied_rate_kg_per_week < 0 else PROTEIN_MUSCLE
    if focus == "scale":
        return PROTEIN_SCALE
    return PROTEIN_UNANSWERED


def protein_reference_weight(weight_kg: float, height_cm: float) -> float:
    """The weight protein and the fat minimum are worked out from: body weight,
    or the weight at BMI 30 for this height if that is lower (Weijs 2024)."""
    return min(weight_kg, PROTEIN_REFERENCE_MAX_BMI * (height_cm / 100) ** 2)


def _floor_applies_to(sex: str | None, weight_kg: float) -> str:
    """Who the binding floor is set for, in the words a refusal uses."""
    sex_floor = MIN_TARGET_KCAL.get(sex or "", min(MIN_TARGET_KCAL.values()))
    if weight_kg >= HEAVY_WEIGHT_KG and sex_floor < HEAVY_MIN_TARGET_KCAL:
        return "anyone over 113 kg"
    return {"male": "men", "female": "women"}.get(sex or "", "you")


def _kg(value: float) -> str:
    return f"{round(value, 2):g}"


def target_calories(
    tdee: float,
    goal_rate_kg_per_week: float,
    sex: str,
    weight_kg: float,
    height_cm: float,
) -> TargetCalories:
    """Daily calories for a requested rate of weight change, within the limits.

    Every limit that changes the answer says so with its numbers: what was
    asked, what is planned, and which limit decided it (the constants above,
    each with its source). A target that silently disagrees with the rate the
    user chose is worse than no target, because the user goes on believing the
    rate.
    """
    floor = target_floor(sex, weight_kg)
    bmi_now = weight_kg / (height_cm / 100) ** 2
    underweight = bmi_now < UNDERWEIGHT_BMI

    by_weight = min(MAX_LOSS_FRACTION_OF_WEIGHT * weight_kg, MAX_LOSS_KG_PER_WEEK)
    by_floor = max(0.0, (tdee - floor) * 7 / KCAL_PER_KG)
    max_loss = min(by_weight, by_floor)
    max_gain = min(MAX_GAIN_FRACTION_OF_WEIGHT * weight_kg, MAX_GAIN_KG_PER_WEEK)
    if underweight:
        max_gain = min(
            max(max_gain, UNDERWEIGHT_SURPLUS_KCAL * 7 / KCAL_PER_KG),
            MAX_GAIN_KG_PER_WEEK,
        )

    reasons: list[str] = []
    asked = goal_rate_kg_per_week
    rate = asked
    loss_refused = False
    if asked < 0 and underweight:
        rate = 0.0
        loss_refused = True
        reasons.append(
            "Your weight is below the healthy range for your height (a BMI "
            "under 18.5), so this plans to maintain rather than lose."
        )
    elif asked < 0 and -asked > max_loss + 1e-9:
        rate = -max_loss
        if by_floor < by_weight:
            why = (
                f"any faster would take you below {round(floor):,} kcal a day, "
                f"the lowest target set for {_floor_applies_to(sex, weight_kg)}"
            )
        elif by_weight < MAX_LOSS_KG_PER_WEEK:
            why = "1% of your body weight a week is the most it plans"
        else:
            why = "1 kg a week is the most it plans"
        reasons.append(
            f"You asked to lose {_kg(-asked)} kg a week; {why}, so it plans "
            f"{_kg(max_loss)} kg."
        )
    elif asked > 0 and asked > max_gain + 1e-9:
        rate = max_gain
        why = (
            "an extra 500 kcal a day is the most it plans below a healthy weight"
            if underweight and max_gain > MAX_GAIN_FRACTION_OF_WEIGHT * weight_kg
            else "half a percent of your body weight a week is the most it plans"
            if max_gain < MAX_GAIN_KG_PER_WEEK
            else "1 kg a week is the most it plans"
        )
        reasons.append(
            f"You asked to gain {_kg(asked)} kg a week; {why}, so it plans "
            f"{_kg(max_gain)} kg."
        )

    calories = tdee + (rate * KCAL_PER_KG) / 7
    if calories < floor:
        # Only when the estimated burn itself is below the floor: the floor
        # then means eating slightly above it.
        reasons.append(
            f"Raised to {round(floor):,} kcal, the lowest target set for you; "
            f"your estimated burn of {round(tdee):,} kcal is below it."
        )
        calories = floor

    return TargetCalories(
        # Whole kcal. Anything finer is false precision on a number built from
        # a formula with a several-hundred-kcal error bar.
        calories=float(round(calories)),
        clamped_reason=" ".join(reasons) if reasons else None,
        requested_rate=asked,
        applied_rate=round(rate, 3),
        max_loss_kg_per_week=round(max_loss, 3),
        max_gain_kg_per_week=round(max_gain, 3),
        floor_kcal=floor,
        loss_refused=loss_refused,
    )


def macro_targets(
    calories: float,
    weight_kg: float,
    protein_g_per_kg: float = PROTEIN_G_PER_KG,
    fat_fraction: float = FAT_FRACTION_OF_CALORIES,
    protein_g: float | None = None,
) -> dict[str, float | bool]:
    """Split a calorie target into protein / carbs / fat, in whole grams.

    Protein comes off body weight and fat off total calories, so carbohydrate
    absorbs the remainder. That ordering is the point: a fixed percentage split
    would make protein *fall* as the calorie target falls, which is backwards
    during a cut, when protein matters most and calories least.

    `protein_g` is protein the user typed instead. Calories stay worked out
    and the same rule fills the rest, with one addition: protein above the
    worked-out amount comes out of fat first, down to MIN_FAT_G_PER_KG, before
    carbohydrate loses anything, because carbohydrate is what fuels training.
    Protein typed below it leaves fat at its quarter and carbohydrate gains.
    Decided 2026-10-13 after a prototype: taking it from carbohydrate first
    left almost no carbohydrate at the protein a lifter types.

    Fat never drops below MIN_FAT_G_PER_KG, so at a low target it can take
    more than a quarter of calories. If carbohydrate would still go below zero
    with fat at its quarter, fat drops to that minimum first; past that,
    protein and the fat minimum alone exceed the budget. Carbohydrate is then
    zero, the split no longer sums to `calories`, and `fits` is False so the
    caller can say so rather than paper over it.
    """
    auto_g = protein_g_per_kg * weight_kg
    protein = auto_g if protein_g is None else protein_g
    min_fat_g = MIN_FAT_G_PER_KG * weight_kg
    normal_fat_g = max((fat_fraction * calories) / KCAL_PER_G_FAT, min_fat_g)
    extra_kcal = max(0.0, protein - auto_g) * KCAL_PER_G_PROTEIN
    fat_g = max(min_fat_g, normal_fat_g - extra_kcal / KCAL_PER_G_FAT)

    def carbs_left(fat: float) -> float:
        return (
            calories - protein * KCAL_PER_G_PROTEIN - fat * KCAL_PER_G_FAT
        ) / KCAL_PER_G_CARB

    carbs_g = carbs_left(fat_g)
    if carbs_g < 0:
        fat_g = min_fat_g
        carbs_g = carbs_left(fat_g)
    # A hair of slack: at exactly the largest protein that fits, float error
    # can leave carbohydrate a billionth of a gram below zero.
    fits = carbs_g > -1e-6

    # Whole grams, for the same reason calories are whole: the inputs do not
    # support a decimal place.
    return {
        "protein": float(round(protein)),
        "carbs": float(round(max(carbs_g, 0.0))),
        "fat": float(round(fat_g)),
        "fits": fits,
    }


def max_protein_g(calories: float, weight_kg: float) -> int:
    """The most protein that fits a calorie target: everything but the fat
    minimum, with carbohydrate at zero. What a refusal tells you to lower to."""
    return math.floor(
        (calories - MIN_FAT_G_PER_KG * weight_kg * KCAL_PER_G_FAT)
        / KCAL_PER_G_PROTEIN
    )


# CONVENTION. Millilitres of water per kilogram of body weight per day. The
# guidance usually quoted is 30-35 ml/kg; 35 is the top of that band, chosen
# because the failure modes are not symmetric -- a goal slightly too high is a
# glass of water, a goal too low is a tracker that says "done" before you are.
# Nothing about this is measured, it varies with climate, activity and diet,
# and it is why the UI shows the arithmetic next to the answer rather than the
# answer alone.
WATER_ML_PER_KG = 35.0

# CONVENTION. What to show when there is no weigh-in to derive from. 2 litres
# is the folk figure, which is exactly why it is the fallback and not the
# formula: it is a reasonable default for an unknown adult and a poor one for
# any specific adult. `WaterGoalBasis.source` says when this is being used, so
# the UI can ask for a weigh-in instead of quietly presenting it as personal.
WATER_DEFAULT_GOAL_ML = 2000.0

# CONVENTION. The quick-add amounts a new account starts with: a glass, a large
# glass, and a small bottle. Settable per user, so this is only a starting
# point. A tuple, not a list, so nothing can mutate the shipped default.
DEFAULT_WATER_QUICK_ADDS = (250.0, 500.0, 750.0)


class WaterGoal(NamedTuple):
    """A daily water goal, and where the number came from.

    `source` is what the UI renders the explanation from -- the standing rule
    that no derived number reaches the screen without its inputs beside it. The
    three cases genuinely differ: "custom" is the user's own figure and needs no
    justification, "weight" has arithmetic worth showing, and "default" is a
    stand-in that should invite a weigh-in rather than look personal.
    """

    ml: float
    source: str  # "custom" | "weight" | "default"
    ml_per_kg: float | None
    weight_kg: float | None


def water_goal(
    weight_kg: float | None,
    custom_ml: float | None = None,
    ml_per_kg: float = WATER_ML_PER_KG,
) -> WaterGoal:
    """Resolve the daily water goal from the user's own figure or their weight.

    A stored `custom_ml` always wins: the user overrode the derivation on
    purpose, and a goal that silently drifted with their weight after they set
    it by hand would be the app overruling them.

    Deliberately takes the *smoothed* trend weight rather than the latest
    reading, because that is the app's single definition of what someone
    weighs -- and because a goal that jumped every time the scale caught a
    litre of yesterday's water would be circular in a way that is almost funny.
    """
    if custom_ml is not None:
        return WaterGoal(
            ml=float(custom_ml), source="custom", ml_per_kg=None, weight_kg=None
        )
    if weight_kg is None:
        return WaterGoal(
            ml=WATER_DEFAULT_GOAL_ML,
            source="default",
            ml_per_kg=None,
            weight_kg=None,
        )
    # Rounded to 50 ml. The inputs do not support finer than that, and
    # "2,447 ml" reads as a measurement of something rather than as the rule of
    # thumb it is.
    ml = round(ml_per_kg * weight_kg / 50.0) * 50.0
    return WaterGoal(
        ml=float(ml), source="weight", ml_per_kg=ml_per_kg, weight_kg=weight_kg
    )


# CONVENTION. Kilocalories burned per step, per kilogram of body weight. Around
# 350 kcal for 10,000 steps at 70 kg, which is the middle of the range the
# common estimates land in. It ignores pace, stride, terrain, gradient and
# fitness, every one of which moves the real figure -- so this is a rule of
# thumb for putting walking on a scale the user recognises, not a measurement.
#
# It feeds a caption and nothing else. See `estimated_tdee` and `measured_tdee`
# for why no TDEE anywhere takes this as an input.
KCAL_PER_STEP_PER_KG = 0.0005


def steps_burn(steps: int, weight_kg: float | None) -> float | None:
    """Roughly what walking that many steps costs, or None without a weight.

    Returns None rather than raising or substituting an average body weight,
    the same choice `bmi` makes: the number is unanswerable without the input,
    and a stand-in weight would produce a personal-looking figure that is not
    about this person. The caller shows the count alone in that case.
    """
    if weight_kg is None or steps <= 0:
        return None
    return round(KCAL_PER_STEP_PER_KG * weight_kg * steps, 1)
