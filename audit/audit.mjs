// Audits each public page with Lighthouse in a headless Chromium of its own (no profile, no login, no cookies kept),
// three times on the mobile preset, and keeps the run with the median performance score.
//   node audit/audit.mjs [--runs 3] [--out data/raw/<date>]
// A page that blocks the audit (a bot wall, an error page) is recorded as blocked, with the reason, not dropped.
import fs from "node:fs";
import path from "node:path";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith("--") ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const RUNS = Number(args.runs ?? 3);
const today = new Date().toISOString().slice(0, 10);
const OUT = args.out ?? path.join("data", "raw", today);
const ONLY = args.only ? args.only.split(",") : null; // audit a subset, e.g. --only msd-pipeline,gsk
const PAGES = JSON.parse(fs.readFileSync(path.join("audit", "pages.json"), "utf-8")).filter((p) => !ONLY || ONLY.includes(p.id));
const CHROME = process.env.CHROME_PATH; // set in CI by the setup step; locally any Chromium

fs.mkdirSync(OUT, { recursive: true });
const AUDITS = ["largest-contentful-paint", "cumulative-layout-shift", "total-blocking-time", "first-contentful-paint", "speed-index", "total-byte-weight", "server-response-time"];

for (const page of PAGES) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const chrome = await launch({ chromePath: CHROME, chromeFlags: ["--headless=new", "--no-first-run", "--disable-extensions"] });
    try {
      const r = await lighthouse(page.url, { port: chrome.port, output: "json", logLevel: "error", formFactor: "mobile", onlyCategories: ["performance", "accessibility", "best-practices", "seo"] });
      const lhr = r.lhr;
      runs.push({
        finalUrl: lhr.finalDisplayedUrl,
        status: lhr.runtimeError ? "blocked" : "ok",
        error: lhr.runtimeError?.message ?? null,
        scores: Object.fromEntries(Object.entries(lhr.categories).map(([k, c]) => [k, c.score])),
        metrics: Object.fromEntries(AUDITS.map((a) => [a, lhr.audits[a]?.numericValue ?? null])),
        failing: Object.values(lhr.audits)
          .filter((a) => a.score !== null && a.score < 0.9 && ["binary", "numeric", "metricSavings"].includes(a.scoreDisplayMode) && !AUDITS.includes(a.id))
          .map((a) => ({ id: a.id, title: a.title, score: a.score, savingsMs: a.metricSavings?.LCP ?? a.metricSavings?.FCP ?? null, items: a.details?.items?.length ?? null })),
        warnings: lhr.runWarnings,
      });
    } catch (e) {
      runs.push({ status: "blocked", error: String(e).slice(0, 300) });
    } finally {
      await chrome.kill();
    }
    process.stdout.write(`${page.id} run ${i + 1}: ${runs.at(-1).status} ${runs.at(-1).scores?.performance ?? ""}\n`);
  }
  fs.writeFileSync(path.join(OUT, `${page.id}.json`), JSON.stringify({ page, audited: today, device: "mobile", runs }, null, 1));
}
console.log(`audited ${PAGES.length} pages x ${RUNS} runs -> ${OUT}`);
