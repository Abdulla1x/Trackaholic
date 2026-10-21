"""Sign in with Google.

Google's half -- the signature, expiry and audience of the ID token -- is
google-auth's job and is not re-tested here. These tests stand in for it at the
seam (`google.verify_credential` for the router, `id_token.verify_oauth2_token`
for the module) and test what this app decides: which account a verified
identity reaches, and what an account without a password can and can't do.
"""
import pytest
from google.auth.exceptions import TransportError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import google
from app.db import get_engine
from app.models import Setting, User
from conftest import TEST_PASSWORD

# Captured before the autouse fake below replaces it, for the module tests.
REAL_VERIFY = google.verify_credential


def fake_verify(credential: str) -> google.GoogleIdentity:
    """"tok:<sub>:<email>" is a valid token for that account; two words fail."""
    if credential == "bad":
        raise google.InvalidGoogleToken("forged")
    if credential == "down":
        raise google.GoogleUnavailable("no keys")
    _, sub, email = credential.split(":")
    return google.GoogleIdentity(sub=sub, email=email)


@pytest.fixture(autouse=True)
def _fake_google(monkeypatch):
    monkeypatch.setattr(google, "verify_credential", fake_verify)


def sign_in(client, credential):
    return client.post("/api/auth/google", json={"credential": credential})


def bearer(response) -> dict:
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def users(email: str) -> list[User]:
    with Session(get_engine()) as db:
        return list(db.scalars(select(User).where(User.email == email)))


def test_a_new_google_account_is_created_with_settings_and_no_password(anon_client):
    response = sign_in(anon_client, "tok:g-1:new@gmail.com")
    assert response.status_code == 200, response.text
    user = response.json()["user"]
    assert user["email"] == "new@gmail.com"
    assert user["has_password"] is False
    assert user["google_linked"] is True

    me = anon_client.get("/api/auth/me", headers=bearer(response))
    assert me.status_code == 200
    # The settings row signup creates, without which the app's first load fails.
    assert anon_client.get("/api/settings", headers=bearer(response)).status_code == 200
    with Session(get_engine()) as db:
        row = db.scalars(select(User).where(User.google_sub == "g-1")).one()
        assert row.password_hash is None
        assert db.scalars(select(Setting).where(Setting.user_id == row.id)).one()


def test_a_returning_google_account_reaches_the_same_account(anon_client):
    first = sign_in(anon_client, "tok:g-2:back@gmail.com").json()["user"]["id"]
    again = sign_in(anon_client, "tok:g-2:back@gmail.com").json()["user"]["id"]
    assert first == again
    assert len(users("back@gmail.com")) == 1


def test_it_is_matched_on_googles_id_not_the_email(anon_client):
    """The address can change on Google's side; the sub never does."""
    first = sign_in(anon_client, "tok:g-3:old@gmail.com").json()["user"]["id"]
    renamed = sign_in(anon_client, "tok:g-3:renamed@gmail.com")
    assert renamed.json()["user"]["id"] == first


def test_a_matching_email_links_the_existing_account_and_keeps_its_password(anon_client):
    created = anon_client.post(
        "/api/auth/signup", json={"email": "both@gmail.com", "password": TEST_PASSWORD}
    ).json()["user"]["id"]

    linked = sign_in(anon_client, "tok:g-4:both@gmail.com")
    assert linked.status_code == 200
    assert linked.json()["user"]["id"] == created
    assert linked.json()["user"]["has_password"] is True
    assert linked.json()["user"]["google_linked"] is True

    login = anon_client.post(
        "/api/auth/login", json={"email": "both@gmail.com", "password": TEST_PASSWORD}
    )
    assert login.status_code == 200, "the password keeps working (decided 2026-10-21)"
    assert len(users("both@gmail.com")) == 1


def test_an_email_linked_to_another_google_account_is_not_relinked(anon_client):
    sign_in(anon_client, "tok:g-5:taken@gmail.com")
    other = sign_in(anon_client, "tok:g-OTHER:taken@gmail.com")
    assert other.status_code == 409
    with Session(get_engine()) as db:
        assert db.scalars(select(User).where(User.email == "taken@gmail.com")).one().google_sub == "g-5"


def test_a_bad_token_is_401_and_an_outage_at_google_is_503(anon_client):
    assert sign_in(anon_client, "bad").status_code == 401
    down = sign_in(anon_client, "down")
    assert down.status_code == 503
    assert "isn't available" in down.json()["detail"]


def test_a_google_only_account_cannot_log_in_with_a_password(anon_client):
    """Answered exactly like an unknown address, and never a 500."""
    sign_in(anon_client, "tok:g-6:nopass@gmail.com")
    for password in ("", "anything", TEST_PASSWORD):
        response = anon_client.post(
            "/api/auth/login", json={"email": "nopass@gmail.com", "password": password}
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Incorrect email or password"


def test_a_google_only_account_is_told_how_to_set_a_password(anon_client):
    session = sign_in(anon_client, "tok:g-7:setpw@gmail.com")
    response = anon_client.post(
        "/api/auth/change-password",
        headers=bearer(session),
        json={"current_password": "", "new_password": "a-new-password-1"},
    )
    assert response.status_code == 400
    assert "Forgot your password" in response.json()["detail"]


def test_a_google_only_account_is_deleted_by_signing_in_with_google_again(anon_client):
    session = sign_in(anon_client, "tok:g-8:bye@gmail.com")
    headers = bearer(session)

    assert anon_client.request(
        "DELETE", "/api/auth/account", headers=headers, json={}
    ).status_code == 400, "the session token alone is never enough"
    assert anon_client.request(
        "DELETE", "/api/auth/account", headers=headers,
        json={"google_credential": "tok:g-SOMEONE-ELSE:bye@gmail.com"},
    ).status_code == 400, "another Google account can't confirm it"
    assert anon_client.request(
        "DELETE", "/api/auth/account", headers=headers, json={"google_credential": "bad"},
    ).status_code == 401

    gone = anon_client.request(
        "DELETE", "/api/auth/account", headers=headers,
        json={"google_credential": "tok:g-8:bye@gmail.com"},
    )
    assert gone.status_code == 204
    assert users("bye@gmail.com") == []
    assert anon_client.get("/api/auth/me", headers=headers).status_code == 401


def test_a_password_account_is_still_deleted_with_its_password(client):
    assert client.request(
        "DELETE", "/api/auth/account", json={"password": "wrong"}
    ).status_code == 400
    assert client.request(
        "DELETE", "/api/auth/account", json={"password": TEST_PASSWORD}
    ).status_code == 204


def test_a_reset_link_gives_a_google_only_account_a_password(anon_client, monkeypatch):
    """How a Google-only account adds one: the mailbox proves who it is."""
    from app.services import email as email_service

    sent: list[str] = []

    async def capture(to_email, reset_url, ttl):
        sent.append(reset_url)

    monkeypatch.setattr(email_service, "is_configured", lambda: True)
    monkeypatch.setattr(email_service, "send_password_reset", capture)
    sign_in(anon_client, "tok:g-9:reset@gmail.com")

    assert anon_client.post(
        "/api/auth/forgot-password", json={"email": "reset@gmail.com"}
    ).status_code == 200
    token = sent[0].split("token=")[1]
    assert anon_client.post(
        "/api/auth/reset-password", json={"token": token, "new_password": "first-password-1"}
    ).status_code == 204
    login = anon_client.post(
        "/api/auth/login", json={"email": "reset@gmail.com", "password": "first-password-1"}
    )
    assert login.status_code == 200
    assert login.json()["user"]["has_password"] is True


def test_the_export_says_how_the_account_signs_in(anon_client):
    session = sign_in(anon_client, "tok:g-10:export@gmail.com")
    body = anon_client.get("/api/data/export/all", headers=bearer(session)).json()
    assert body["user"]["sign_in"] == ["google"]
    assert "g-10" not in str(body), "Google's id for the account is not exported"


# --- the module's own decisions, with google-auth stubbed -------------------


@pytest.fixture
def real_verify(monkeypatch):
    """Put the real verify_credential back and stub google-auth underneath."""
    monkeypatch.setattr(google, "verify_credential", REAL_VERIFY)
    calls: list[dict] = []

    def stub(claims=None, error=None):
        def verify(token, request, audience, clock_skew_in_seconds=0):
            calls.append({"audience": audience})
            if error:
                raise error
            return claims

        monkeypatch.setattr(google.id_token, "verify_oauth2_token", verify)

    return stub, calls


def test_verify_returns_the_identity_with_a_lowercased_email(real_verify):
    stub, calls = real_verify
    stub({"sub": "123", "email": "Mixed@Gmail.com", "email_verified": True})
    assert google.verify_credential("t") == google.GoogleIdentity(sub="123", email="mixed@gmail.com")
    assert calls[0]["audience"] == google.DEFAULT_CLIENT_ID


def test_verify_refuses_an_email_google_has_not_verified(real_verify):
    stub, _ = real_verify
    for verified in (False, None, "true"):
        stub({"sub": "1", "email": "a@b.com", "email_verified": verified})
        with pytest.raises(google.InvalidGoogleToken):
            google.verify_credential("t")


def test_verify_tells_an_outage_from_a_bad_token(real_verify):
    stub, _ = real_verify
    stub(error=TransportError("keys unreachable"))
    with pytest.raises(google.GoogleUnavailable):
        google.verify_credential("t")
    stub(error=ValueError("Token expired"))
    with pytest.raises(google.InvalidGoogleToken):
        google.verify_credential("t")


def test_the_client_id_can_be_overridden(real_verify, monkeypatch):
    stub, calls = real_verify
    monkeypatch.setenv(google.CLIENT_ID_ENV, " other.apps.googleusercontent.com ")
    stub({"sub": "1", "email": "a@b.com", "email_verified": True})
    google.verify_credential("t")
    assert calls[0]["audience"] == "other.apps.googleusercontent.com"



def test_the_admin_page_shows_the_flag_but_never_googles_id(client, anon_client, monkeypatch):
    from test_admin import make_admin

    make_admin(client, monkeypatch)
    sign_in(anon_client, "tok:g-DISTINCTIVE-SUB-4417:seen@gmail.com")
    rows = client.get("/api/admin/users").json()
    row = next(r for r in rows if r["email"] == "seen@gmail.com")
    assert row["google_linked"] is True
    assert "g-DISTINCTIVE-SUB-4417" not in str(rows) + str(client.get("/api/admin/stats").json())
