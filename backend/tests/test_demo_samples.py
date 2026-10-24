"""The demo's saved estimates (app/demo_samples.py) and the photos beside them."""
import json
from pathlib import Path

import pytest

from app.demo_samples import DATA_FILE, SAMPLES, _load

PUBLIC = Path(__file__).resolve().parents[2] / "frontend" / "public"


def test_there_are_samples_and_each_one_validated():
    # _load runs MealAnalysis.model_validate on every entry at import, so
    # reaching this line means the whole file parsed.
    assert len(SAMPLES) >= 4
    for sample in SAMPLES.values():
        assert sample.note
        assert sample.analysis.items


def test_every_photo_is_where_the_frontend_serves_it():
    for sample in SAMPLES.values():
        assert sample.photo == f"/demo/{sample.id}.jpg"
        assert (PUBLIC / sample.photo.lstrip("/")).is_file(), sample.photo


def test_no_photo_carries_exif():
    # EXIF lives in a JPEG's APP1 segment, which opens with this identifier.
    # A photo re-encoded without it can't carry a location or a camera serial.
    for sample in SAMPLES.values():
        assert b"Exif\x00\x00" not in (PUBLIC / sample.photo.lstrip("/")).read_bytes()


def test_no_estimate_names_a_library_food():
    # A demo's library is the seeded one, so an item claiming to be one of
    # "your saved foods" would point at something the visitor doesn't have.
    for sample in SAMPLES.values():
        assert all(item.matched_food_name is None for item in sample.analysis.items)


def test_the_file_credits_its_source():
    # CC BY: the credit has to travel with the photos.
    source = json.loads(DATA_FILE.read_text(encoding="utf-8"))["source"]
    assert source["license"] == "CC BY 4.0"
    assert source["credit"] and source["url"]


def test_a_repeated_id_is_refused(tmp_path):
    entry = json.loads(DATA_FILE.read_text(encoding="utf-8"))["samples"][0]
    broken = tmp_path / "samples.json"
    broken.write_text(json.dumps({"samples": [entry, entry]}))
    with pytest.raises(ValueError, match="appears twice"):
        _load(broken)
