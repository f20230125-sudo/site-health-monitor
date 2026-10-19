"""Turn the Lighthouse audits into the site health report: scores, MSD against peers, and a ranked fix backlog.

    python -m shm.report [data/raw/<date>]    (latest audit folder by default; writes site/public/data/health.json and
                                               excel/Site-Health-Monitor.xlsx, and appends to data/history.csv)

For each page the run with the median performance score is kept. The platform is read from the page's own public
markup (WordPress, Drupal, Adobe Experience Manager, Nuxt). The backlog turns each failing audit on MSD's pages into a
fix, ranked by how many MSD pages it affects and how badly, with the remedy written for a WordPress site.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path
from statistics import median

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
SITE = ROOT / "site" / "public" / "data"
XL = ROOT / "excel"

PLATFORMS = [("WordPress", r"wp-content|wp-includes"), ("Drupal", r"/sites/default/files|drupal"), ("Adobe Experience Manager", r"/etc\.clientlibs|/content/dam"), ("Nuxt (Vue)", r"_nuxt"), ("Next.js (React)", r"/_next/")]
METRIC_ONLY = {"max-potential-fid", "interactive", "first-meaningful-paint", "largest-contentful-paint-element", "lcp-breakdown-insight", "lcp-phases-insight"}

# area, WordPress remedy. Audits not listed get a generic line naming the audit.
REMEDY = {
    "unsized-images": ("Performance", "Give every image a width and height (WordPress adds them to media-library images; check theme and page-builder markup)."),
    "render-blocking-resources": ("Performance", "Defer or inline the CSS and scripts the first screen does not need (theme enqueue settings or a performance plugin)."),
    "render-blocking-insight": ("Performance", "Defer or inline the CSS and scripts the first screen does not need (theme enqueue settings or a performance plugin)."),
    "unused-javascript": ("Performance", "Load each plugin's scripts only on the pages that use it; remove plugins nobody uses."),
    "legacy-javascript": ("Performance", "Stop shipping old-browser polyfills to modern browsers (update the theme build or the plugin)."),
    "legacy-javascript-insight": ("Performance", "Stop shipping old-browser polyfills to modern browsers (update the theme build or the plugin)."),
    "uses-long-cache-ttl": ("Performance", "Give static files a long cache lifetime at the host or CDN."),
    "cache-insight": ("Performance", "Give static files a long cache lifetime at the host or CDN."),
    "image-delivery-insight": ("Performance", "Serve images as WebP or AVIF at the size displayed (WordPress generates srcset sizes); lazy-load images below the fold."),
    "modern-image-formats": ("Performance", "Serve images as WebP or AVIF (WordPress can generate them on upload)."),
    "uses-responsive-images": ("Performance", "Serve images at the size displayed, using the srcset sizes WordPress generates."),
    "offscreen-images": ("Performance", "Lazy-load images below the fold."),
    "third-party-summary": ("Performance", "Review third-party tags (analytics, consent banner, chat) in the tag manager; load what can wait after the first interaction."),
    "layout-shifts": ("Performance", "Reserve space for images, embeds and the cookie banner so the page does not jump while loading."),
    "cls-culprits-insight": ("Performance", "Reserve space for images, embeds and the cookie banner so the page does not jump while loading."),
    "lcp-discovery-insight": ("Performance", "Put the main image in the HTML and preload it with fetchpriority=high instead of lazy-loading it."),
    "network-dependency-tree-insight": ("Performance", "Shorten chains of requests; preconnect to the origins the first screen needs."),
    "mainthread-work-breakdown": ("Performance", "Cut the JavaScript run on load (fewer plugins and tags on the page)."),
    "bootup-time": ("Performance", "Cut the JavaScript run on load (fewer plugins and tags on the page)."),
    "uses-rel-preconnect": ("Performance", "Preconnect to the other origins the first screen needs (fonts, CDN, tag manager)."),
    "font-display": ("Performance", "Show text while web fonts load (font-display: swap)."),
    "aria-allowed-attr": ("Accessibility", "Fix ARIA attributes that do not fit their element's role in the theme template."),
    "button-name": ("Accessibility", "Give every icon button an accessible name (aria-label) in the theme or block markup."),
    "link-text": ("Accessibility", "Replace links that say only \"read more\" or \"click here\" with text that says where they go."),
    "link-name": ("Accessibility", "Give every link text or an aria-label."),
    "color-contrast": ("Accessibility", "Raise text contrast to at least 4.5:1 in the theme's colour settings."),
    "image-alt": ("Accessibility", "Write alt text for each image in the media library."),
    "heading-order": ("Accessibility", "Keep headings in order (H1, then H2, then H3) in the page builder."),
    "label": ("Accessibility", "Label every form field."),
    "target-size": ("Accessibility", "Make tap targets at least 24 px with space between them."),
    "list": ("Accessibility", "Use list markup only with list items inside."),
    "listitem": ("Accessibility", "Use list markup only with list items inside."),
    "meta-description": ("SEO", "Write a meta description for each page (in the SEO plugin)."),
    "crawlable-anchors": ("SEO", "Use real link addresses, not JavaScript-only links."),
    "is-crawlable": ("SEO", "Let search engines index the page (check the robots setting)."),
    "robots-txt": ("SEO", "Fix robots.txt so it parses."),
    "errors-in-console": ("Best practices", "Fix the scripts that log errors in the browser console."),
    "inspector-issues": ("Best practices", "Fix the issues the browser reports (cookies, mixed content)."),
    "third-party-cookies": ("Best practices", "Remove tags that set third-party cookies before consent."),
}


def platform(url: str) -> str:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (site-health-monitor; portfolio project)"})
        html = urllib.request.urlopen(req, timeout=30).read(400_000).decode("utf-8", "ignore")
    except Exception:
        return "not readable (the site blocks scripted requests)"
    for name, pat in PLATFORMS:
        if re.search(pat, html, re.I):
            return name
    return "not identified"


def pick(runs: list[dict]) -> tuple[dict | None, int]:
    ok = [r for r in runs if r.get("status") == "ok" and r.get("scores", {}).get("performance") is not None]
    if not ok:
        return None, 0
    ok.sort(key=lambda r: r["scores"]["performance"])
    return ok[(len(ok) - 1) // 2], len(ok)


def main(folder: str | None = None) -> None:
    SITE.mkdir(parents=True, exist_ok=True)
    XL.mkdir(parents=True, exist_ok=True)
    src = Path(folder) if folder else sorted(p for p in RAW.iterdir() if p.is_dir())[-1]
    pages, failing = [], []
    for f in sorted(src.glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        p = d["page"]
        run, n_ok = pick(d["runs"])
        row = {**p, "audited": d["audited"], "runs": len(d["runs"]), "runsOk": n_ok, "platform": platform(p["url"]), "status": "ok" if run else "blocked",
               "error": None if run else (d["runs"][0].get("error") or "no usable run")}
        if run:
            row.update({k.replace("best-practices", "bestPractices"): v for k, v in run["scores"].items()})
            m = run["metrics"]
            row.update({"lcpMs": m["largest-contentful-paint"], "cls": m["cumulative-layout-shift"], "tbtMs": m["total-blocking-time"], "fcpMs": m["first-contentful-paint"],
                        "bytes": m["total-byte-weight"], "ttfbMs": m["server-response-time"]})
            for a in run["failing"]:
                if a["id"] not in METRIC_ONLY:
                    failing.append({"pageId": p["id"], "company": p["company"], "group": p["group"], **a})
        pages.append(row)
    pdf = pd.DataFrame(pages)
    fdf = pd.DataFrame(failing)

    # MSD's fix backlog.
    msd_pages = pdf[(pdf.group == "MSD") & (pdf.status == "ok")]
    msd_f = fdf[fdf.group == "MSD"] if len(fdf) else fdf
    backlog = []
    for aid, d in msd_f.groupby("id"):
        area, fix = REMEDY.get(aid, ("Other", f"Fix the failing Lighthouse audit \"{d.title.iloc[0]}\"."))
        severity = 1 - d.score.mean()
        backlog.append({"id": aid, "title": d.title.iloc[0], "area": area, "pages": int(d.pageId.nunique()), "ofPages": int(len(msd_pages)), "severity": round(float(severity), 3),
                        "priority": round(float(d.pageId.nunique() / max(1, len(msd_pages)) * severity), 3), "items": int(d["items"].fillna(0).sum()), "fix": fix})
    backlog.sort(key=lambda b: (-b["priority"], -b["items"], b["id"]))

    # MSD against peers, median of each group.
    ok = pdf[pdf.status == "ok"]
    cols = ["performance", "accessibility", "bestPractices", "seo", "lcpMs", "tbtMs", "cls", "bytes"]
    groups = {g: {c: float(median(d[c])) for c in cols} | {"pages": int(len(d))} for g, d in ok.groupby("group")}

    checks = [
        {"id": "S01", "check": "Every listed page was audited", "status": "pass" if len(pdf) == len(json.loads((ROOT / "audit" / "pages.json").read_text(encoding="utf-8"))) else "fail",
         "result": f"{len(pdf)} pages", "rule": "one result file per page in audit/pages.json"},
        {"id": "S02", "check": "Pages that blocked the audit", "status": "info", "result": ", ".join(pdf[pdf.status == "blocked"].company) or "none",
         "rule": "a bot wall or error page is recorded as blocked, not scored"},
        {"id": "S03", "check": "Runs per page", "status": "info", "result": ", ".join(f"{r.company} {r.page}: {r.runsOk}" for r in pdf.itertuples() if r.runsOk), "rule": "the run with the median performance score is kept"},
        {"id": "S04", "check": "MSD pages detected as WordPress", "status": "pass" if (msd_pages.platform == "WordPress").all() else "warn",
         "result": f"{int((pdf[pdf.group == 'MSD'].platform == 'WordPress').sum())} of {int((pdf.group == 'MSD').sum())}", "rule": "the backlog's remedies are written for WordPress"},
    ]
    report = {"audited": str(pdf.audited.max()), "device": "mobile (Lighthouse default: simulated mid-range phone on a slow 4G connection)", "pages": json.loads(pdf.to_json(orient="records")),
              "groups": groups, "backlog": backlog, "checks": checks}
    (SITE / "health.json").write_text(json.dumps(report, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")

    hist = ROOT / "data" / "history.csv"
    rows = ok[["audited", "id", "company", "group", "performance", "accessibility", "bestPractices", "seo", "lcpMs", "tbtMs", "cls", "bytes"]]
    if hist.exists():
        old = pd.read_csv(hist)
        rows = pd.concat([old[old.audited != report["audited"]], rows], ignore_index=True)
    rows.to_csv(hist, index=False)

    with pd.ExcelWriter(XL / "Site-Health-Monitor.xlsx", engine="openpyxl") as xw:
        pdf.to_excel(xw, sheet_name="Pages", index=False)
        pd.DataFrame(backlog).to_excel(xw, sheet_name="MSD fix backlog", index=False)
        (fdf if len(fdf) else pd.DataFrame()).to_excel(xw, sheet_name="Failing audits", index=False)
        pd.DataFrame(checks).to_excel(xw, sheet_name="Checks", index=False)
        rows.to_excel(xw, sheet_name="History", index=False)
    dl = ROOT / "site" / "public" / "downloads"
    dl.mkdir(parents=True, exist_ok=True)
    (dl / "Site-Health-Monitor.xlsx").write_bytes((XL / "Site-Health-Monitor.xlsx").read_bytes())
    print(pdf[["company", "page", "status", "platform", "performance", "accessibility", "bestPractices", "seo", "lcpMs"]].to_string(index=False))
    print(json.dumps(groups, indent=1))
    for b in backlog[:8]:
        print(b["priority"], b["area"], b["pages"], b["title"])


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
