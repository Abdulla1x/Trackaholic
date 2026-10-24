"""Password hashing (Argon2) and JWT access tokens."""
import logging
import os
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

from ..db import get_database_url
from ..env import env_float

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"
TOKEN_DAYS_ENV = "ACCESS_TOKEN_DAYS"
DEFAULT_TOKEN_DAYS = 7.0
# Only ever used against a local SQLite database; non-SQLite refuses to start
# without a real JWT_SECRET (enforced in main.py's lifespan).
_DEV_SECRET = "dev-only-secret-not-for-production"

_password_hash = PasswordHash.recommended()  # Argon2id


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    """False, never an exception, for an account with no usable password.

    NULL is a Google-only account; a string pwdlib can't parse is migration
    0024's downgrade marker. Both must read as "wrong password" to every
    caller, or a login attempt against such an account would 500.
    """
    if not password_hash:
        return False
    try:
        return _password_hash.verify(password, password_hash)
    except UnknownHashError:
        return False


def get_jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if secret:
        return secret
    if get_database_url().startswith("sqlite"):
        return _DEV_SECRET
    raise RuntimeError(
        "JWT_SECRET must be set when running against a non-SQLite database."
    )


def token_lifetime() -> timedelta:
    """How long a new access token is good for.

    This is called inside create_access_token, which is called by login and
    signup and nothing else. A bare float() here therefore did not fail as a
    configuration error: it 500'd the only two ways into the app, for everyone,
    while /api/health went on answering 200 -- the failure shape this project
    has been caught by before. ACCESS_TOKEN_DAYS is absent from render.yaml, so
    the dashboard is the only place it can be set, and the only place the typo
    can be.

    Zero and negatives fall back rather than clamping to 0, unlike the quota
    limits in env_int. A limit of 0 turns a feature off; a token lifetime of 0
    mints tokens that have already expired, which locks every user out of an app
    that is otherwise working perfectly. Nobody types that meaning to.
    """
    days = env_float(TOKEN_DAYS_ENV, DEFAULT_TOKEN_DAYS)
    if days <= 0:
        logger.warning(
            "%s must be positive (%s); using %s", TOKEN_DAYS_ENV, days, DEFAULT_TOKEN_DAYS
        )
        return timedelta(days=DEFAULT_TOKEN_DAYS)
    return timedelta(days=days)


def create_access_token(user_id: int, lifetime: timedelta | None = None) -> str:
    """`lifetime` is for the demo's one-day token; everything else takes the
    configured default."""
    now = datetime.now(timezone.utc)
    claims = {
        "sub": str(user_id),  # PyJWT requires a string subject
        "iat": now,
        "exp": now + (lifetime or token_lifetime()),
    }
    return jwt.encode(claims, get_jwt_secret(), algorithm=ALGORITHM)


def decode_token(token: str) -> tuple[int, datetime]:
    """Returns (user id, issued-at as naive UTC), or raises jwt.InvalidTokenError.

    issued-at lets callers reject tokens minted before the user's last
    password change (see auth/deps.py).
    """
    claims = jwt.decode(
        token,
        get_jwt_secret(),
        algorithms=[ALGORITHM],
        options={"require": ["exp", "sub", "iat"]},
    )
    try:
        user_id = int(claims["sub"])
        issued_at = datetime.fromtimestamp(claims["iat"], tz=timezone.utc)
    except (TypeError, ValueError):
        raise jwt.InvalidTokenError("Malformed subject or iat claim")
    return user_id, issued_at.replace(tzinfo=None)


# A file download is a plain link the browser follows itself, so it cannot
# carry the Authorization header; the export link carries this instead. It is
# signed like a login but names its own audience, which PyJWT checks both
# ways: a ticket is refused as a login (decode_token passes no audience) and a
# login is refused as a ticket (it has none). A minute is long enough because
# the app follows the link the moment it gets it; the link does land in the
# server's request log, and by the time anyone reads that it has expired.
EXPORT_AUDIENCE = "export"
EXPORT_TICKET_LIFETIME = timedelta(minutes=1)


def create_export_ticket(user_id: int, kind: str) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "sub": str(user_id),
        "aud": EXPORT_AUDIENCE,
        "kind": kind,
        "iat": now,
        "exp": now + EXPORT_TICKET_LIFETIME,
    }
    return jwt.encode(claims, get_jwt_secret(), algorithm=ALGORITHM)


def decode_export_ticket(ticket: str) -> tuple[int, str, datetime]:
    """Returns (user id, kind, issued-at as naive UTC), or raises
    jwt.InvalidTokenError."""
    claims = jwt.decode(
        ticket,
        get_jwt_secret(),
        algorithms=[ALGORITHM],
        audience=EXPORT_AUDIENCE,
        options={"require": ["exp", "sub", "iat", "aud"]},
    )
    try:
        user_id = int(claims["sub"])
        kind = str(claims["kind"])
        issued_at = datetime.fromtimestamp(claims["iat"], tz=timezone.utc)
    except (KeyError, TypeError, ValueError):
        raise jwt.InvalidTokenError("Malformed export ticket")
    return user_id, kind, issued_at.replace(tzinfo=None)
