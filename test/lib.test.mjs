import { test } from "node:test";
import assert from "node:assert/strict";
import { record, summarize } from "../lib.mjs";

const SERVICES = [{ id: "radar", name: "Radar", url: "https://radar.example/" }];
const at = (iso) => new Date(iso);

test("first check starts the record", () => {
  const s = record(null, SERVICES, [{ id: "radar", ok: true, status: 200, ms: 120 }], at("2026-10-18T10:00:00Z"));
  assert.equal(s.services.radar.state, "up");
  assert.deepEqual(s.services.radar.days["2026-10-18"], { up: 1, total: 1 });
  assert.equal(s.services.radar.last.ms, 120);
});

test("one failure is degraded, two in a row is down and opens an incident", () => {
  let s = record(null, SERVICES, [{ id: "radar", ok: true, status: 200, ms: 100 }], at("2026-10-18T10:00:00Z"));
  s = record(s, SERVICES, [{ id: "radar", ok: false, status: 503, ms: 80 }], at("2026-10-18T10:10:00Z"));
  assert.equal(s.services.radar.state, "degraded");
  assert.equal(s.incidents.length, 0);
  s = record(s, SERVICES, [{ id: "radar", ok: false, status: 503, ms: 80 }], at("2026-10-18T10:20:00Z"));
  assert.equal(s.services.radar.state, "down");
  assert.equal(s.incidents.length, 1);
  assert.equal(s.incidents[0].started, "2026-10-18T10:10:00.000Z");
  assert.equal(s.incidents[0].ended, null);
});

test("recovery closes the incident", () => {
  let s = null;
  for (const [t, ok] of [["10:00", true], ["10:10", false], ["10:20", false], ["10:30", true]])
    s = record(s, SERVICES, [{ id: "radar", ok, status: ok ? 200 : 500, ms: 90 }], at(`2026-10-18T${t}:00Z`));
  assert.equal(s.services.radar.state, "up");
  assert.equal(s.incidents[0].ended, "2026-10-18T10:30:00.000Z");
  assert.deepEqual(s.services.radar.days["2026-10-18"], { up: 2, total: 4 });
});

test("keeps 90 days of history", () => {
  let s = null;
  for (let d = 0; d < 95; d++) s = record(s, SERVICES, [{ id: "radar", ok: true, status: 200, ms: 50 }], new Date(Date.UTC(2026, 0, 1 + d, 12)));
  assert.equal(Object.keys(s.services.radar.days).length, 90);
});

test("summary is operational only when everything is up", () => {
  const s = record(null, [...SERVICES, { id: "web", name: "Web", url: "https://web.example/" }], [
    { id: "radar", ok: true, status: 200, ms: 1 },
    { id: "web", ok: true, status: 200, ms: 1 },
  ], at("2026-10-18T10:00:00Z"));
  assert.equal(summarize(s), "operational");
  s.services.web.state = "down";
  assert.equal(summarize(s), "outage");
});
