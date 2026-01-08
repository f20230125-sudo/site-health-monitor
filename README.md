# Site Health Monitor

**Live:** https://site-health-monitor.vercel.app

Automated weekly Lighthouse audits of public pharmaceutical websites: three pages of msd.com and the home pages of nine peers, on Lighthouse's mobile setting. It reports performance, accessibility, best practices and SEO, the loading metrics behind them, the platform each site runs on, and a **ranked fix backlog for MSD's pages written for WordPress**, which msd.com runs on.

It mirrors what a digital platforms team does to improve user experience on its websites: measure every week, turn failures into a prioritised list of fixes, and show whether the fixes worked.

## What it found (audited 19 Oct 2026)

- **MSD's three pages score 41 to 44 for mobile performance, ahead of all nine peers (13 to 38; median 29)**, and are the lightest pages audited (median 1.0 MB against 4.1 MB).
- **They trail on accessibility: median 90 against the peers' 97.** All three MSD pages have buttons without an accessible name and links with no descriptive text.
- **The main content still takes 6.2 to 9.7 seconds to appear** on a simulated mid-range phone over slow 4G (Largest Contentful Paint; Google counts 2.5 s as good). Peers range from 6.9 to 29.6 s.
- **24 failing audits in MSD's backlog**, 4 of them accessibility; the top ones affect all three pages: render-blocking CSS and scripts, JavaScript execution time, unused JavaScript and third-party tags.
- **Platforms, read from public markup:** MSD on WordPress, Novartis on Drupal, AstraZeneca, BMS and Novo Nordisk on Adobe Experience Manager, GSK on Nuxt. Pfizer and Lilly block scripted page requests (Lighthouse's real browser still audited them).

## How it works

```
audit/pages.json (12 public pages)
        │
audit/audit.mjs: Lighthouse in a fresh headless Chromium per run, mobile preset, 4 categories;
                 a bot wall or error is recorded as blocked, not scored
        │  data/raw/<date>/<page>.json
shm.report: median run per page, platform from public markup, MSD vs peer medians, checks,
            fix backlog (share of MSD pages affected x how badly) with WordPress remedies
        │
site/public/data/health.json (dashboard)   excel/Site-Health-Monitor.xlsx   data/history.csv (one row per page per week)
        │
.github/workflows/weekly-audit.yml: every Tuesday audit -> report -> tests -> commit; Vercel redeploys
```

Runs: the two first MSD pages were audited three times and the median run kept; the other ten pages once (each run takes about a minute). The weekly job audits every page once and builds the history.

## Run it

```powershell
npm ci; pip install -r requirements.txt
$env:CHROME_PATH = "<path to Chrome or Chromium>"; node audit/audit.mjs --runs 3
$env:PYTHONPATH = "src"; python -m shm.report; python -m pytest -q
cd site; npm install; npm run build; npm run start    # http://localhost:3120; npx vitest run; npx playwright test
```

Tests: 3 pytest (median run, the report ties to the page list, every remedy is complete), 3 vitest (group medians, scores, backlog order), 7 Playwright (sections, tables, download, axe in light and dark, 390 and 320 px).

## Limits

- Lab measurements from one machine on one day, not real visitors' experience (Google's field data, CrUX, needs an API key). Performance scores move by several points between runs.
- MSD's inner pages against peers' home pages is a rough comparison. The weekly job runs on GitHub's servers, not in Dubai: compare a site with itself over time.
- A few page loads per site per week, about what one visitor makes: no crawling, no forms, no login.
- An independent audit of public pages, not produced or endorsed by MSD or any company named.
