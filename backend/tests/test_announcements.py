from app.announcements import ANNOUNCEMENTS


def test_announcements_are_public(anon_client):
    """No auth: the status banner has to render on the login page, which is
    where someone lands when the app looks broken to them."""
    response = anon_client.get("/api/announcements")
    assert response.status_code == 200
    body = response.json()
    assert body["banner"] is None
    assert len(body["items"]) + len(body["quiet"]) == len(ANNOUNCEMENTS)


def test_quiet_notes_are_listed_apart_from_the_pop_up_ones(anon_client):
    """A note that must not pop up is left out of `items`, the list every
    build's pop-up reads, so an installed app still on an older build can't
    pop it up either. Only What's new reads `quiet`."""
    body = anon_client.get("/api/announcements").json()
    item_ids = {item["id"] for item in body["items"]}
    quiet_ids = {item["id"] for item in body["quiet"]}
    assert "2026-10-17-redesign" in quiet_ids
    assert item_ids.isdisjoint(quiet_ids)
    assert quiet_ids == {note.id for note in ANNOUNCEMENTS if not note.popup}
    # The flag is how the server sorts them; the client never needs it.
    assert all("popup" not in item for item in body["items"] + body["quiet"])


def test_status_banner_comes_from_the_environment(anon_client, monkeypatch):
    """Read per request, so an outage notice needs no deploy."""
    monkeypatch.setenv("STATUS_BANNER", "AI analysis is down — macros still save.")
    body = anon_client.get("/api/announcements").json()
    assert body["banner"] == "AI analysis is down — macros still save."

    monkeypatch.setenv("STATUS_BANNER", "")
    assert anon_client.get("/api/announcements").json()["banner"] is None


def test_blank_status_banner_is_not_a_banner(anon_client, monkeypatch):
    """A dashboard field cleared to whitespace must not show an empty bar."""
    monkeypatch.setenv("STATUS_BANNER", "   \n")
    assert anon_client.get("/api/announcements").json()["banner"] is None


def test_announcements_are_newest_first(anon_client):
    body = anon_client.get("/api/announcements").json()
    for notes in (body["items"], body["quiet"]):
        dates = [item["date"] for item in notes]
        assert dates == sorted(dates, reverse=True)


def test_announcement_ids_are_unique():
    """Ids are the frontend's localStorage dismissal keys; a duplicate would
    make dismissing one note silently hide another."""
    ids = [item.id for item in ANNOUNCEMENTS]
    assert len(ids) == len(set(ids))
