import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.deps import get_current_user
from ..calculations import (
    KCAL_PER_G_CARB,
    KCAL_PER_G_FAT,
    KCAL_PER_G_PROTEIN,
    max_protein_g,
)
from ..db import get_db
from ..models import Setting, User, utcnow
from ..schemas import BodyTargets, Settings, TargetPreviewRequest
from ..targets import (
    TargetsResult,
    apply_auto_targets,
    compute_targets,
    preview_targets,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])

# The fields that are patched rather than replaced. See the note on
# update_settings for why these behave differently from the seven original ones.
#
# Named for the behaviour, not the feature: this began as the body profile and
# is now the body profile, the tracker goals and the weigh-in reminder, and
# every field added from here on joins this group rather than the replaced one.
#
# `water_quick_adds` is patched too but is NOT in this tuple -- it is the one
# field whose schema name and column name differ, so it cannot go through the
# generic setattr below. It is handled explicitly, just after the loop.
_PATCHED_FIELDS = (
    "height_cm",
    "birth_date",
    "sex",
    "activity_level",
    "goal_weight_kg",
    "goal_rate_kg_per_week",
    "targets_auto",
    "water_goal_ml",
    "steps_goal",
    "weigh_in_reminder_time",
    "weigh_in_reminder_days",
    "show_meal_times",
    "protein_focus",
    "protein_own",
)


def _settings_out(row: Setting) -> Settings:
    """Build the response explicitly, rather than letting Pydantic read the row.

    `Settings` is a from_attributes model, so returning the ORM row directly
    works for every field whose name matches its column -- which is all of them
    but one. `water_quick_adds` is a list[float] on the API and
    `water_quick_adds_json` is TEXT in the database, and that divergence is
    exactly the trap this codebase has now hit three times: `UserOut.is_admin`
    silently returned False, `MealTemplate.items` silently returned [], and
    here it would be louder but worse -- Pydantic would be handed a JSON
    *string* for a list field and every GET /api/settings would 500.

    One construction site, the same fix `_user_out` and `_template_out` are.
    """
    data = Settings.model_validate(row).model_dump()
    data["water_quick_adds"] = (
        None if row.water_quick_adds_json is None
        else json.loads(row.water_quick_adds_json)
    )
    data["trackers"] = (
        None if row.trackers_json is None else json.loads(row.trackers_json)
    )
    return Settings.model_validate(data)


def _get_or_create(db: Session, user_id: int) -> Setting:
    # Signup creates the row; this covers accounts that predate that behavior.
    row = db.get(Setting, user_id)
    if row is None:
        row = Setting(user_id=user_id)
        db.add(row)
        db.commit()
    return row


@router.get("", response_model=Settings)
def get_settings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _settings_out(_get_or_create(db, user.id))


@router.post("/installed", response_model=Settings)
def mark_installed(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """The account has the app on a home screen: stop asking it to add one.

    Sent by the installed app the first time it opens, by Chromium's
    `appinstalled` event, and by "I already have it". Keeps the first time
    and never clears it, so every call after the first changes nothing and a
    retry is harmless. Answers with the settings, as a save does, so the
    client's copy updates without another fetch.
    """
    row = _get_or_create(db, user.id)
    if row.installed_at is None:
        row.installed_at = utcnow()
        db.commit()
    return _settings_out(row)


@router.get("/targets", response_model=BodyTargets)
def get_targets(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """BMI, BMR, TDEE and a calorie/macro target from the profile and the logs.

    The TDEE is measured from energy balance where the logs can support it and
    estimated from the Mifflin-St Jeor formula where they cannot; `tdee_source`
    says which, and `tdee_basis` says what it was built from or what it is still
    short of. Both are always populated, so the card never has to guess.

    Read-only and always 200, even when nothing can be computed: an incomplete
    profile is an ordinary state, not an error, and the `missing` list is the
    answer in that case. Everything here is derived on the fly -- the only
    numbers this feature *stores* are the four goals, and only when
    `targets_auto` is on.
    """
    return compute_targets(db, _get_or_create(db, user.id))


@router.post("/targets/preview", response_model=BodyTargets)
def preview_settings_targets(
    body: TargetPreviewRequest,
    user: User = Depends(get_current_user),
):
    """The target first-use setup would save, shown live before it is saved.

    Writes nothing and reads nothing of the account: the answers in the body
    are the whole input. Signed-in only, like everything else here. The limits
    travel as data (max_loss_kg_per_week and the rest) so the screen can say
    the fastest pace before the user picks one.
    """
    return preview_targets(
        body.weight_kg,
        body.height_cm,
        body.birth_date,
        body.sex,
        body.activity_level,
        body.goal_rate_kg_per_week,
        body.protein_focus,
    )


def _refuse_goals_that_cannot_add_up(settings: Settings) -> None:
    """Typed goals whose tracked macros need more calories than the total.

    Protein is always tracked; carbs and fat count only when switched on,
    since an untracked goal is never shown. Checked only when a goal changes,
    so an account saved before this rule can still save everything else.
    Ten kcal of slack covers whole-gram rounding.
    """
    parts = [("protein", settings.protein_goal * KCAL_PER_G_PROTEIN)]
    if settings.track_carbs:
        parts.append(("carbs", settings.carbs_goal * KCAL_PER_G_CARB))
    if settings.track_fat:
        parts.append(("fat", settings.fat_goal * KCAL_PER_G_FAT))
    needed = sum(kcal for _, kcal in parts)
    if needed > settings.calorie_goal + 10:
        names = [name for name, _ in parts]
        which = (
            names[0].capitalize() + " alone needs" if len(names) == 1
            else ", ".join(names[:-1]).capitalize() + f" and {names[-1]} need"
        )
        raise HTTPException(
            status_code=422,
            detail=(
                f"{which} {round(needed):,} kcal a day, more than the "
                f"{round(settings.calorie_goal):,} kcal target. Lower "
                f"{'it' if len(names) == 1 else 'one of them'}, or raise calories."
            ),
        )


def _refuse_protein_that_does_not_fit(result: TargetsResult) -> None:
    """Typed protein that, with fat at its minimum, needs more than the
    worked-out calories. The caller decides when this applies.

    Short on purpose: the answer and the number to type, not the sum. The sum
    (protein kcal plus the fat minimum) read as arithmetic on a phone, so it
    was dropped after a ship-day check, accepting that "too much" can look odd
    when protein alone is just under the target. The rule itself is in
    docs/goal-setting-rules.md."""
    raise HTTPException(
        status_code=422,
        detail=(
            f"Too much protein for your {round(result.target_calories):,} kcal "
            f"target. The most it can be is "
            f"{max_protein_g(result.target_calories, result.protein_reference_kg):,} g."
        ),
    )


@router.put("", response_model=Settings)
def update_settings(
    settings: Settings,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save settings. Two write semantics in one handler, deliberately.

    The original goal and tracking fields are **replaced** on every PUT,
    exactly as they always have been. Everything added since -- the body
    profile, and now the two water fields -- is **patched**: each is written
    only if the request actually contained it.

    The asymmetry buys one specific thing. This app is an installed PWA, so a
    tab opened before a deploy keeps running the old bundle until it is
    reloaded -- for days, on a phone. A client that predates the body profile
    PUTs a body without those keys, and under replace semantics that would
    silently blank the user's height, birth date and sex on their next save,
    and move their targets with it. `model_fields_set` distinguishes "did not
    send" from "sent null", so clearing a field on purpose still works.

    That reasoning is why the water fields joined the patched group on day one
    rather than after a phone somewhere quietly wiped someone's goal.

    When `targets_auto` is on the four submitted goals are ignored and
    recomputed from the profile; the client sends them anyway because the
    schema requires them, and they are what the server last stored.
    """
    row = _get_or_create(db, user.id)
    goals = ("calorie_goal", "protein_goal", "carbs_goal", "fat_goal")
    changed = any(getattr(row, name) != getattr(settings, name) for name in goals)
    if changed and not settings.targets_auto:
        _refuse_goals_that_cannot_add_up(settings)
    # Typed protein is refused only by the save that sets it: a new number,
    # "My own number" switched on, or automatic targets switched back on. One
    # that stopped fitting after a weigh-in is kept and flagged instead
    # (protein_fits), so saving something unrelated still works.
    protein_set_now = (
        row.protein_goal != settings.protein_goal
        or ("protein_own" in settings.model_fields_set
            and settings.protein_own and not row.protein_own)
        or (settings.targets_auto and not row.targets_auto)
    )
    # A changed goal is a chosen target. Compared before the assignment below,
    # because every PUT sends all four whether or not they moved.
    if changed:
        row.target_set = True
    # On only, never off: see schemas.Settings.target_set.
    if "target_set" in settings.model_fields_set and settings.target_set:
        row.target_set = True
    row.calorie_goal = settings.calorie_goal
    row.protein_goal = settings.protein_goal
    row.carbs_goal = settings.carbs_goal
    row.fat_goal = settings.fat_goal
    row.track_carbs = settings.track_carbs
    row.track_fat = settings.track_fat
    row.weight_unit = settings.weight_unit

    for field in _PATCHED_FIELDS:
        if field in settings.model_fields_set:
            setattr(row, field, getattr(settings, field))

    # Out of the loop because the name and the type both change on the way in.
    # Sending null clears it back to the shipped defaults, which is why this is
    # keyed on model_fields_set rather than on the value being non-None.
    # The same conversion as water_quick_adds below. null is accepted and
    # means "not chosen yet" again, which nothing sends on purpose.
    if "trackers" in settings.model_fields_set:
        row.trackers_json = (
            None if settings.trackers is None else json.dumps(settings.trackers)
        )
    if "water_quick_adds" in settings.model_fields_set:
        row.water_quick_adds_json = (
            None if settings.water_quick_adds is None
            else json.dumps(settings.water_quick_adds)
        )

    # After the profile is in place, never before -- targets_auto and the
    # fields it reads are both assigned in the loop above.
    result = apply_auto_targets(row, db)
    if (
        result is not None and row.protein_own and protein_set_now
        and not result.protein_fits
    ):
        # Raised before the commit, so nothing above is saved.
        _refuse_protein_that_does_not_fit(result)
    db.commit()
    return _settings_out(row)
