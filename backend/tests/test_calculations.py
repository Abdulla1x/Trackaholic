from datetime import date, timedelta

import pytest

from app.calculations import (
    DEFAULT_WATER_QUICK_ADDS,
    GOAL_REACHED_TOLERANCE_KG,
    KCAL_PER_G_CARB,
    KCAL_PER_G_FAT,
    KCAL_PER_G_PROTEIN,
    KCAL_PER_KG,
    KCAL_PER_STEP_PER_KG,
    MAX_PROJECTION_WEEKS,
    RATE_WINDOW_DAYS,
    TDEE_PLAUSIBLE_BMR_RANGE,
    WATER_DEFAULT_GOAL_ML,
    WATER_ML_PER_KG,
    TrendPoint,
    activity_multiplier,
    age_years,
    bmi,
    bmr_mifflin_st_jeor,
    clamp_measured_tdee,
    estimated_tdee,
    goal_projection,
    macro_targets,
    measured_tdee,
    scale_macros,
    steps_burn,
    water_goal,
    protein_g_per_kg,
    protein_reference_weight,
    target_calories,
    total_macros,
    weekly_rate,
    weight_trend,
)


def series(weights: list[float], start: date = date(2026, 6, 1), step: int = 1):
    """Weigh-ins `step` days apart, oldest first."""
    return [(start + timedelta(days=i * step), w) for i, w in enumerate(weights)]


def trend_series(trends: list[float], start: date = date(2026, 6, 1), step: int = 1):
    """Already-smoothed points, for testing the slope fit on its own.

    weekly_rate fits the *trend* series, and an EWMA lags a ramp before it
    settles — so feeding raw weights through weight_trend and expecting the raw
    slope back would be testing the lag, not the fit.
    """
    return [
        TrendPoint(start + timedelta(days=i * step), value, value)
        for i, value in enumerate(trends)
    ]


def test_weight_trend_seeds_on_the_first_entry():
    points = weight_trend(series([80.0]))
    assert len(points) == 1
    assert points[0].weight_kg == 80.0
    assert points[0].trend_kg == 80.0


def test_weight_trend_lags_behind_a_jump():
    points = weight_trend(series([80.0, 80.0, 84.0]))
    # alpha=0.25: the trend takes a quarter of the 4 kg spike, not all of it.
    assert points[-1].weight_kg == 84.0
    assert points[-1].trend_kg == pytest.approx(81.0)


def test_weight_trend_converges_on_a_stable_weight():
    points = weight_trend(series([90.0] + [80.0] * 40))
    assert points[-1].trend_kg == pytest.approx(80.0, abs=0.01)


def test_weight_trend_sorts_unordered_entries():
    unsorted = [(date(2026, 6, 3), 82.0), (date(2026, 6, 1), 80.0)]
    points = weight_trend(unsorted)
    assert [p.date for p in points] == [date(2026, 6, 1), date(2026, 6, 3)]
    assert points[0].trend_kg == 80.0


def test_weight_trend_steps_per_entry_not_per_calendar_day():
    """The documented simplification: a gap does not decay the trend faster."""
    daily = weight_trend(series([80.0, 84.0], step=1))
    weekly = weight_trend(series([80.0, 84.0], step=7))
    assert daily[-1].trend_kg == weekly[-1].trend_kg


def test_weekly_rate_is_negative_on_a_losing_trend():
    points = weight_trend(series([85.0 - 0.1 * i for i in range(14)]))
    rate = weekly_rate(points)
    assert rate is not None and rate < 0


def test_weekly_rate_is_positive_on_a_gaining_trend():
    points = weight_trend(series([70.0 + 0.1 * i for i in range(14)]))
    rate = weekly_rate(points)
    assert rate is not None and rate > 0


def test_weekly_rate_is_none_below_the_minimum_points():
    assert weekly_rate(weight_trend(series([80.0]))) is None
    assert weekly_rate(weight_trend(series([80.0] * 6))) is None
    assert weekly_rate(weight_trend(series([80.0] * 7))) is not None


def test_weekly_rate_is_none_without_any_points():
    assert weekly_rate([]) is None


def test_weekly_rate_ignores_entries_before_the_window():
    ancient = trend_series([120.0], start=date(2025, 1, 1))
    recent = trend_series([80.0] * 10, start=date(2026, 6, 1))
    # The 2025 outlier is outside the 28-day window, so it cannot bend the rate.
    assert weekly_rate(ancient + recent) == pytest.approx(0.0, abs=0.001)


def test_weekly_rate_fits_against_calendar_days_not_entry_index():
    """Weekly means seven calendar days, so gaps must not compress the fit."""
    # 0.2 kg per weigh-in, weighing in every second day: 0.1 kg/day = 0.7 kg/week.
    # Fitting against the entry index instead would double it to 1.4.
    every_other_day = trend_series([80.0 - 0.2 * i for i in range(8)], step=2)
    assert weekly_rate(every_other_day) == pytest.approx(-0.7, abs=0.001)


def test_weekly_rate_is_flat_on_an_unchanged_trend():
    assert weekly_rate(trend_series([80.0] * 10)) == 0.0


def test_weight_trend_rejects_an_out_of_range_alpha():
    with pytest.raises(ValueError):
        weight_trend(series([80.0]), alpha=0)
    with pytest.raises(ValueError):
        weight_trend(series([80.0]), alpha=1.5)


def test_scale_macros_scales_by_weight():
    result = scale_macros(200, 100, {"calories": 165, "protein": 31, "carbs": 0, "fat": 3.6})
    assert result == {"calories": 330, "protein": 62, "carbs": 0, "fat": 7.2}


def test_scale_macros_preserves_untracked_none():
    result = scale_macros(150, 100, {"calories": 100, "protein": 10, "carbs": None, "fat": None})
    assert result["calories"] == 150
    assert result["carbs"] is None
    assert result["fat"] is None


def test_scale_macros_rejects_zero_serving():
    with pytest.raises(ValueError):
        scale_macros(100, 0, {"calories": 100})


def test_scale_macros_rejects_negative_weight():
    with pytest.raises(ValueError):
        scale_macros(-5, 100, {"calories": 100})


def test_total_macros_sums_items():
    items = [
        {"calories": 100, "protein": 10, "carbs": 20, "fat": 5},
        {"calories": 50.5, "protein": 4.5, "carbs": None, "fat": 1},
    ]
    assert total_macros(items) == {"calories": 150.5, "protein": 14.5, "carbs": 20, "fat": 6}


def test_total_macros_all_missing_stays_none():
    items = [{"calories": 100, "protein": 10}, {"calories": 50, "protein": 5}]
    totals = total_macros(items)
    assert totals["carbs"] is None
    assert totals["fat"] is None


# --- Body profile → energy targets -------------------------------------------


def test_age_years_counts_the_birthday_itself_as_the_new_age():
    born = date(1990, 5, 4)
    assert age_years(born, on=date(2026, 5, 3)) == 35
    assert age_years(born, on=date(2026, 5, 4)) == 36
    assert age_years(born, on=date(2026, 5, 5)) == 36


def test_age_years_handles_a_december_birthday_in_january():
    assert age_years(date(1990, 12, 31), on=date(2026, 1, 1)) == 35


def test_bmi_is_none_when_either_input_is_missing():
    """Both inputs are optional profile fields, so "unknown" is not an error."""
    assert bmi(None, 180) is None
    assert bmi(80, None) is None
    assert bmi(80, 0) is None


def test_bmi_matches_the_definition():
    # 80 kg / 1.80 m² = 80 / 3.24 = 24.69…
    assert bmi(80, 180) == pytest.approx(24.7, abs=0.05)


def test_bmr_matches_a_hand_worked_mifflin_st_jeor():
    # 10(80) + 6.25(180) - 5(35) + 5 = 800 + 1125 - 175 + 5 = 1755
    assert bmr_mifflin_st_jeor(80, 180, 35, "male") == pytest.approx(1755, abs=0.05)
    # The female offset is -161 rather than +5, a 166 kcal difference.
    assert bmr_mifflin_st_jeor(80, 180, 35, "female") == pytest.approx(1589, abs=0.05)


def test_bmr_rejects_an_unknown_sex_rather_than_guessing():
    with pytest.raises(ValueError):
        bmr_mifflin_st_jeor(80, 180, 35, "unspecified")


def test_bmr_rejects_impossible_measurements():
    with pytest.raises(ValueError):
        bmr_mifflin_st_jeor(0, 180, 35, "male")
    with pytest.raises(ValueError):
        bmr_mifflin_st_jeor(80, 0, 35, "male")


def test_activity_multiplier_raises_rather_than_defaulting_to_sedentary():
    """A silent fallback would make a bad stored level read as a real TDEE."""
    with pytest.raises(ValueError):
        activity_multiplier("athlete")


def test_estimated_tdee_is_bmr_times_the_multiplier():
    # 1755 * 1.70 (moderate) = 2983.5
    assert estimated_tdee(80, 180, 35, "male", "moderate") == pytest.approx(
        2983.5, abs=0.1
    )


@pytest.mark.parametrize(
    ("level", "low", "high"),
    [
        # FAO/WHO/UNU 2001, Table 5.3: measured physical activity levels.
        ("sedentary", 1.40, 1.69),
        ("light", 1.40, 1.69),
        ("moderate", 1.70, 1.99),
        ("active", 1.70, 1.99),
        ("very_active", 2.00, 2.40),
    ],
)
def test_each_activity_level_sits_inside_its_measured_band(level, low, high):
    """The multipliers are sourced, not tuned: moving one out of its band
    means the comment above ACTIVITY_MULTIPLIERS is no longer true."""
    assert low <= activity_multiplier(level) <= high


def test_the_activity_levels_rise_in_order():
    levels = ["sedentary", "light", "moderate", "active", "very_active"]
    values = [activity_multiplier(level) for level in levels]
    assert values == sorted(values) and len(set(values)) == len(values)


def test_target_calories_applies_the_requested_rate_when_it_is_reasonable():
    # -0.5 kg/week * 7700 kcal/kg / 7 days = -550 kcal/day, off a 3000 TDEE.
    result = target_calories(3000, -0.5, "male", 80, 180)
    assert result.calories == 2450
    assert result.clamped_reason is None
    assert result.applied_rate == -0.5


def test_loss_is_capped_at_one_percent_of_body_weight_a_week():
    """Helms 2014: 0.5-1% of body weight a week. 1% of 80 kg is 0.8 kg."""
    result = target_calories(3000, -1, "male", 80, 180)
    assert result.applied_rate == -0.8
    assert result.calories == 3000 - 880
    assert "1% of your body weight" in result.clamped_reason
    assert "0.8 kg" in result.clamped_reason


def test_loss_is_never_more_than_one_kilo_a_week_however_heavy():
    # 1% of 130 kg would be 1.3 kg; the cap is 1 kg, measured burn or not.
    result = target_calories(3500, -1.5, "male", 130, 185)
    assert result.applied_rate == -1.0
    assert result.calories == 3500 - 1100
    assert "1 kg a week is the most" in result.clamped_reason


def test_the_floor_limits_the_pace_and_says_which_floor():
    # 62 kg on a 1600 burn: 1% would be 0.62 kg, but anything past 400 kcal a
    # day (0.36 kg a week) goes under the 1,200 kcal floor for women.
    result = target_calories(1600, -1, "female", 62, 165)
    assert result.calories == 1200
    assert result.max_loss_kg_per_week == pytest.approx(0.364, abs=0.001)
    assert "below 1,200 kcal a day, the lowest target set for women" in (
        result.clamped_reason
    )


def test_over_113_kg_the_floor_is_1500_for_anyone():
    # NHLBI's weight-based guidance: 1,500 kcal or more from 250 lb.
    result = target_calories(2400, -1, "female", 120, 170)
    assert result.floor_kcal == 1500
    assert result.calories == 1500
    assert "anyone over 113 kg" in result.clamped_reason


def test_no_loss_is_planned_below_a_healthy_bmi():
    # 50 kg at 178 cm is a BMI of 15.8: the plan maintains instead.
    result = target_calories(2000, -0.5, "female", 50, 178)
    assert result.loss_refused is True
    assert result.applied_rate == 0
    assert result.calories == 2000
    assert "18.5" in result.clamped_reason


def test_gain_is_capped_at_half_a_percent_of_body_weight_a_week():
    """Iraki 2019: about 0.25-0.5% of body weight a week."""
    result = target_calories(2500, 1, "male", 80, 180)
    assert result.applied_rate == 0.4
    assert result.calories == 2500 + 440
    assert "half a percent" in result.clamped_reason


def test_below_a_healthy_bmi_a_gain_may_add_up_to_500_kcal_a_day():
    """NHS, underweight adults: around 300 to 500 extra calories a day."""
    result = target_calories(2000, 1, "female", 50, 178)
    assert result.calories == 2500
    assert "500 kcal" in result.clamped_reason


def test_a_burn_below_the_floor_is_raised_to_it_and_says_so():
    result = target_calories(1100, 0, "female", 45, 150)
    assert result.calories == 1200
    assert "Raised to 1,200" in result.clamped_reason


def test_target_calories_leaves_a_reasonable_surplus_alone():
    result = target_calories(2500, 0.25, "male", 80, 180)
    assert result.calories == pytest.approx(2775, abs=1)
    assert result.clamped_reason is None


def test_the_limits_are_reported_as_data_not_only_as_prose():
    result = target_calories(3000, -0.5, "male", 80, 180)
    assert result.max_loss_kg_per_week == 0.8
    assert result.max_gain_kg_per_week == 0.4
    assert result.floor_kcal == 1500


def test_macro_targets_sum_back_to_the_calorie_target():
    macros = macro_targets(2400, 80)
    total = (
        macros["protein"] * KCAL_PER_G_PROTEIN
        + macros["carbs"] * KCAL_PER_G_CARB
        + macros["fat"] * KCAL_PER_G_FAT
    )
    # Within the rounding to whole grams, which can move each macro by half a
    # gram — up to about 9 kcal once fat is weighted.
    assert total == pytest.approx(2400, abs=10)


def test_macro_targets_scale_protein_with_body_weight_not_calories():
    """The reason this is not a fixed percentage split.

    Halving the calorie target must not halve protein: during a cut protein is
    the macro that matters most and calories the one that matters least.
    """
    heavy = macro_targets(2400, 100)
    light = macro_targets(2400, 60)
    assert heavy["protein"] > light["protein"]

    cutting = macro_targets(1600, 80)
    maintaining = macro_targets(2400, 80)
    assert cutting["protein"] == maintaining["protein"]


@pytest.mark.parametrize(
    ("focus", "rate", "expected"),
    [
        ("muscle", -0.5, (2.2, 1.8, 2.6)),  # Helms 2014 / ISSN 2017, in a deficit
        ("muscle", 0.0, (1.9, 1.6, 2.2)),   # Iraki 2019
        ("muscle", 0.3, (1.9, 1.6, 2.2)),
        ("scale", -0.5, (1.4, 1.2, 1.6)),   # Leidy 2015
        ("scale", 0.3, (1.4, 1.2, 1.6)),
        (None, -0.5, (1.8, 1.6, 2.2)),      # unanswered: today's value
    ],
)
def test_protein_per_kilo_follows_the_goal_and_what_matters_most(focus, rate, expected):
    assert protein_g_per_kg(focus, rate) == expected


def test_protein_is_worked_out_from_weight_capped_at_bmi_30():
    """Weijs 2024: a maximum weight of BMI 30. 30 x 1.8^2 = 97.2 kg."""
    assert protein_reference_weight(200, 180) == pytest.approx(97.2)
    # At or under BMI 30 it is simply the body weight.
    assert protein_reference_weight(80, 180) == 80
    # The 200 kg test case: 136 g just for the scale, 214 g keeping muscle.
    assert round(1.4 * protein_reference_weight(200, 180)) == 136
    assert round(2.2 * protein_reference_weight(200, 180)) == 214


def test_fat_never_drops_below_half_a_gram_per_kilo():
    """Iraki 2019: 0.5-1.5 g/kg. A quarter of 1,200 kcal is only 33 g."""
    assert macro_targets(1200, 80)["fat"] == 40
    # Above the minimum, fat stays a quarter of calories.
    assert macro_targets(2400, 80)["fat"] == round(2400 * 0.25 / 9)


def test_macro_targets_floor_carbs_at_zero_rather_than_going_negative():
    # 200 kg of body weight against a 1200 kcal target: protein alone is 360 g
    # = 1440 kcal, already over budget before fat is counted.
    macros = macro_targets(1200, 200)
    assert macros["carbs"] == 0
    assert macros["protein"] > 0


# --- measured TDEE (energy balance) ------------------------------------------


def test_measured_tdee_equals_intake_when_weight_is_stable():
    """Holding weight means everything eaten was burned. The definition."""
    assert measured_tdee(2500, 0.0) == pytest.approx(2500)


def test_measured_tdee_subtracts_what_was_stored_as_tissue():
    # Gaining 0.7 kg/week banks 0.7 * 7700 / 7 = 770 kcal a day, so a 3000 kcal
    # intake means 2230 was actually burned.
    assert measured_tdee(3000, 0.7) == pytest.approx(2230, abs=0.1)


def test_measured_tdee_adds_back_what_was_drawn_from_tissue():
    """Losing weight means burning more than was eaten, not less."""
    assert measured_tdee(2000, -0.5) == pytest.approx(
        2000 + (0.5 / 7) * KCAL_PER_KG, abs=0.1
    )


def test_measured_tdee_matches_a_hand_worked_real_case():
    """The production hand-check this phase's thresholds were chosen against.

    Account with 22 logged days averaging 2712.3 kcal and a trend rise of
    0.159 kg/week: 2712.3 - (0.159/7)*7700 = 2537.4.
    """
    assert measured_tdee(2712.3, 0.159) == pytest.approx(2537.4, abs=1.0)


def test_clamp_leaves_a_believable_measurement_alone():
    result = clamp_measured_tdee(2538, bmr=1612)
    assert result.calories == 2538
    assert result.clamped_reason is None


def test_clamp_catches_a_tdee_below_resting_metabolism():
    """The under-logging failure, which is the dangerous one because it is silent.

    Someone logging far less than they eat produces a measured burn beneath
    their own BMR. That is impossible rather than surprising, so it is refused
    and explained rather than passed downstream into a starvation target.
    """
    low, _ = TDEE_PLAUSIBLE_BMR_RANGE
    result = clamp_measured_tdee(1100, bmr=1612)

    assert result.calories == round(1612 * low)
    assert result.clamped_reason is not None
    assert "aren't being logged" in result.clamped_reason


def test_clamp_catches_an_implausibly_high_tdee():
    _, high = TDEE_PLAUSIBLE_BMR_RANGE
    result = clamp_measured_tdee(9000, bmr=1612)

    assert result.calories == round(1612 * high)
    assert "mistyped weigh-in" in result.clamped_reason


def test_the_clamp_floor_is_not_reachable_by_under_logging():
    """Why the clamp anchors to BMR and not to the TDEE itself.

    `target_calories`'s existing floor is a fraction *of the TDEE*, so a TDEE
    dragged down by unlogged meals drags its own floor down with it and passes.
    BMR comes from body measurements, which intake cannot move -- so the same
    bad input that fools one check is caught by the other.
    """
    honest = clamp_measured_tdee(2538, bmr=1612)
    under_logged = clamp_measured_tdee(1200, bmr=1612)

    assert honest.clamped_reason is None
    assert under_logged.clamped_reason is not None
    # The floor did not move with the bad input.
    assert under_logged.calories > 1200


def test_water_goal_is_derived_from_weight_and_rounded_to_50ml():
    goal = water_goal(70.0)
    assert goal.source == "weight"
    assert goal.ml == 2450  # 35 x 70
    # The inputs travel with the answer, so the card can show its working.
    assert goal.ml_per_kg == WATER_ML_PER_KG
    assert goal.weight_kg == 70.0

    # Rounded, because 35 x 71.3 = 2495.5 and "2,496 ml" reads as a
    # measurement of something rather than as a rule of thumb.
    assert water_goal(71.3).ml == 2500


def test_water_goal_falls_back_when_there_is_no_weight():
    goal = water_goal(None)
    assert goal.ml == WATER_DEFAULT_GOAL_ML
    # Says so, rather than presenting the folk figure as personal.
    assert goal.source == "default"
    assert goal.weight_kg is None


def test_a_custom_water_goal_wins_over_the_derivation():
    """A goal the user typed must not drift as their weight changes.

    The override is checked before the weight is even consulted -- otherwise
    someone who set 3 litres deliberately would find the app quietly
    overruling them after a few weigh-ins.
    """
    goal = water_goal(70.0, custom_ml=3000.0)
    assert goal.ml == 3000.0
    assert goal.source == "custom"
    # Nothing to explain, so no inputs are reported.
    assert goal.ml_per_kg is None
    assert goal.weight_kg is None

    # Still wins when there is no weight at all.
    assert water_goal(None, custom_ml=3000.0).ml == 3000.0


def test_the_shipped_quick_adds_are_immutable():
    """A tuple, so a caller cannot mutate the default every account starts from."""
    assert DEFAULT_WATER_QUICK_ADDS == (250.0, 500.0, 750.0)
    with pytest.raises(AttributeError):
        DEFAULT_WATER_QUICK_ADDS.append(1000.0)


def test_the_walking_estimate_scales_with_both_inputs():
    assert steps_burn(10_000, 70.0) == round(KCAL_PER_STEP_PER_KG * 70.0 * 10_000, 1)
    # Twice the steps, twice the cost; twice the body, twice the cost.
    assert steps_burn(20_000, 70.0) == pytest.approx(2 * steps_burn(10_000, 70.0))
    assert steps_burn(10_000, 140.0) == pytest.approx(2 * steps_burn(10_000, 70.0))


def test_the_walking_estimate_is_none_without_a_weight():
    """The same choice bmi makes: unanswerable without the input, so say so.

    Substituting an average body weight would produce a personal-looking figure
    that is not about this person -- the failure `WaterGoalBasis.source` exists
    to keep visible for the water goal.
    """
    assert steps_burn(10_000, None) is None


def test_no_steps_costs_nothing_to_report():
    assert steps_burn(0, 70.0) is None


# --- Goal weight projection ---------------------------------------------------
#
# `trend_series` is used throughout rather than `weight_trend`: it sets each
# point's trend value directly, so these test the projection rather than the
# EWMA's lag underneath it. Same reason the rate tests use it.

LAST_DAY = date(2026, 6, 1) + timedelta(days=9)  # trend_series of ten points


def test_no_goal_weight_is_its_own_answer_not_a_missing_one():
    """A user who has set no goal is not short of data -- they are short of a
    decision, and the UI has a different thing to say about each."""
    result = goal_projection(None, trend_series([80.0] * 10), -0.5, LAST_DAY)
    assert result.status == "no_goal"
    assert result.reach_date is None
    assert result.goal_weight_kg is None


def test_no_weigh_ins_reports_as_no_rate_rather_than_a_status_of_its_own():
    result = goal_projection(78.0, [], None, LAST_DAY)
    assert result.status == "no_rate"
    assert result.goal_weight_kg == 78.0
    assert result.from_date is None


def test_a_goal_within_reach_of_the_trend_reads_as_reached():
    points = trend_series([80.0] * 10)
    assert goal_projection(79.9, points, -0.5, LAST_DAY).status == "reached"
    assert goal_projection(80.1, points, -0.5, LAST_DAY).status == "reached"


def test_the_reached_tolerance_is_exactly_one_decimal_place():
    """0.1 kg is what the scale reports and what the UI prints. A goal that
    rounds to a different displayed number is not reached."""
    points = trend_series([80.0] * 10)
    just_inside = 80.0 - GOAL_REACHED_TOLERANCE_KG
    just_outside = 80.0 - GOAL_REACHED_TOLERANCE_KG - 0.01
    assert goal_projection(just_inside, points, -0.5, LAST_DAY).status == "reached"
    assert goal_projection(just_outside, points, -0.5, LAST_DAY).status != "reached"


def test_reached_is_answered_before_asking_for_more_weigh_ins():
    """Three weigh-ins sitting on the goal get told the thing that is already
    true, rather than asked for a fourth. This is why the order of the checks
    inside goal_projection is part of its design."""
    points = trend_series([78.0, 78.0, 78.0])
    last = points[-1].date
    assert goal_projection(78.0, points, None, last).status == "reached"


def test_reached_survives_a_log_that_stopped_because_from_date_travels_with_it():
    points = trend_series([78.0] * 10)
    result = goal_projection(78.0, points, -0.5, LAST_DAY + timedelta(days=200))
    assert result.status == "reached"
    assert result.from_date == LAST_DAY


def test_a_rate_that_cannot_be_fitted_gives_no_date():
    result = goal_projection(74.0, trend_series([80.0] * 10), None, LAST_DAY)
    assert result.status == "no_rate"
    # The gap is still known and still worth showing, even with no rate.
    assert result.remaining_kg == -6.0


def test_a_log_that_stopped_longer_ago_than_the_rate_window_is_refused():
    """`weekly_rate` windows from the latest weigh-in, so it happily fits a
    slope through a period that is entirely over. A forward date drawn from
    that would be a present-tense claim about a measurement that stopped."""
    points = trend_series([80.0] * 10)
    stale_day = LAST_DAY + timedelta(days=RATE_WINDOW_DAYS + 1)
    assert goal_projection(74.0, points, -0.5, stale_day).status == "stale"


def test_the_staleness_threshold_is_the_rate_window_itself():
    points = trend_series([80.0] * 10)
    on_the_edge = LAST_DAY + timedelta(days=RATE_WINDOW_DAYS)
    assert goal_projection(74.0, points, -0.5, on_the_edge).status == "on_course"


def test_a_flat_trend_gives_no_date_rather_than_an_infinite_one():
    result = goal_projection(74.0, trend_series([80.0] * 10), 0.0, LAST_DAY)
    assert result.status == "holding"
    assert result.reach_date is None
    assert result.remaining_kg == -6.0


def test_a_trend_going_the_wrong_way_says_so():
    """Gaining while aiming lower. The arithmetic would produce a date in the
    past, which is worse than no date."""
    result = goal_projection(74.0, trend_series([80.0] * 10), 0.4, LAST_DAY)
    assert result.status == "moving_away"
    assert result.reach_date is None


def test_overshooting_a_goal_downwards_also_reads_as_moving_away():
    """Goal 78, trend 76 and still falling: the gap is now upwards and the
    trend is not closing it. Accurate, if not flattering."""
    result = goal_projection(78.0, trend_series([76.0] * 10), -0.3, LAST_DAY)
    assert result.status == "moving_away"
    assert result.remaining_kg == 2.0


def test_a_date_past_the_horizon_is_not_named():
    points = trend_series([100.0] * 10)
    result = goal_projection(74.0, points, -0.24, LAST_DAY)
    assert result.status == "too_far"
    assert result.reach_date is None
    # The weeks are still reported, so the UI can say how far off it is.
    assert result.weeks is not None and result.weeks > MAX_PROJECTION_WEEKS


def test_the_horizon_boundary_itself_still_gets_a_date():
    """26 kg at 0.25 kg/week is exactly 104 weeks. Chosen so the division is
    exact in binary and the boundary is really being tested."""
    points = trend_series([100.0] * 10)
    result = goal_projection(74.0, points, -0.25, LAST_DAY)
    assert result.weeks == MAX_PROJECTION_WEEKS
    assert result.status == "on_course"


def test_a_reachable_goal_gets_a_date_and_the_weeks_behind_it():
    points = trend_series([82.0] * 10)
    result = goal_projection(78.0, points, -0.5, LAST_DAY)
    assert result.status == "on_course"
    assert result.remaining_kg == -4.0
    assert result.weeks == 8.0
    assert result.reach_date == LAST_DAY + timedelta(days=56)


def test_the_date_is_anchored_at_the_last_weigh_in_not_at_today():
    """Otherwise the projection slides a day further out for every day someone
    does not stand on the scale, which reads as the goal running away."""
    points = trend_series([82.0] * 10)
    later = goal_projection(78.0, points, -0.5, LAST_DAY + timedelta(days=10))
    assert later.from_date == LAST_DAY
    assert later.reach_date == LAST_DAY + timedelta(days=56)


def test_a_goal_above_the_trend_projects_a_gain():
    points = trend_series([70.0] * 10)
    result = goal_projection(74.0, points, 0.5, LAST_DAY)
    assert result.status == "on_course"
    # Signed towards the goal: positive means there is weight still to gain.
    assert result.remaining_kg == 4.0
    assert result.weeks == 8.0
