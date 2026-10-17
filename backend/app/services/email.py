"""Transactional email via Resend.

This is the ONLY Resend-aware module: callers depend on the provider-neutral
EmailError hierarchy below, so switching providers means rewriting this file
and changing env vars, nothing else. (It replaced Brevo in exactly that way.)

Resend sends from trackaholic.app, a domain authenticated with DKIM and SPF
records at its DNS host, so the From line is the app's own address and is not
rewritten. Two constraints decided the provider and still bind any successor:
an HTTP API, because Render blocks outbound SMTP ports on free services; and a
sender on a domain we own, because a new free account mailing from a gmail.com
address is the profile free providers' fraud screening blocks.
"""
import logging
import os
import ssl
from contextlib import contextmanager
from html import escape

import httpx

logger = logging.getLogger(__name__)

API_KEY_ENV = "RESEND_API_KEY"
SENDER_EMAIL_ENV = "EMAIL_SENDER_ADDRESS"
SENDER_NAME_ENV = "EMAIL_SENDER_NAME"
# What the recipient sees as the display name, beside EMAIL_SENDER_ADDRESS.
DEFAULT_SENDER_NAME = "Trackaholic"

RESEND_API_URL = "https://api.resend.com/emails"
# Resend refuses a request with no User-Agent (403). httpx sends its own by
# default, but naming the app makes it not depend on that.
USER_AGENT = "Trackaholic"

# Without an explicit timeout httpx waits forever, which on a single free
# instance means one unanswered connection pins a worker until the platform
# kills it. Ten seconds is generous for a JSON POST that normally answers in
# well under one — and this call runs in a background task, so the user is not
# waiting on it either way.
SEND_TIMEOUT_S = 10.0


class EmailError(Exception):
    """Base for provider failures, so callers never import provider symbols."""


class EmailRateLimited(EmailError):
    """Provider quota or rate limit exhausted.

    On Resend's free plan that is 100 emails a day or 3,000 a month, or more
    than 10 requests a second. Over a quota the send is refused, never billed.
    """


class EmailUnavailable(EmailError):
    """Provider answered with an HTTP 5xx — its outage, and waiting fixes it."""


class EmailUnreachable(EmailError):
    """No answer at all: DNS, TCP, TLS, or our own timeout expired.

    Split from EmailUnavailable for the same reason meal_ai splits them: a 5xx
    is Resend's problem, this one is our network or a timeout we set too tight,
    and folding them together turns a log line into a guess.
    """


class EmailBadRequest(EmailError):
    """Provider rejected the request: bad key, unverified sender, bad payload.

    Retrying won't help. The likeliest causes: EMAIL_SENDER_ADDRESS on a domain
    that isn't verified in Resend (403), or a wrong, revoked or wrongly-scoped
    key (401/403).
    """


class EmailInternalError(EmailError):
    """Our own plumbing raised something we don't recognise."""


class EmailBadResponse(EmailError):
    """A 2xx that doesn't carry the message id Resend answers a send with.

    Resend's success is 200 with {"id": ...}. Anything else in a 2xx (a proxy's
    HTML page, an empty body) means we can't tell the mail was accepted, and
    logging it as sent would hide the one failure nobody else would notice.
    """


def _env(name: str) -> str:
    """Read an env var, tolerating how dashboards mangle pasted values.

    A key with a trailing newline or wrapping quotes is rejected as
    unauthorised — indistinguishable from a revoked key, and invisible in a
    dashboard's masked field. Same helper as meal_ai's; duplicated rather than
    shared because the point of a provider module is that it stands alone.
    """
    return os.environ.get(name, "").strip().strip('"').strip("'").strip()


def is_configured() -> bool:
    """Both halves are required: a key with no verified sender cannot send."""
    return bool(_env(API_KEY_ENV) and _env(SENDER_EMAIL_ENV))


@contextmanager
def _provider_errors():
    """Translate provider exceptions into the neutral hierarchy, logging why.

    This is the only place Resend's own words are recorded — callers get an
    EmailError with no httpx types attached, so the router stays
    provider-agnostic. The log prefixes are deliberately distinct and greppable
    ("Resend rejected", "Resend server error", "Resend unreachable"): a send
    happens in a background task after the response has gone out, so these lines
    are the *only* record that a reset email failed.
    """
    try:
        yield
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        # Resend's error body names the actual problem (unverified domain,
        # invalid key, which quota) and contains nothing of ours. Truncated because an
        # HTML error page from a proxy would otherwise flood the log.
        detail = exc.response.text[:300]
        if status == 429:
            logger.error("Resend rate limited the send (code=%s): %s", status, detail)
            raise EmailRateLimited(detail) from exc
        if status >= 500:
            logger.error("Resend server error (code=%s): %s", status, detail)
            raise EmailUnavailable(detail) from exc
        logger.error("Resend rejected the request (code=%s): %s", status, detail)
        raise EmailBadRequest(detail) from exc
    except (httpx.TransportError, ssl.SSLError, OSError) as exc:
        # Never got a reply. httpx.TransportError covers ConnectError,
        # ReadTimeout and the rest of that family in one line — including our
        # own SEND_TIMEOUT_S expiring — and OSError catches the socket-level
        # failures httpx doesn't wrap.
        logger.error("Resend unreachable (kind=%s): %s", type(exc).__name__, exc)
        raise EmailUnreachable(f"{type(exc).__name__}: {exc}") from exc
    except EmailError:
        raise
    except Exception as exc:
        logger.exception(
            "Resend call raised an unexpected error (kind=%s)", type(exc).__name__
        )
        raise EmailInternalError(f"{type(exc).__name__}: {exc}") from exc


def _password_reset_body(reset_url: str, ttl_minutes: int) -> tuple[str, str]:
    """The reset email, as (text, html).

    Content lives with the provider call for the same reason meal_ai owns its
    SYSTEM_PROMPT: it is the payload, and splitting payload from the call that
    sends it is how the two drift.

    Both parts are sent. Without `text` Resend would generate one from the
    HTML, and an HTML-only message is a spam signal; a new sending domain with
    no history has no reputation to spare.

    The app's name leads the subject, the heading and the From name: "reset
    your password" from an address the reader doesn't place is exactly the
    shape of a phishing mail, and the name is what they signed up under. The
    lifetime is interpolated from the caller's value so the copy cannot drift
    from the token's real expiry.
    """
    text = (
        f"Trackaholic — password reset\n\n"
        f"Someone asked to reset the password for this email address. Open the "
        f"link below to choose a new one:\n\n"
        f"{reset_url}\n\n"
        f"The link works for {ttl_minutes} minutes and can only be used once.\n\n"
        f"If you didn't ask for this, you can ignore this email — your password "
        f"stays as it is.\n"
    )
    safe_url = escape(reset_url, quote=True)
    html = (
        f'<div style="font-family:system-ui,sans-serif;line-height:1.5">'
        f"<h2>Trackaholic — password reset</h2>"
        f"<p>Someone asked to reset the password for this email address. "
        f"Choose a new one here:</p>"
        f'<p><a href="{safe_url}">Reset your password</a></p>'
        f"<p>The link works for {ttl_minutes} minutes and can only be used "
        f"once.</p>"
        f"<p>If you didn't ask for this, you can ignore this email — your "
        f"password stays as it is.</p>"
        f'<p style="color:#64748b;font-size:12px">If the link doesn\'t open, '
        f"copy and paste this into your browser:<br>{safe_url}</p>"
        f"</div>"
    )
    return text, html


async def send_password_reset(
    to_email: str, reset_url: str, ttl_minutes: int
) -> None:
    """Send one password-reset email, or raise an EmailError.

    A fresh client per call rather than a module-level pooled one: this endpoint
    sends a handful of messages a day, so there is no pool to be worth keeping
    warm, and a long-lived client would need wiring into the app lifespan to be
    closed properly.
    """
    text, html = _password_reset_body(reset_url, ttl_minutes)
    sender_name = _env(SENDER_NAME_ENV) or DEFAULT_SENDER_NAME
    payload = {
        "from": f"{sender_name} <{_env(SENDER_EMAIL_ENV)}>",
        "to": [to_email],
        "subject": "Reset your Trackaholic password",
        "text": text,
        "html": html,
    }
    with _provider_errors():
        async with httpx.AsyncClient(timeout=SEND_TIMEOUT_S) as client:
            response = await client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {_env(API_KEY_ENV)}",
                    "User-Agent": USER_AGENT,
                    "content-type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            # 200 means accepted for delivery, not delivered. The id is what
            # Resend's Logs page is searched by, so it is the one thing worth
            # keeping from a send that otherwise leaves no trace.
            try:
                body = response.json()
            except ValueError:
                body = None
            message_id = body.get("id") if isinstance(body, dict) else None
            if not message_id:
                logger.error(
                    "Resend answered %s without a message id: %s",
                    response.status_code,
                    response.text[:300],
                )
                raise EmailBadResponse(f"{response.status_code} without an id")
            logger.info("Resend accepted the reset email (id=%s)", message_id)
