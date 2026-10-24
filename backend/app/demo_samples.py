"""The sample meals a demo account can "analyse" instead of its own.

A demo never calls the model: it would spend the daily AI quota real
accounts share, on visitors nobody can limit by account. So a demo picks one
of these plates and gets back an estimate the model really gave for it, saved
in data/demo_samples.json. The file says how each estimate was made and where
the photos come from; the photos themselves are served by the frontend from
/demo/.

Read and validated once, at import, against the same MealAnalysis model the
live answers are checked with, so a stale or hand-broken file fails the tests
and the boot rather than a visitor's tap.
"""
import json
from dataclasses import dataclass
from pathlib import Path

from .schemas import MealAnalysis

DATA_FILE = Path(__file__).parent / "data" / "demo_samples.json"


@dataclass(frozen=True)
class DemoSample:
    id: str
    note: str
    # A path on the frontend's origin, not this API's.
    photo: str
    analysis: MealAnalysis


def _load(path: Path) -> dict[str, DemoSample]:
    samples: dict[str, DemoSample] = {}
    for entry in json.loads(path.read_text(encoding="utf-8"))["samples"]:
        if entry["id"] in samples:
            raise ValueError(f"{path.name}: sample {entry['id']} appears twice")
        samples[entry["id"]] = DemoSample(
            id=entry["id"],
            note=entry["note"],
            photo=entry["photo"],
            analysis=MealAnalysis.model_validate(entry["analysis"]),
        )
    return samples


# Keyed by id, in file order.
SAMPLES = _load(DATA_FILE)
