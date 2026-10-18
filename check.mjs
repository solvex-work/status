// Checks every service once and updates data/status.json. Run by the GitHub
// workflow every ten minutes; also runnable by hand: node check.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { record, summarize } from "./lib.mjs";

const TIMEOUT_MS = 10_000;
const services = JSON.parse(await readFile(new URL("./services.json", import.meta.url), "utf8"));
const file = new URL("./data/status.json", import.meta.url);

async function probe(svc) {
  const started = performance.now();
  try {
    const res = await fetch(svc.url, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": "SolvexStatus/1.0 (+https://status.solvex.work)" } });
    return { id: svc.id, ok: res.status < 400, status: res.status, ms: Math.round(performance.now() - started) };
  } catch {
    return { id: svc.id, ok: false, status: 0, ms: Math.round(performance.now() - started) };
  }
}

let prev = null;
try {
  prev = JSON.parse(await readFile(file, "utf8"));
} catch {}

const results = await Promise.all(services.map(probe));
const next = record(prev, services, results, new Date());
next.groups = [...new Set(services.map((s) => s.group))].map((g) => ({ name: g, services: services.filter((s) => s.group === g).map((s) => s.id) }));
next.summary = summarize(next);
await mkdir(new URL("./data/", import.meta.url), { recursive: true });
await writeFile(file, JSON.stringify(next, null, 1) + "\n");
console.log(next.summary, results.map((r) => `${r.id}:${r.ok ? "up" : "down"}(${r.status},${r.ms}ms)`).join(" "));
