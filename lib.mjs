// The status record: what every check found, folded into per-day uptime and
// incidents. Pure functions, so the rules are easy to test.

const DAYS_KEPT = 90;
const INCIDENTS_KEPT = 50;

const dayOf = (d) => d.toISOString().slice(0, 10);

/**
 * Folds one round of checks into the record. One failure marks a service
 * degraded; two in a row mark it down and open an incident; the next success
 * closes it.
 */
export function record(prev, services, results, now) {
  const s = prev ? structuredClone(prev) : { updated: null, services: {}, incidents: [] };
  const at = now.toISOString();
  const today = dayOf(now);
  for (const svc of services) {
    const r = results.find((x) => x.id === svc.id);
    if (!r) continue;
    const cur = s.services[svc.id] ?? { name: svc.name, url: svc.url, state: "up", failures: 0, last: null, days: {} };
    cur.name = svc.name;
    cur.url = svc.url;
    const day = cur.days[today] ?? { up: 0, total: 0 };
    day.total += 1;
    if (r.ok) day.up += 1;
    cur.days[today] = day;
    cur.last = { ok: r.ok, status: r.status, ms: r.ms, at };

    if (r.ok) {
      if (cur.state === "down") {
        const open = s.incidents.find((i) => i.service === svc.id && i.ended === null);
        if (open) open.ended = at;
      }
      cur.failures = 0;
      cur.state = "up";
    } else {
      cur.failures += 1;
      if (cur.failures === 1) {
        cur.state = "degraded";
        cur.firstFailure = at;
      } else if (cur.state !== "down") {
        cur.state = "down";
        s.incidents.unshift({ service: svc.id, name: svc.name, started: cur.firstFailure ?? at, ended: null });
      }
    }
    const keep = Object.keys(cur.days).sort().slice(-DAYS_KEPT);
    cur.days = Object.fromEntries(keep.map((k) => [k, cur.days[k]]));
    s.services[svc.id] = cur;
  }
  s.incidents = s.incidents.slice(0, INCIDENTS_KEPT);
  s.updated = at;
  return s;
}

/** operational | degraded | outage, for the banner. */
export function summarize(s) {
  const states = Object.values(s.services).map((x) => x.state);
  if (states.includes("down")) return "outage";
  if (states.includes("degraded")) return "degraded";
  return "operational";
}
