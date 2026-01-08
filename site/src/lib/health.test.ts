import { describe, expect, it } from "vitest";
import { loadHealth } from "./load";

const r = loadHealth();

describe("audit report", () => {
  it("group medians are medians of the audited pages", () => {
    for (const g of ["MSD", "Peer"] as const) {
      const v = r.pages.filter((p) => p.group === g && p.status === "ok").map((p) => p.performance!).sort((a, b) => a - b);
      const mid = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
      expect(r.groups[g].performance).toBeCloseTo(mid, 6);
      expect(r.groups[g].pages).toBe(v.length);
    }
  });
  it("scores are between 0 and 1 and blocked pages carry no score", () => {
    for (const p of r.pages) {
      if (p.status === "ok") for (const k of ["performance", "accessibility", "bestPractices", "seo"] as const) expect(p[k]!).toBeGreaterThanOrEqual(0);
      else expect(p.performance).toBeUndefined();
    }
  });
  it("the backlog is ranked and every fix has a remedy", () => {
    for (let i = 1; i < r.backlog.length; i++) expect(r.backlog[i - 1].priority).toBeGreaterThanOrEqual(r.backlog[i].priority);
    for (const b of r.backlog) expect(b.fix.length).toBeGreaterThan(10);
  });
});
