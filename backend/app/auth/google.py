"""Sign in with Google: checking the ID token the browser hands over.

The frontend renders Google's button, Google signs the person in, and the
browser receives an ID token (a JWT signed by Google) naming the account. That
token is the whole credential. This module checks it is genuine, unexpired and
issued to this app, then hands back the two things the router needs.

The client ID is the real one by default rather than a required variable: it is
not a secret (it ships in the frontend bundle too), and render.yaml is not
synced to the Render dashboard, so a variable nobody set must still produce a
working sign-in. GOOGLE_CLIENT_ID overrides it, for a second client in another
Google project.
"""
import os
from dataclasses import dataclass

from google.auth.exceptions import GoogleAuthError, TransportError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

CLIENT_ID_ENV = "GOOGLE_CLIENT_ID"
DEFAULT_CLIENT_ID = (
    "671287093003-pt9gb0nk5uhls0i246022m7ph33kg10m.apps.googleusercontent.com"
)

# A phone whose clock runs a few seconds fast would otherwise mint tokens that
# are "not yet valid" here. Google's own guidance tolerates small skew.
CLOCK_SKEW_S = 10


class InvalidGoogleToken(Exception):
    """Forged, expired, issued to another app, or for an unverified email."""


class GoogleUnavailable(Exception):
    """Google's signing keys couldn't be fetched, so nothing can be checked."""


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str


def client_id() -> str:
    return os.environ.get(CLIENT_ID_ENV, "").strip() or DEFAULT_CLIENT_ID


def verify_credential(credential: str) -> GoogleIdentity:
    """Check an ID token and return who it names.

    Two failures, kept apart because they mean different things to the person
    in front of the button: a bad token is theirs to retry, an outage at Google
    is nobody's, and calling it "invalid" would send them round in circles.
    """
    try:
        claims = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            client_id(),
            clock_skew_in_seconds=CLOCK_SKEW_S,
        )
    except TransportError as exc:
        raise GoogleUnavailable(str(exc)) from exc
    except (ValueError, GoogleAuthError) as exc:
        raise InvalidGoogleToken(str(exc)) from exc

    # The address is only an identity Google vouches for when it says so. An
    # unverified one would let anyone who can create a Google account with
    # someone else's address be linked to that person's account here.
    if claims.get("email_verified") is not True:
        raise InvalidGoogleToken("email not verified by Google")
    sub, email = claims.get("sub"), claims.get("email")
    if not sub or not email:
        raise InvalidGoogleToken("token names no account")
    return GoogleIdentity(sub=str(sub), email=str(email).strip().lower())
