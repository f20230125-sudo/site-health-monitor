"use client";

import type { Check, Health as H, Page } from "@/lib/types";
import { Bars, type Bar } from "./Bars";
import { Fig } from "./Fig";
import { ThemeToggle } from "./ThemeToggle";

const SECTIONS = [
  { id: "scores", label: "Scores" },
  { id: "speed", label: "Loading speed" },
  { id: "backlog", label: "Fix backlog" },
  { id: "platforms", label: "Platforms" },
  { id: "checks", label: "Checks" },
  { id: "method", label: "Method" },
];
const STATUS_WORD = { pass: "Pass", warn: "Review", fail: "Fail", info: "Info" } as const;
const score = (v: number | undefined) => (v == null ? "n/a" : String(Math.round(v * 100)));
const secs = (ms: number | undefined) => (ms == null ? "n/a" : `${(ms / 1000).toFixed(1)} s`);
const mb = (b: number | undefined) => (b == null ? "n/a" : `${(b / 1e6).toFixed(1)} MB`);
const name = (p: Page) => (p.group === "MSD" ? `MSD ${p.page.toLowerCase()}` : p.company);
const dateLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function StatusGlyph({ s }: { s: Check["status"] }) {
  const d = { pass: "M3 8.5l3 3 7-7", warn: "M8 4v5", fail: "M4 4l8 8M12 4l-8 8", info: "M8 7v5" }[s];
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {s !== "pass" && s !== "fail" && <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.3" />}
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {s === "warn" && <circle cx="8" cy="11.6" r="1" fill="currentColor" />}
      {s === "info" && <circle cx="8" cy="4.6" r="1" fill="currentColor" />}
    </svg>
  );
}

export function Health({ r, repoUrl }: { r: H; repoUrl?: string }) {
  const ok = r.pages.filter((p) => p.status === "ok");
  const blocked = r.pages.filter((p) => p.status === "blocked");
  const msd = r.groups.MSD;
  const peer = r.groups.Peer;
  const byPerf = [...ok].sort((a, b) => (b.performance ?? 0) - (a.performance ?? 0));
  const perfRows: Bar[] = byPerf.map((p) => ({
    label: name(p),
    value: p.performance ?? 0,
    tone: p.group === "MSD" ? "msd" : "ink",
    text: score(p.performance),
    tip: [
      { label: "Accessibility", value: score(p.accessibility) },
      { label: "Best practices", value: score(p.bestPractices) },
      { label: "SEO", value: score(p.seo) },
    ],
  }));
  const lcpRows: Bar[] = [...ok]
    .sort((a, b) => (a.lcpMs ?? 0) - (b.lcpMs ?? 0))
    .map((p) => ({ label: name(p), value: (p.lcpMs ?? 0) / 1000, tone: p.group === "MSD" ? "msd" : "ink", text: secs(p.lcpMs), tip: [{ label: "Page weight", value: mb(p.bytes) }, { label: "Blocking time", value: secs(p.tbtMs) }] }));
  const lcpMax = Math.ceil(Math.max(...lcpRows.map((x) => x.value)) / 5) * 5;
  const top = r.backlog.slice(0, 12);

  return (
    <>
      <a className="skip" href="#main">
        Skip to the report
      </a>
      <header className="bar">
        <div className="shell bar-in">
          <a className="brand" href="#top">
            Site Health Monitor
          </a>
          <nav aria-label="Sections">
            {SECTIONS.map((x) => (
              <a key={x.id} href={`#${x.id}`}>
                {x.label}
              </a>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="shell">
        <section className="hero" id="top">
          <p className="kicker">
            <b>Site Health Monitor</b> · a digital platform case study by Mohammad Uzair Khan: automated Lighthouse audits of public pharmaceutical websites
          </p>
          <h1>
            MSD&rsquo;s WordPress pages beat the peer median on mobile performance ({score(msd.performance)} against {score(peer.performance)}) but trail it on accessibility ({score(msd.accessibility)} against{" "}
            {score(peer.accessibility)}), and the main content takes {secs(msd.lcpMs)} to appear on a mid-range phone
          </h1>
          <p className="lede">
            {ok.filter((p) => p.group === "MSD").length} pages of msd.com and the home pages of {ok.filter((p) => p.group === "Peer").length} peers, audited with Lighthouse on its mobile setting on {dateLabel(r.audited)}. Every
            failing audit on MSD&rsquo;s pages becomes a ranked fix, written for a WordPress site. The job reruns every week, so a fix shows up as a better score.
          </p>
          <dl className="figs">
            <div>
              <dt>MSD median, performance · accessibility</dt>
              <dd>
                {score(msd.performance)} · {score(msd.accessibility)}
              </dd>
            </div>
            <div>
              <dt>Peer median, performance · accessibility</dt>
              <dd>
                {score(peer.performance)} · {score(peer.accessibility)}
              </dd>
            </div>
            <div>
              <dt>MSD page weight, median</dt>
              <dd>
                {mb(msd.bytes)} (peers {mb(peer.bytes)})
              </dd>
            </div>
            <div>
              <dt>Fixes in MSD&rsquo;s backlog</dt>
              <dd>{r.backlog.length}</dd>
            </div>
          </dl>
        </section>

        <section className="sec" id="scores" aria-labelledby="scores-h">
          <div className="sec-head">
            <h2 id="scores-h">Lighthouse scores, mobile</h2>
            <p className="dek">
              Scores run from 0 to 100; 90 and above is good. Performance is the hardest on a phone: Lighthouse loads the page as a mid-range phone on a slow 4G connection.
              {blocked.length ? ` ${blocked.map((p) => p.company).join(", ")} blocked the automated audit and ${blocked.length === 1 ? "is" : "are"} left out rather than scored.` : ""}
            </p>
          </div>
          <Fig
            title="Performance score by page"
            source={<>Source: Lighthouse {""}audits run from Dubai on {dateLabel(r.audited)}; for pages run more than once, the median run.</>}
            table={
              <table className="tbl">
                <caption className="sr-only">Lighthouse scores by page</caption>
                <thead>
                  <tr>
                    <th scope="col">Page</th>
                    <th scope="col" className="n">
                      Performance
                    </th>
                    <th scope="col" className="n">
                      Accessibility
                    </th>
                    <th scope="col" className="n">
                      Best practices
                    </th>
                    <th scope="col" className="n">
                      SEO
                    </th>
                    <th scope="col" className="n">
                      Runs
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.pages.map((p) => (
                    <tr key={p.id}>
                      <th scope="row">{name(p)}</th>
                      {p.status === "ok" ? (
                        <>
                          <td className="n">{score(p.performance)}</td>
                          <td className="n">{score(p.accessibility)}</td>
                          <td className="n">{score(p.bestPractices)}</td>
                          <td className="n">{score(p.seo)}</td>
                        </>
                      ) : (
                        <td colSpan={4}>blocked the audit</td>
                      )}
                      <td className="n">{p.runsOk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <Bars rows={perfRows} label={170} ariaLabel={`Performance score: ${perfRows.map((x) => `${x.label} ${x.text}`).join("; ")}.`} tickFormat={(t) => String(Math.round(t * 100))} ticks={[0, 0.25, 0.5, 0.75, 1]} />
          </Fig>
        </section>

        <section className="sec" id="speed" aria-labelledby="speed-h">
          <div className="sec-head">
            <h2 id="speed-h">How long until the main content appears</h2>
            <p className="dek">Largest Contentful Paint: when the biggest image or text block is drawn. Google counts 2.5 seconds or less as good. Hover a bar for page weight and blocking time.</p>
          </div>
          <Fig
            title="Largest Contentful Paint, mobile"
            source={<>Source: Lighthouse lab measurement, simulated mid-range phone on slow 4G. Not field data from real visitors.</>}
            table={
              <table className="tbl">
                <caption className="sr-only">Loading metrics by page</caption>
                <thead>
                  <tr>
                    <th scope="col">Page</th>
                    <th scope="col" className="n">
                      Largest paint
                    </th>
                    <th scope="col" className="n">
                      First paint
                    </th>
                    <th scope="col" className="n">
                      Blocking time
                    </th>
                    <th scope="col" className="n">
                      Layout shift
                    </th>
                    <th scope="col" className="n">
                      Page weight
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ok.map((p) => (
                    <tr key={p.id}>
                      <th scope="row">{name(p)}</th>
                      <td className="n">{secs(p.lcpMs)}</td>
                      <td className="n">{secs(p.fcpMs)}</td>
                      <td className="n">{secs(p.tbtMs)}</td>
                      <td className="n">{p.cls == null ? "n/a" : p.cls.toFixed(3)}</td>
                      <td className="n">{mb(p.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <Bars
              rows={lcpRows}
              label={170}
              ariaLabel={`Largest Contentful Paint: ${lcpRows.map((x) => `${x.label} ${x.text}`).join("; ")}.`}
              tickFormat={(t) => `${t} s`}
              ticks={Array.from({ length: lcpMax / 5 + 1 }, (_, i) => i * 5)}
            />
          </Fig>
        </section>

        <section className="sec" id="backlog" aria-labelledby="backlog-h">
          <div className="sec-head">
            <h2 id="backlog-h">MSD&rsquo;s fix backlog: {r.backlog.length} failing audits, ranked</h2>
            <p className="dek">
              Each failing audit on MSD&rsquo;s pages, ranked by the share of MSD pages it affects and how badly it fails, with the remedy written for a WordPress site. The first {top.length} are shown; the workbook has
              all of them.
            </p>
          </div>
          <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Fix backlog: table">
            <table className="tbl backlog">
              <caption>Highest priority first</caption>
              <thead>
                <tr>
                  <th scope="col">Issue</th>
                  <th scope="col">Area</th>
                  <th scope="col" className="n">
                    MSD pages
                  </th>
                  <th scope="col">Fix</th>
                </tr>
              </thead>
              <tbody>
                {top.map((b) => (
                  <tr key={b.id}>
                    <th scope="row">{b.title.replace(/`/g, "")}</th>
                    <td>{b.area}</td>
                    <td className="n">
                      {b.pages} of {b.ofPages}
                    </td>
                    <td>{b.fix}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="sec" id="platforms" aria-labelledby="platforms-h">
          <div className="sec-head">
            <h2 id="platforms-h">What each site runs on</h2>
            <p className="dek">Read from each page&rsquo;s own public markup (file paths a platform leaves behind), not from any private source.</p>
          </div>
          <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Platforms: table">
            <table className="tbl">
              <caption className="sr-only">Platform by site</caption>
              <thead>
                <tr>
                  <th scope="col">Page</th>
                  <th scope="col">Address</th>
                  <th scope="col">Platform</th>
                </tr>
              </thead>
              <tbody>
                {r.pages.map((p) => (
                  <tr key={p.id}>
                    <th scope="row">{name(p)}</th>
                    <td>{p.url.replace(/^https:\/\//, "")}</td>
                    <td>{p.platform}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="sec" id="checks" aria-labelledby="checks-h">
          <div className="sec-head">
            <h2 id="checks-h">Checks on each audit run</h2>
          </div>
          <ul className="qlist">
            {r.checks.map((c) => (
              <li className="qrow" key={c.id}>
                <span className="st">
                  <StatusGlyph s={c.status} />
                  {STATUS_WORD[c.status]}
                </span>
                <span>
                  <span className="nm">{c.check}</span>
                  <span className="rs">
                    {c.result} · rule: {c.rule}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="sec" id="method" aria-labelledby="method-h">
          <div className="sec-head">
            <h2 id="method-h">Method, downloads and limits</h2>
          </div>
          <ol className="method">
            <li>
              <b>Audit.</b> Lighthouse in a fresh headless Chromium for each run (no profile, no login, nothing kept), mobile setting, performance, accessibility, best practices and SEO. A page that shows a bot wall is
              recorded as blocked.
            </li>
            <li>
              <b>Report.</b> The median run per page, MSD against peers, the platform from public markup, and a backlog of MSD&rsquo;s failing audits with WordPress remedies; written to this page and an Excel workbook, with
              each week appended to a history file.
            </li>
            <li>
              <b>Automate.</b> A scheduled GitHub Actions job reruns the audits every week and commits the result, so the effect of a fix shows up as a trend.
            </li>
            <li>
              <b>Light touch.</b> A few page loads per site per week, about what one visitor makes: no crawling, no forms, no login.
            </li>
          </ol>
          <p className="downloads">
            <a className="btn" href="/downloads/Site-Health-Monitor.xlsx" download>
              Download the Excel workbook (.xlsx)
            </a>
          </p>
          <p className="limits">
            <b>Limits.</b> Lab measurements from one machine in Dubai on one day, not the experience of real visitors (Google&rsquo;s field data needs an API key). Performance scores move by several points between runs, which is
            why runs are repeated. Home pages compared with MSD&rsquo;s inner pages are a rough peer comparison. An independent audit of public pages, not produced or endorsed by MSD or any company named.
          </p>
        </section>
      </main>

      <footer className="foot">
        <div className="shell">
          <p className="disc">
            Built by Mohammad Uzair Khan · {repoUrl ? <a href={repoUrl}>Code on GitHub</a> : "Code on GitHub"} · audited {dateLabel(r.audited)}
          </p>
        </div>
      </footer>
    </>
  );
}
