"""GET /api/settings/targets, and the targets_auto write-back.

The arithmetic itself is covered in test_calculations.py. What is tested here
is the wiring: what the endpoint reports when the profile is incomplete, and
the two paths that rewrite the stored goals.
"""
from datetime import date, timedelta

import pytest

BASE_SETTINGS = {
    "calorie_goal": 2000, "protein_goal": 150, "carbs_goal": 250,
    "fat_goal": 70, "track_carbs": True, "track_fat": True,
}

FULL_PROFILE = {
    "height_cm": 180.0,
    "birth_date": "1990-05-04",
    "sex": "male",
    "activity_level": "moderate",
    "goal_rate_kg_per_week": -0.5,
}


def set_profile(client, **overrides):
    body = {**BASE_SETTINGS, **FULL_PROFILE, **overrides}
    response = client.put("/api/settings", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def weigh_in(client, weight_kg, days_ago=0):
    day = date.today() - timedelta(days=days_ago)
    response = client.post(
        "/api/weights", json={"date": day.isoformat(), "weight_kg": weight_kg}
    )
    assert response.status_code == 200, response.text
    return response.json()


def log_meal(client, calories, days_ago, name="Seeded"):
    day = date.today() - timedelta(days=days_ago)
    response = client.post(
        "/api/meals",
        json={
            "date": day.isoformat(),
            "name": name,
            "calories": calories,
            "protein": 100.0,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def seed_measurable_history(
    client, days=20, calories=2700.0, start_kg=80.0, kg_per_week=0.0
):
    """A window dense enough to measure: a weigh-in and a meal on every day.

    Ends *yesterday*, deliberately, so a test can add today separately and
    observe whether today leaks into the measurement.
    """
    for days_ago in range(1, days + 1):
        elapsed_weeks = (days - days_ago) / 7.0
        weigh_in(client, start_kg + kg_per_week * elapsed_weeks, days_ago=days_ago)
        log_meal(client, calories, days_ago=days_ago)


def targets(client):
    response = client.get("/api/settings/targets")
    assert response.status_code == 200, response.text
    return response.json()


def test_targets_names_everything_missing_on_a_fresh_account(client):
    """An empty profile is an ordinary state, so this is a 200 with reasons."""
    body = client.get("/api/settings/targets").json()

    assert body["missing"] == [
        "weight", "height_cm", "birth_date", "sex",
        "activity_level", "goal_rate_kg_per_week",
    ]
    assert body["target_calories"] is None
    assert body["bmi"] is None


def test_bmi_appears_before_the_rest_of_the_profile_does(client):
    """BMI needs two of the six fields, so it is the first number to show up.

    Withholding it until the whole profile is filled in would mean a new user
    who has logged one weigh-in and their height sees nothing at all.
    """
    set_profile(client, birth_date=None, sex=None, activity_level=None,
                goal_rate_kg_per_week=None)
    weigh_in(client, 80)

    body = client.get("/api/settings/targets").json()
    assert body["bmi"] == 24.7
    assert body["target_calories"] is None
    assert "height_cm" not in body["missing"]
    assert "sex" in body["missing"]


def test_targets_are_computed_once_the_profile_is_complete(client):
    set_profile(client)
    weigh_in(client, 80)

    body = client.get("/api/settings/targets").json()
    assert body["missing"] == []
    # 10(80) + 6.25(180) - 5(36) + 5 = 1750 for a user born 1990-05-04, then
    # x1.70 for "moderate" = 2975, then -550/day for -0.5 kg/week.
    assert body["bmr"] > 1700
    assert body["tdee"] > body["bmr"]
    assert body["target_calories"] < body["tdee"]
    assert body["clamped_reason"] is None


def test_the_weight_used_is_reported_with_the_date_it_was_logged(client):
    """No derived number reaches the UI without its inputs beside it.

    Body weight is the input most likely to be quietly stale, so the endpoint
    hands back which weigh-in it used rather than only what it concluded.
    """
    set_profile(client)
    weigh_in(client, 82, days_ago=3)

    body = client.get("/api/settings/targets").json()
    assert body["weight_kg"] == 82
    assert body["weight_date"] == (date.today() - timedelta(days=3)).isoformat()


def test_a_stale_weigh_in_does_not_silently_drive_a_target(client):
    """Deriving today's calories from a weight six months old is a wrong answer
    that looks exactly like a right one."""
    set_profile(client)
    weigh_in(client, 80, days_ago=200)

    body = client.get("/api/settings/targets").json()
    assert "weight" in body["missing"]
    assert body["target_calories"] is None


def test_an_over_ambitious_rate_is_answered_with_an_explanation(client):
    set_profile(client, goal_rate_kg_per_week=-3)
    weigh_in(client, 80)

    body = client.get("/api/settings/targets").json()
    # 1% of 80 kg is 0.8 kg a week: the reason names what was asked and what
    # is planned, and the same limits travel as data for the screens.
    assert body["clamped_reason"] is not None
    assert "You asked to lose 3 kg a week" in body["clamped_reason"]
    assert "plans 0.8 kg" in body["clamped_reason"]
    assert body["applied_rate_kg_per_week"] == -0.8
    assert body["max_loss_kg_per_week"] == 0.8
    assert body["floor_kcal"] == 1500


def test_targets_auto_rewrites_the_goals_on_save(client):
    saved = set_profile(client)
    weigh_in(client, 80)
    assert saved["calorie_goal"] == 2000  # still manual at this point

    saved = set_profile(client, targets_auto=True)
    targets = client.get("/api/settings/targets").json()
    assert saved["calorie_goal"] == targets["target_calories"]
    assert saved["protein_goal"] == targets["protein_g"]
    assert saved["carbs_goal"] == targets["carbs_g"]
    assert saved["fat_goal"] == targets["fat_g"]


def test_targets_auto_ignores_the_goals_the_client_submits(client):
    """The goal inputs are read-only in the UI, but the server is the enforcer."""
    set_profile(client)
    weigh_in(client, 80)
    saved = set_profile(client, targets_auto=True, calorie_goal=9999)
    assert saved["calorie_goal"] != 9999


def test_a_weigh_in_moves_an_auto_target(client):
    """Otherwise the target lags the weight by however long it takes the user
    to next open Settings — the static-number problem this feature exists for."""
    set_profile(client)
    weigh_in(client, 90)
    heavier = set_profile(client, targets_auto=True)["calorie_goal"]

    weigh_in(client, 80)
    lighter = client.get("/api/settings").json()["calorie_goal"]

    assert lighter < heavier


def test_a_weigh_in_leaves_manual_goals_alone(client):
    set_profile(client, targets_auto=False, calorie_goal=2345)
    weigh_in(client, 80)
    assert client.get("/api/settings").json()["calorie_goal"] == 2345


def test_targets_auto_stays_on_when_the_profile_is_incomplete(client):
    """Switching it off behind the user's back would be a silent decision.

    The flag stays set and starts working the moment the missing field lands.
    """
    saved = set_profile(client, targets_auto=True, height_cm=None)
    assert saved["targets_auto"] is True
    assert saved["calorie_goal"] == 2000  # untouched, not zeroed

    weigh_in(client, 80)
    saved = set_profile(client, targets_auto=True)
    assert saved["calorie_goal"] != 2000


def test_turning_auto_off_leaves_the_computed_goals_editable(client):
    set_profile(client)
    weigh_in(client, 80)
    computed = set_profile(client, targets_auto=True)["calorie_goal"]

    saved = set_profile(client, targets_auto=False, calorie_goal=computed)
    assert saved["targets_auto"] is False
    # Macros that fit inside the typed calories, which a typed target must.
    saved = set_profile(
        client, targets_auto=False, calorie_goal=1234,
        protein_goal=100, carbs_goal=100, fat_goal=30,
    )
    assert saved["calorie_goal"] == 1234


def test_targets_requires_authentication(anon_client):
    assert anon_client.get("/api/settings/targets").status_code == 401


# --- measured TDEE wiring -----------------------------------------------------


def test_a_dense_history_is_measured_rather_than_estimated(client):
    set_profile(client)
    seed_measurable_history(client)

    body = targets(client)

    assert body["tdee_source"] == "measured"
    assert body["tdee_basis"]["unavailable_reason"] is None
    assert body["tdee_basis"]["logged_days"] == 20
    assert body["tdee_basis"]["weigh_ins"] == 20


def test_a_stable_weight_measures_tdee_as_the_intake_that_held_it(client):
    """The definition, end to end: eat 2700 and hold weight, and you burn 2700."""
    set_profile(client)
    seed_measurable_history(client, calories=2700.0, kg_per_week=0.0)

    body = targets(client)

    assert body["tdee_source"] == "measured"
    assert body["tdee"] == pytest.approx(2700, abs=5)


def test_the_formula_estimate_is_kept_even_once_measurement_wins(client):
    """Both numbers travel, so the card can show them side by side.

    Agreement is reassuring and divergence is diagnostic; neither is visible if
    the estimate is thrown away the moment it stops driving the target.
    """
    set_profile(client)
    seed_measurable_history(client)

    body = targets(client)

    assert body["tdee_source"] == "measured"
    assert body["tdee_estimated"] is not None
    assert body["tdee_estimated"] != body["tdee"]


def test_todays_partial_logging_cannot_move_a_measured_tdee(client):
    """Regression: the 223 kcal error found against real data.

    Today is a half-logged day -- breakfast in, dinner not yet -- so averaging
    it in as a finished day understates intake, which understates the measured
    burn, which tells the user to eat less. Against the live account this moved
    a 14-day TDEE from 2589 to 2366 kcal. Same class as the Phase 0.6 dashboard
    bug, and worse here because the number drives a target rather than a chart.

    It also closes a feedback loop: if today's meals moved today's target, the
    goal would rise as the user ate towards it.
    """
    set_profile(client)
    seed_measurable_history(client)
    before = targets(client)

    # A deliberately tiny partial day, plus this morning's weigh-in.
    log_meal(client, 300.0, days_ago=0, name="Just breakfast")
    weigh_in(client, 80.0, days_ago=0)

    after = targets(client)

    assert after["tdee"] == before["tdee"]
    assert after["tdee_basis"]["mean_intake"] == before["tdee_basis"]["mean_intake"]


def test_too_few_weigh_ins_falls_back_without_calling_the_profile_incomplete(client):
    """Falling back is not a failure -- the user still gets a working target.

    So `missing` must stay empty: listing the shortfall there would make a
    complete profile read as incomplete forever, and the UI would ask for a
    field the user has already filled in.
    """
    set_profile(client)
    for days_ago in range(1, 21):
        log_meal(client, 2700.0, days_ago=days_ago)
    weigh_in(client, 80.0, days_ago=1)

    body = targets(client)

    assert body["tdee_source"] == "estimated"
    assert body["missing"] == []
    assert body["target_calories"] is not None
    assert body["tdee_basis"]["unavailable_reason"] is not None
    assert "Weigh in on" in body["tdee_basis"]["unavailable_reason"]


def test_a_refusal_still_reports_the_meals_that_were_logged(client):
    """A count that is wrong in the payload is wrong even if no card draws it.

    This account logged meals every day for three weeks and simply has not
    weighed in. Reporting `logged_days: 0` at them because the weigh-in guard
    fired first would be a number that contradicts what they actually did.
    """
    set_profile(client)
    for days_ago in range(1, 21):
        log_meal(client, 2700.0, days_ago=days_ago)
    weigh_in(client, 80.0, days_ago=1)

    basis = targets(client)["tdee_basis"]

    assert basis["unavailable_reason"] is not None
    assert basis["logged_days"] == 20


def test_a_short_span_of_weigh_ins_is_refused_with_its_own_reason(client):
    """Enough weigh-ins, too few days between them: the slope is noise.

    Ten weigh-ins crammed into ten days produced 2700 kcal against a formula
    estimate of 2498 on real data, because trend weight had moved -0.01 kg.
    """
    set_profile(client)
    for days_ago in range(1, 11):
        weigh_in(client, 80.0, days_ago=days_ago)
        log_meal(client, 2700.0, days_ago=days_ago)

    body = targets(client)

    assert body["tdee_source"] == "estimated"
    assert "at least" in body["tdee_basis"]["unavailable_reason"]


def test_sparse_meal_logging_is_refused_even_with_daily_weigh_ins(client):
    """The average stands in for unlogged days, so too few of them is a guess."""
    set_profile(client)
    for days_ago in range(1, 21):
        weigh_in(client, 80.0, days_ago=days_ago)
    for days_ago in range(1, 6):
        log_meal(client, 2700.0, days_ago=days_ago)

    body = targets(client)

    assert body["tdee_source"] == "estimated"
    assert "logged meals on" in body["tdee_basis"]["unavailable_reason"]


def test_an_incomplete_profile_reports_no_basis_at_all(client):
    """`missing` is still the answer when the profile itself is the blocker."""
    set_profile(client, height_cm=None)
    seed_measurable_history(client)

    body = targets(client)

    assert "height_cm" in body["missing"]
    assert body["tdee_basis"] is None


def test_a_measured_tdee_drives_the_auto_written_goals(client):
    """The point of the phase: the stored goals come from the measurement."""
    set_profile(client, targets_auto=True)
    seed_measurable_history(client, calories=2700.0, kg_per_week=0.0)

    body = targets(client)
    stored = client.get("/api/settings").json()

    assert body["tdee_source"] == "measured"
    assert stored["calorie_goal"] == pytest.approx(body["target_calories"], abs=1)


# --- target_set: whether a target was ever chosen (migration 0020) ----------
#
# Every signup starts at 2000/150/250/70, so first use needs the server to say
# whether any of that was chosen. The flag only ever turns on.


def settings(client):
    return client.get("/api/settings").json()


def test_a_new_account_has_not_set_a_target(client):
    assert settings(client)["target_set"] is False


def test_saving_the_untouched_defaults_does_not_set_a_target(client):
    # A Settings save sends all four goals every time; sending back the
    # defaults it read is not a choice.
    saved = client.put("/api/settings", json={**BASE_SETTINGS, "target_set": False})
    assert saved.json()["target_set"] is False


# 2400 rather than 2200 below: BASE_SETTINGS tracks carbs and fat, and the
# signup default macros need 2,230 kcal, so a typed target has to clear that.


def test_changing_a_goal_sets_the_target(client):
    saved = client.put("/api/settings", json={**BASE_SETTINGS, "calorie_goal": 2400})
    assert saved.json()["target_set"] is True


def test_a_typed_target_equal_to_the_defaults_can_still_be_chosen(client):
    # "I have my own numbers" with exactly 2,000 kcal is still a choice, so the
    # client says so explicitly.
    chosen = client.put("/api/settings", json={**BASE_SETTINGS, "target_set": True})
    assert chosen.json()["target_set"] is True


def test_the_target_flag_never_turns_off(client):
    client.put("/api/settings", json={**BASE_SETTINGS, "calorie_goal": 2400})
    # A form that read the flag before the save above sends back false.
    stale = client.put(
        "/api/settings", json={**BASE_SETTINGS, "calorie_goal": 2400, "target_set": False}
    )
    assert stale.json()["target_set"] is True
    # And a bundle that predates the field sends nothing at all.
    older = client.put("/api/settings", json={**BASE_SETTINGS, "calorie_goal": 2400})
    assert older.json()["target_set"] is True


def test_auto_targets_set_the_target_only_once_they_can_be_worked_out(client):
    # The profile alone cannot produce a number: there is no weigh-in yet, so
    # the goals are still the shipped defaults and nothing has been chosen.
    assert set_profile(client, targets_auto=True)["target_set"] is False

    # The first weigh-in completes it, the formula writes real goals, and from
    # then on a target exists. This is setup's save order: weigh-in, then the
    # profile, though either order ends here (the next test).
    weigh_in(client, 80.0)
    assert settings(client)["target_set"] is True


def test_the_target_flag_is_in_the_export(client):
    client.put("/api/settings", json={**BASE_SETTINGS, "calorie_goal": 2400})
    exported = client.get("/api/data/export/all").json()["settings"]
    assert exported["target_set"] is True


def test_a_weigh_in_before_the_profile_also_sets_the_target(client):
    weigh_in(client, 80.0)
    assert settings(client)["target_set"] is False
    assert set_profile(client, targets_auto=True)["target_set"] is True



# --- protein by goal (migration 0021) ----------------------------------------


def test_protein_follows_what_matters_most_and_shows_its_range(client):
    weigh_in(client, 80.0)
    set_profile(client, targets_auto=True)  # losing 0.5 kg a week

    unanswered = targets(client)
    assert unanswered["protein_g"] == 144  # 1.8 g/kg, as before
    assert (unanswered["protein_low_g"], unanswered["protein_high_g"]) == (128, 176)

    set_profile(client, targets_auto=True, protein_focus="muscle")
    muscle = targets(client)
    assert muscle["protein_g"] == 176  # 2.2 g/kg while losing
    assert settings(client)["protein_goal"] == 176

    set_profile(client, targets_auto=True, protein_focus="scale")
    assert targets(client)["protein_g"] == 112  # 1.4 g/kg


def test_above_bmi_30_protein_uses_the_weight_at_bmi_30(client):
    weigh_in(client, 140.0)
    set_profile(client, targets_auto=True, protein_focus="scale")  # 180 cm

    body = targets(client)
    assert body["protein_reference_kg"] == 97.2
    assert body["protein_g"] == 136  # 1.4 x 97.2, not 1.4 x 140 = 196


# --- targets follow weigh-in changes and the goal ------------------------------


def test_deleting_a_weigh_in_recomputes_the_target_without_it(client):
    """A mistyped weigh-in deleted must not leave a target built on it."""
    weigh_in(client, 80.0, days_ago=1)
    set_profile(client, targets_auto=True)
    before = settings(client)["calorie_goal"]

    typo = weigh_in(client, 180.0)  # 180 instead of 80
    assert settings(client)["calorie_goal"] != before

    assert client.delete(f"/api/weights/{typo['id']}").status_code == 204
    assert settings(client)["calorie_goal"] == before


def test_at_the_goal_weight_the_plan_maintains_and_says_so(client):
    weigh_in(client, 80.0)
    set_profile(client, targets_auto=True, goal_weight_kg=80.0)  # losing 0.5

    body = targets(client)
    assert body["goal_reached"] is True
    assert body["applied_rate_kg_per_week"] == 0
    assert body["target_calories"] == round(body["tdee"])
    assert "reached your goal weight of 80 kg" in body["clamped_reason"]


def test_short_of_the_goal_the_plan_keeps_heading_for_it(client):
    weigh_in(client, 80.0)
    set_profile(client, targets_auto=True, goal_weight_kg=75.0)

    body = targets(client)
    assert body["goal_reached"] is False
    assert body["applied_rate_kg_per_week"] == -0.5


def test_a_gaining_plan_maintains_once_the_goal_is_reached(client):
    weigh_in(client, 80.0)
    set_profile(
        client, targets_auto=True, goal_weight_kg=79.95, goal_rate_kg_per_week=0.25
    )
    assert targets(client)["goal_reached"] is True


def test_typed_macros_must_fit_inside_the_typed_calories(client):
    # Protein is always tracked: 400 g is 1,600 kcal, past a 1,500 target.
    refused = client.put("/api/settings", json={
        **BASE_SETTINGS, "track_carbs": False, "track_fat": False,
        "calorie_goal": 1500, "protein_goal": 400,
    })
    assert refused.status_code == 422
    assert "Protein alone needs 1,600 kcal" in refused.json()["detail"]

    # Tracked carbs and fat count too: 600 + 1,600 + 630 = 2,830 kcal.
    refused = client.put("/api/settings", json={
        **BASE_SETTINGS, "calorie_goal": 2000, "carbs_goal": 400,
    })
    assert refused.status_code == 422
    assert "Protein, carbs and fat need 2,830 kcal" in refused.json()["detail"]

    # Untracked macros are never shown, so they are not counted.
    assert client.put("/api/settings", json={
        **BASE_SETTINGS, "track_carbs": False, "track_fat": False,
        "calorie_goal": 1800, "carbs_goal": 400,
    }).status_code == 200


def test_automatic_targets_are_not_held_to_the_typed_rule(client):
    # The formula writes its own consistent macros; whatever the form sends
    # back alongside targets_auto is ignored, so it is not refused either.
    weigh_in(client, 80.0)
    assert client.put("/api/settings", json={
        **BASE_SETTINGS, **FULL_PROFILE, "targets_auto": True, "calorie_goal": 900,
    }).status_code == 200


# --- setup's live preview (POST /api/settings/targets/preview) ----------------

PREVIEW = {
    "weight_kg": 80.0, "height_cm": 180.0, "birth_date": "1990-05-04",
    "sex": "male", "activity_level": "moderate", "goal_rate_kg_per_week": -0.5,
    "protein_focus": "muscle",
}


def preview(client, **overrides):
    return client.post("/api/settings/targets/preview", json={**PREVIEW, **overrides})


def test_the_preview_is_exactly_what_saving_the_answers_stores(client):
    """The number setup shows is the number saved: one code path for both."""
    shown = preview(client).json()

    weigh_in(client, PREVIEW["weight_kg"])
    set_profile(client, targets_auto=True, protein_focus="muscle")
    stored = settings(client)

    assert stored["calorie_goal"] == shown["target_calories"]
    assert stored["protein_goal"] == shown["protein_g"]
    assert stored["carbs_goal"] == shown["carbs_g"]
    assert stored["fat_goal"] == shown["fat_g"]


def test_the_preview_writes_nothing(client):
    before = settings(client)
    assert preview(client).status_code == 200
    assert settings(client) == before
    assert client.get("/api/weights").json() == []


def test_the_preview_carries_the_limits_before_a_pace_is_picked(client):
    body = preview(client, goal_rate_kg_per_week=-3).json()
    assert body["max_loss_kg_per_week"] == 0.8
    assert body["applied_rate_kg_per_week"] == -0.8
    assert "1% of your body weight" in body["clamped_reason"]
    assert (body["protein_low_g"], body["protein_high_g"]) == (144, 208)


@pytest.mark.parametrize(
    ("overrides", "why"),
    [
        ({"weight_kg": 8}, "typo"),
        ({"height_cm": 17.8}, "typo"),
        ({"weight_kg": 180, "height_cm": 100}, "BMI of 180"),
        ({"weight_kg": 30, "height_cm": 250}, "BMI of 5"),
        ({"birth_date": "2999-01-01"}, "future"),
        ({"sex": "other"}, "not a formula input"),
        ({"goal_rate_kg_per_week": -75}, "a goal weight, not a rate"),
        ({"protein_focus": "bulk"}, "not an answer"),
    ],
)
def test_the_preview_refuses_what_setup_refuses(client, overrides, why):
    assert preview(client, **overrides).status_code == 422, why


def test_a_units_mix_up_says_to_check_the_units(client):
    detail = str(preview(client, weight_kg=180, height_cm=100).json()["detail"])
    assert "check the units" in detail


def test_the_preview_needs_a_signed_in_user(anon_client):
    assert anon_client.post(
        "/api/settings/targets/preview", json=PREVIEW
    ).status_code == 401


def test_the_targets_say_whether_protein_fits(client):
    """protein_fits reaches both responses, False included: on the dataclass
    or the schema alone it would serialise as True.

    Worked-out protein rarely fails to fit, but it can: at 1.80 m and 100 kg
    protein is worked out from 97.2 kg (BMI 30), so keeping muscle is 214 g
    (855 kcal), and the fat minimum is 49 g (437 kcal). A sedentary woman of
    76 burns about 2,218 kcal, so losing 1 kg a week hits the 1,200 floor."""
    weigh_in(client, 100)
    set_profile(
        client, sex="female", activity_level="sedentary", birth_date="1950-05-04",
        goal_rate_kg_per_week=-1.0, protein_focus="muscle",
    )
    body = client.get("/api/settings/targets").json()
    assert body["target_calories"] == 1200
    assert body["protein_fits"] is False
    assert (body["carbs_g"], body["fat_g"]) == (0, 49)

    set_profile(client, sex="male")
    assert client.get("/api/settings/targets").json()["protein_fits"] is True
    assert preview(client).json()["protein_fits"] is True


# --- your own protein, with calories still worked out --------------------------


def own_protein(client, grams, **overrides):
    """Save typed protein with targets_auto on. Returns the response."""
    return client.put(
        "/api/settings",
        json={
            **BASE_SETTINGS, **FULL_PROFILE, "targets_auto": True,
            "protein_focus": "muscle", "protein_own": True,
            "protein_goal": grams, **overrides,
        },
    )


def test_typed_protein_is_kept_and_carbs_and_fat_split_around_it(client):
    weigh_in(client, 80.0)
    set_profile(client, targets_auto=True, protein_focus="muscle")
    auto = targets(client)

    assert own_protein(client, auto["protein_g"] + 27).status_code == 200
    stored, body = settings(client), targets(client)
    # Calories stay worked out; 27 g more protein is 108 kcal, taken out of
    # fat (12 g) while fat is above its minimum, and carbs do not move.
    assert stored["calorie_goal"] == auto["target_calories"]
    assert stored["protein_goal"] == body["protein_g"] == auto["protein_g"] + 27
    assert stored["fat_goal"] == body["fat_g"] == auto["fat_g"] - 12
    assert stored["carbs_goal"] == body["carbs_g"] == auto["carbs_g"]
    assert body["protein_fits"] is True


def test_the_targets_offer_every_answer_to_what_matters_most(client):
    weigh_in(client, 80.0)
    set_profile(client, targets_auto=True)  # losing 0.5 kg a week
    by_focus = targets(client)["protein_by_focus"]
    assert by_focus == {
        "muscle": {"g": 176, "low_g": 144, "high_g": 208},
        "scale": {"g": 112, "low_g": 96, "high_g": 128},
        "unanswered": {"g": 144, "low_g": 128, "high_g": 176},
    }


def test_typed_protein_that_does_not_fit_is_refused_on_save(client):
    weigh_in(client, 80.0)
    set_profile(client, targets_auto=True, protein_focus="muscle")
    before = settings(client)
    calories = before["calorie_goal"]
    most = int((calories - 40 * 9) // 4)

    refused = own_protein(client, most + 1)
    assert refused.status_code == 422
    assert refused.json()["detail"] == (
        f"Protein at {most + 1:,} g ({(most + 1) * 4:,} kcal) plus fat at its "
        f"minimum (360 kcal) comes to {(most + 1) * 4 + 360:,} kcal, more than "
        f"your {round(calories):,} kcal target. Lower it to {most:,} g or less."
    )
    # Nothing from the refused save was kept.
    assert settings(client) == before

    assert own_protein(client, most).status_code == 200
    stored = settings(client)
    assert (stored["protein_goal"], stored["fat_goal"]) == (most, 40)


def test_a_weigh_in_and_its_delete_keep_typed_protein(client):
    weigh_in(client, 80.0, days_ago=1)
    set_profile(client, targets_auto=True, protein_focus="muscle")
    assert own_protein(client, 190).status_code == 200

    entry = weigh_in(client, 78.0)
    assert settings(client)["protein_goal"] == 190
    assert client.delete(f"/api/weights/{entry['id']}").status_code == 204
    assert settings(client)["protein_goal"] == 190


def test_protein_that_stops_fitting_is_kept_and_flagged_not_refused(client):
    weigh_in(client, 80.0, days_ago=1)
    set_profile(client, targets_auto=True, protein_focus="muscle")
    most = int((settings(client)["calorie_goal"] - 40 * 9) // 4)
    assert own_protein(client, most).status_code == 200

    # Less body weight, fewer calories: the typed protein no longer fits.
    weigh_in(client, 60.0)
    stored, body = settings(client), targets(client)
    assert body["protein_fits"] is False
    assert stored["protein_goal"] == most
    # Fat at its minimum, carbs at zero, stored as the 1 g floor.
    assert body["carbs_g"] == 0 and stored["carbs_goal"] == 1
    assert stored["fat_goal"] == round(0.5 * body["protein_reference_kg"])

    # Saving something else still works, and so does sending the same protein.
    unrelated = client.put("/api/settings", json={**stored, "water_goal_ml": 2500})
    assert unrelated.status_code == 200, unrelated.text
    # A new number that still doesn't fit is refused.
    assert client.put(
        "/api/settings", json={**stored, "protein_goal": most + 5}
    ).status_code == 422


def test_typed_protein_is_ignored_while_every_goal_is_typed(client):
    weigh_in(client, 80.0)
    set_profile(client, targets_auto=True, protein_focus="muscle")
    auto = targets(client)
    # Off: the response is the worked-out comparison, not the typed goals.
    saved = own_protein(client, 999, targets_auto=False, calorie_goal=7000)
    assert saved.status_code == 200, saved.text
    assert targets(client)["protein_g"] == auto["protein_g"]


def test_switching_automatic_back_on_checks_typed_protein(client):
    weigh_in(client, 80.0)
    saved = own_protein(client, 999, targets_auto=False, calorie_goal=7000)
    assert saved.status_code == 200, saved.text
    stored = settings(client)
    assert client.put(
        "/api/settings", json={**stored, "targets_auto": True}
    ).status_code == 422


def test_the_review_and_the_day_read_typed_protein(client):
    weigh_in(client, 80.0)
    assert own_protein(client, 190).status_code == 200
    review = client.get("/api/review").json()
    protein = next(c for c in review["checks"] if c["key"] == "protein")
    assert protein["target"] == 190
    day = client.get("/api/plan/day").json()
    assert day["protein_goal"] == 190
