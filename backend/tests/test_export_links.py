"""The one-minute export links: what the browser follows to download a file."""
import json
from datetime import datetime, timedelta, timezone

import jwt

from app.auth.security import get_jwt_secret
from tests.conftest import TEST_PASSWORD


def _link(client, kind: str) -> str:
    response = client.post("/api/data/export/ticket", json={"kind": kind})
    assert response.status_code == 200, response.text
    url = response.json()["url"]
    assert url.startswith("/api/data/export/file?ticket=")
    return url


def _ticket(url: str) -> str:
    return url.split("ticket=", 1)[1]


def _me(client):
    return client.get("/api/auth/me").json()


def _signed(claims: dict) -> str:
    return jwt.encode(claims, get_jwt_secret(), algorithm="HS256")


def _expired(response) -> bool:
    return (
        response.status_code == 403
        and response.headers["content-type"].startswith("text/plain")
        and "expired" in response.text
    )


def test_the_meals_link_downloads_the_csv_without_a_login(client, anon_client):
    client.post("/api/meals", json={
        "date": "2026-07-01", "name": "Bowl", "calories": 500, "protein": 40,
    })
    url = _link(client, "meals")

    # anon_client sends no Authorization header, as a followed link doesn't.
    response = anon_client.get(url)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert response.headers["content-disposition"] == (
        "attachment; filename=trackaholic_meals.csv"
    )
    # The same file the authenticated route gives.
    assert response.text == client.get("/api/data/export").text
    assert "Bowl" in response.text


def test_the_everything_link_downloads_the_same_json(client, anon_client):
    client.post("/api/meals", json={
        "date": "2026-07-01", "name": "Bowl", "calories": 500, "protein": 40,
    })
    response = anon_client.get(_link(client, "all"))
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.headers["content-disposition"] == (
        "attachment; filename=trackaholic_full_export.json"
    )
    downloaded = json.loads(response.text)
    fetched = client.get("/api/data/export/all").json()
    downloaded.pop("exported_at")
    fetched.pop("exported_at")
    assert downloaded == fetched


def test_a_link_only_carries_its_own_account(client, client_b, anon_client):
    client.post("/api/meals", json={
        "date": "2026-07-01", "name": "Mine", "calories": 500, "protein": 40,
    })
    client_b.post("/api/meals", json={
        "date": "2026-07-01", "name": "Theirs", "calories": 300, "protein": 20,
    })
    text = anon_client.get(_link(client, "meals")).text
    assert "Mine" in text
    assert "Theirs" not in text


def test_asking_for_a_link_needs_a_login(anon_client):
    response = anon_client.post("/api/data/export/ticket", json={"kind": "meals"})
    assert response.status_code == 401


def test_only_the_two_exports_have_links(client):
    response = client.post("/api/data/export/ticket", json={"kind": "settings"})
    assert response.status_code == 422


def test_a_ticket_is_not_a_login(client, anon_client):
    ticket = _ticket(_link(client, "meals"))
    response = anon_client.get(
        "/api/meals", headers={"Authorization": f"Bearer {ticket}"}
    )
    assert response.status_code == 401


def test_a_login_is_not_a_ticket(client, anon_client):
    login = client.headers["Authorization"].removeprefix("Bearer ")
    assert _expired(anon_client.get(f"/api/data/export/file?ticket={login}"))


def test_an_expired_link_is_refused_in_words(client, anon_client):
    now = datetime.now(timezone.utc)
    ticket = _signed({
        "sub": str(_me(client)["id"]), "aud": "export", "kind": "meals",
        "iat": now - timedelta(minutes=2), "exp": now - timedelta(minutes=1),
    })
    assert _expired(anon_client.get(f"/api/data/export/file?ticket={ticket}"))


def test_a_tampered_link_is_refused(client, anon_client):
    ticket = _ticket(_link(client, "meals"))
    assert _expired(anon_client.get(f"/api/data/export/file?ticket={ticket}x"))


def test_a_ticket_for_another_kind_is_refused(client, anon_client):
    now = datetime.now(timezone.utc)
    ticket = _signed({
        "sub": str(_me(client)["id"]), "aud": "export", "kind": "settings",
        "iat": now, "exp": now + timedelta(minutes=1),
    })
    assert _expired(anon_client.get(f"/api/data/export/file?ticket={ticket}"))


def test_changing_the_password_revokes_earlier_links(client, anon_client):
    now = datetime.now(timezone.utc)
    # Minted before the change, like a link copied from the log.
    ticket = _signed({
        "sub": str(_me(client)["id"]), "aud": "export", "kind": "meals",
        "iat": now - timedelta(seconds=30), "exp": now + timedelta(seconds=30),
    })
    url = f"/api/data/export/file?ticket={ticket}"
    assert anon_client.get(url).status_code == 200

    response = client.post(
        "/api/auth/change-password",
        json={"current_password": TEST_PASSWORD, "new_password": "new-password-456"},
    )
    assert response.status_code == 200
    assert _expired(anon_client.get(url))
