import json
from pathlib import Path

from shm import report

ROOT = Path(__file__).resolve().parents[1]


def test_the_median_run_is_kept():
    runs = [{"status": "ok", "scores": {"performance": p}} for p in (0.5, 0.3, 0.4)] + [{"status": "blocked"}]
    run, n = report.pick(runs)
    assert run["scores"]["performance"] == 0.4 and n == 3
    assert report.pick([{"status": "blocked"}]) == (None, 0)


def test_published_report_ties_out():
    r = json.loads((ROOT / "site" / "public" / "data" / "health.json").read_text(encoding="utf-8"))
    pages = json.loads((ROOT / "audit" / "pages.json").read_text(encoding="utf-8"))
    assert {p["id"] for p in r["pages"]} == {p["id"] for p in pages}
    assert all(c["status"] != "fail" for c in r["checks"])
    msd = [p for p in r["pages"] if p["group"] == "MSD" and p["status"] == "ok"]
    assert msd and all(p["platform"] == "WordPress" for p in msd)
    pri = [b["priority"] for b in r["backlog"]]
    assert pri == sorted(pri, reverse=True)
    assert all(0 < b["pages"] <= b["ofPages"] for b in r["backlog"])


def test_every_remedy_names_an_area_and_a_fix():
    for aid, (area, fix) in report.REMEDY.items():
        assert area in {"Performance", "Accessibility", "SEO", "Best practices"}, aid
        assert fix.endswith("."), aid
