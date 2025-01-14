import fs from "node:fs";
import path from "node:path";
import type { Health } from "./types";

/** Reads the audit report at build time; a file without what the page needs fails the build with the reason. */
export function loadHealth(): Health {
  const r = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "data", "health.json"), "utf-8")) as Health;
  const problems = [
    !r.pages?.some((p) => p.group === "MSD" && p.status === "ok") && "an audited MSD page",
    !r.groups?.MSD && "MSD group figures",
    !r.groups?.Peer && "peer group figures",
    !r.backlog?.length && "the fix backlog",
    r.checks?.some((c) => c.status === "fail") && "a failed check",
  ].filter(Boolean);
  if (problems.length) throw new Error(`health.json: ${problems.join(", ")}`);
  return r;
}
