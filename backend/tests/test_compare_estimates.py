"""The evaluation runner's call order, case manifest and request cap.

The runner spends a free tier's daily requests, and the comparison it feeds is
only fair if both models see the same cases at the same hours, so these are the
parts worth pinning. No network: the provider call is replaced.
"""
import asyncio
import csv
import importlib.util
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "compare_estimates.py"
spec = importlib.util.spec_from_file_location("compare_estimates", SCRIPT)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


def _manifest(tmp_path, rows):
    path = tmp_path / "cases.csv"
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=["meal", "set", "level", "repeat", "photos", "note",
                                "ref_kcal", "ref_protein"])
        writer.writeheader()
        for row in rows:
            writer.writerow({"set": "X", "ref_kcal": "500", "ref_protein": "20", **row})
    return path


def test_the_plan_runs_every_model_on_a_case_before_the_next():
    groups = [("1", "a", "full"), ("1", "b", "full"), ("1", "c", "full")]
    plan = runner.build_plan(groups, ["m1", "m2"], set(), interleave=False)
    assert [(meal, model) for _, meal, _, model in plan] == [
        ("a", "m1"), ("a", "m2"), ("b", "m1"), ("b", "m2"), ("c", "m1"), ("c", "m2"),
    ]


def test_interleave_alternates_which_model_goes_first():
    groups = [("1", "a", "full"), ("1", "b", "full"), ("1", "c", "full")]
    plan = runner.build_plan(groups, ["m1", "m2"], set(), interleave=True)
    assert [(meal, model) for _, meal, _, model in plan] == [
        ("a", "m1"), ("a", "m2"), ("b", "m2"), ("b", "m1"), ("c", "m1"), ("c", "m2"),
    ]


def test_finished_calls_are_not_planned_again():
    groups = [("1", "a", "full"), ("2", "a", "full")]
    finished = {("a", "full", "m1", "1")}
    plan = runner.build_plan(groups, ["m1", "m2"], finished, interleave=False)
    assert plan == [("1", "a", "full", "m2"), ("2", "a", "full", "m1"), ("2", "a", "full", "m2")]


def test_cases_keep_file_order_and_default_to_the_first_repeat(tmp_path):
    path = _manifest(tmp_path, [
        {"meal": "z", "level": "partial", "photos": "p1.jpg"},
        {"meal": "a", "level": "full", "note": "200 g rice"},
        {"meal": "z", "level": "partial", "repeat": "2", "photos": "p1.jpg"},
    ])
    cases = runner.load_cases(path)
    assert [(c["meal"], c["level"], c["repeat"]) for c in cases] == [
        ("z", "partial", "1"), ("a", "full", "1"), ("z", "partial", "2"),
    ]


@pytest.mark.parametrize("rows", [
    [{"meal": "a", "level": "full", "note": "x"}, {"meal": "a", "level": "full", "note": "x"}],
    [{"meal": "a", "level": "none"}],
    [{"meal": "a", "level": "full", "note": "x", "ref_kcal": ""}],
])
def test_a_case_that_cannot_be_scored_or_sent_stops_the_run(tmp_path, rows):
    with pytest.raises(SystemExit):
        runner.load_cases(_manifest(tmp_path, rows))


def _run(monkeypatch, tmp_path, manifest, *extra, attempts=1):
    sent = []

    async def fake_estimate(model, photos, text=None):
        sent.append((model, [p.name for p in photos], text))
        return {"kcal": 500, "kcal_low": 400, "kcal_high": 600, "protein": 20,
                "protein_low": 15, "protein_high": 25, "attempts": attempts,
                "seconds": 1.0, "error": ""}

    photos = tmp_path / "photos"
    photos.mkdir()
    (photos / "p1.jpg").write_bytes(b"jpeg")
    out = tmp_path / "out.csv"
    monkeypatch.setattr(runner, "estimate", fake_estimate)
    monkeypatch.setattr(sys, "argv", [
        "compare_estimates.py", "--photos", str(photos), "--manifest", str(manifest),
        "--out", str(out), "--pause", "0", "--models", "m1", "m2", *extra,
    ])
    asyncio.run(runner.main())
    with out.open() as handle:
        return sent, list(csv.DictReader(handle))


def test_a_text_only_case_is_sent_with_no_photo(monkeypatch, tmp_path):
    manifest = _manifest(tmp_path, [
        {"meal": "x01", "level": "full", "note": "200 g rice"},
        {"meal": "n01", "level": "none", "photos": "p1.jpg"},
    ])
    sent, rows = _run(monkeypatch, tmp_path, manifest)
    assert sent[0] == ("m1", [], "200 g rice")
    assert sent[2] == ("m1", ["p1.jpg"], None)
    # The level is reported where the photo/note condition was.
    assert {(r["meal"], r["variant"]) for r in rows} == {("x01", "full"), ("n01", "none")}


def test_max_requests_stops_a_model_before_it_could_overspend(monkeypatch, tmp_path):
    """A call may need its retry, so a model stops while one more call still fits."""
    manifest = _manifest(tmp_path, [
        {"meal": f"x{i}", "level": "full", "note": "rice"} for i in range(5)
    ])
    sent, _ = _run(monkeypatch, tmp_path, manifest, "--max-requests", "4")
    # 1 request each: after 3 calls, a 4th could need 2 more and pass the cap.
    assert [model for model, _, _ in sent].count("m1") == 3
    assert [model for model, _, _ in sent].count("m2") == 3


def test_every_row_records_when_its_first_attempt_started(monkeypatch):
    async def failing(model, contents, config):
        raise RuntimeError("503 overloaded")

    monkeypatch.setattr(runner.meal_ai, "_generate", failing)
    monkeypatch.setattr(runner, "RETRY_WAIT_S", 0)
    row = asyncio.run(runner.estimate("m1", [], "rice"))
    assert row["error"] and row["attempts"] == runner.MAX_ATTEMPTS
    assert row["started_utc"].endswith("+00:00")
