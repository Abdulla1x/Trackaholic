"""How long a demo account lives, and the purge that ends it.

Shared by POST /api/demo (routers/demo.py) and the once-a-day hook in
auth/deps.py, which is why it is not in the router: a dependency module that
imports from a router would run the layering backwards.

Two triggers rather than one because neither is enough alone. The endpoint
only fires when someone starts a demo, so a quiet week would leave last
week's accounts in place; the daily hook only fires when someone signs in. Each
covers the other's gap, and both are bounded, so neither can turn one request
into a long one.
"""
import logging
from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .models import User, utcnow

logger = logging.getLogger(__name__)

# Both the account's age at deletion and its token's lifetime, so a demo
# cannot outlive its welcome either way.
DEMO_LIFETIME = timedelta(hours=24)

# Per call. A backlog drains over a few calls instead of one request deleting
# hundreds of accounts, each with ~250 rows, while a visitor waits.
PURGE_BATCH = 20


def purge_expired_demos(db: Session, spare_user_id: int | None = None) -> int:
    """Delete up to PURGE_BATCH demo accounts older than DEMO_LIFETIME.

    Their data goes with them through the foreign keys' ON DELETE CASCADE,
    the same way DELETE /api/auth/account removes an account. Commits, and
    returns how many were deleted.

    `spare_user_id` is the account making the current request. Its token is
    minted a moment after its row, so for a few milliseconds the token
    outlives the account; deleting it from under its own request would leave
    the handler working on a row that is gone.
    """
    stmt = select(User.id).where(
        User.is_demo.is_(True), User.created_at < utcnow() - DEMO_LIFETIME
    )
    if spare_user_id is not None:
        stmt = stmt.where(User.id != spare_user_id)
    ids = list(db.scalars(stmt.order_by(User.id).limit(PURGE_BATCH)))
    if ids:
        db.execute(delete(User).where(User.id.in_(ids)))
        db.commit()
    return len(ids)


def purge_expired_demos_quietly(db: Session, spare_user_id: int | None = None) -> None:
    """purge_expired_demos, but a failure can never fail the caller.

    Both callers are doing something else: starting a demo, or serving any
    authenticated request at all. A demo left a day longer than it should be
    is a smaller problem than either of those failing. The rollback matters
    as much as the except, for the reason in snapshots.ensure_snapshots_quietly.
    """
    try:
        purge_expired_demos(db, spare_user_id)
    except Exception:
        db.rollback()
        logger.exception("demo purge failed")
