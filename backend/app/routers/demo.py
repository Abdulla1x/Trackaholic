"""Try the app without signing up: a temporary account with a month of data.

POST /api/demo makes a new account for each visitor, seeds it (app/demo_seed.py)
and signs them in. One account per visitor rather than one shared account,
because a shared one is a shared notepad: whatever the last visitor typed is
what the next one reads, and nothing stops that being abuse. A private copy
lets a visitor change anything, and it is deleted a day later (app/demo.py).

What bounds it, since anyone can call it without an account:
- DEMO_LIMIT per client IP (rate_limit.py).
- DEMO_DAILY_LIMIT accounts a day for the whole app, counted in demo_starts:
  the same row /admin reads, so the cap and the chart cannot disagree.
- No AI. A demo never reaches the provider (routers/ai.py), so it cannot
  spend the daily quota real accounts share. Its sample meals replay estimates
  saved from real runs (app/demo_samples.py, listed by GET /api/demo/samples).

Every usage number leaves demo accounts out (app/activity.py REAL_USERS).
"""
import secrets
from datetime import date as date_type
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth.deps import get_current_user
from ..auth.router import _user_out
from ..auth.security import create_access_token
from ..db import get_db
from ..demo import DEMO_LIFETIME, purge_expired_demos_quietly
from ..demo_samples import SAMPLES
from ..demo_seed import seed_demo
from ..env import env_int
from ..models import DemoStart, Setting, User
from ..rate_limit import DEMO_LIMIT, limiter
from ..schemas import DemoSampleOut, DemoStartRequest, TokenResponse
from ..upsert import upsert

router = APIRouter(prefix="/api/demo", tags=["demo"])

DEMO_DAILY_LIMIT_ENV = "DEMO_DAILY_LIMIT"
# In code because render.yaml is not applied to the live service: unset there,
# this is the value production runs on.
DEFAULT_DEMO_DAILY_LIMIT = 40


def demo_daily_limit() -> int:
    """Read on every request, so it can be changed in the dashboard without a
    deploy. 0 turns the demo off."""
    return env_int(DEMO_DAILY_LIMIT_ENV, DEFAULT_DEMO_DAILY_LIMIT)


def _seed_date(requested: date_type | None) -> date_type:
    """The day the seeded month ends on: the visitor's date if it is plausible.

    The client sends its own calendar date everywhere else in the app, and
    the seed has to agree with it: a visitor east of the server late in the
    evening is already on tomorrow, and seeded on the server's date they
    would open a Today with nothing on it. Within a day either way covers
    every real timezone; anything further is a wrong clock or a made-up
    value, and the server's date is the better guess.
    """
    server_today = date_type.today()
    if requested is not None and abs((requested - server_today).days) <= 1:
        return requested
    return server_today


@router.post("", response_model=TokenResponse, status_code=201)
@limiter.limit(DEMO_LIMIT)
def start_demo(
    request: Request,
    body: DemoStartRequest | None = None,
    db: Session = Depends(get_db),
):
    purge_expired_demos_quietly(db)

    # UTC, like every counter (see the two day conventions in routers/admin.py):
    # this counts events, not a date the visitor chose.
    counted_on = datetime.now(timezone.utc).date()
    started = db.scalar(select(DemoStart.count).where(DemoStart.date == counted_on)) or 0
    # Checked before the insert, so two requests at the same moment can both
    # pass and land one over. The cap bounds database growth; one over it
    # bounds that just as well, and closing the gap would mean a lock on
    # every start.
    if started >= demo_daily_limit():
        raise HTTPException(
            status_code=503,
            detail="The demo is busy today. Please try again tomorrow, or create an account.",
        )

    seed_date = _seed_date(body.today if body else None)

    def build() -> User:
        # Everything in one transaction, so a demo is never counted without
        # being created or created without being counted. The retry is for
        # the day's first two demos racing to create the demo_starts row:
        # rolling back discards the loser's account too, and building it
        # again (with a fresh address) is a clean second attempt.
        user = User(
            # .invalid is reserved and can never be delivered to (RFC 2606),
            # and EmailStr refuses it, so nobody can sign up as or reset
            # into one of these. No password: nobody can sign in to it either.
            email=f"demo-{secrets.token_hex(8)}@demo.invalid",
            password_hash=None,
            is_demo=True,
        )
        db.add(user)
        db.flush()
        setting = Setting(user_id=user.id)
        db.add(setting)
        seed_demo(db, user, setting, seed_date)
        counter = db.scalars(select(DemoStart).where(DemoStart.date == counted_on)).first()
        if counter is None:
            counter = DemoStart(date=counted_on, count=0)
            db.add(counter)
        counter.count += 1
        return user

    user = upsert(db, build)
    return TokenResponse(
        access_token=create_access_token(user.id, lifetime=DEMO_LIFETIME),
        user=_user_out(user),
    )


@router.delete("", status_code=204)
def end_demo(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """End the demo now rather than waiting a day for the purge.

    No password to confirm, unlike DELETE /api/auth/account, because there is
    none and nothing is lost. 403 for a real account: this route must never
    be the way an account with a person's data in it disappears.
    """
    if not user.is_demo:
        raise HTTPException(status_code=403, detail="Only a demo account can be ended.")
    db.delete(user)
    db.commit()


@router.get("/samples", response_model=list[DemoSampleOut])
def list_samples(_user: User = Depends(get_current_user)):
    """The plates a demo can send to /api/ai/analyze as `sample`.

    Served from the same file the replay reads, so the client never keeps its
    own copy of the ids. Any signed-in account may read it: it is the same
    public data for everyone.
    """
    return [
        DemoSampleOut(
            id=sample.id,
            meal_name=sample.analysis.meal_name,
            note=sample.note,
            photo=sample.photo,
            measured_calories=sample.measured_calories,
        )
        for sample in SAMPLES.values()
    ]
