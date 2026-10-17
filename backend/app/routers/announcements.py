"""Release notes and the live status banner.

Public on purpose: the response contains no user data, and an unauthenticated
endpoint means an outage notice still renders on the login page — which is
exactly where someone lands when the app looks broken.
"""
from fastapi import APIRouter

from ..announcements import ANNOUNCEMENTS, status_banner
from ..schemas import AnnouncementsResponse

router = APIRouter(prefix="/api/announcements", tags=["announcements"])


@router.get("", response_model=AnnouncementsResponse)
def list_announcements():
    # Quiet notes are kept out of `items` rather than flagged inside it: an
    # installed app still running an older build reads every item as a pop-up
    # candidate, and such a build can stay in use for several opens.
    return AnnouncementsResponse(
        banner=status_banner(),
        items=[note for note in ANNOUNCEMENTS if note.popup],
        quiet=[note for note in ANNOUNCEMENTS if not note.popup],
    )
