// Renders status.json (written by check.mjs) into the page. No dependencies.

const DAYS = 90;
const TEXT = {
  operational: "All systems operational",
  degraded: "Some systems are slow or failing checks",
  outage: "Some systems are down",
};
const STATE = { up: "Operational", degraded: "Degraded", down: "Down" };

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  for (const k of kids) n.append(k);
  return n;
};
const fmtTime = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const fmtDuration = (ms) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

function lastDays() {
  const out = [];
  const now = new Date();
  for (let i = DAYS - 1; i >= 0; i--) out.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i)).toISOString().slice(0, 10));
  return out;
}

function service(id, s) {
  const days = lastDays();
  let up = 0;
  let total = 0;
  const bars = el("div", { class: "bars", role: "img", "aria-label": `${s.name}: uptime over the last ${DAYS} days` });
  for (const d of days) {
    const day = s.days[d];
    const b = el("span");
    if (day && day.total) {
      up += day.up;
      total += day.total;
      const pct = (day.up / day.total) * 100;
      b.className = pct >= 99.5 ? "g" : pct >= 95 ? "y" : "r";
      b.title = `${d}: ${pct.toFixed(2)}% up`;
    } else {
      b.title = `${d}: no data`;
    }
    bars.append(b);
  }
  const uptime = total ? `${((up / total) * 100).toFixed(2)}% uptime` : "No data yet";
  const last = s.last ? `${s.last.ms} ms · checked ${fmtTime(s.last.at)}` : "";
  return el(
    "div",
    { class: "svc", id: `svc-${id}` },
    el("div", { class: "svc-head" }, el("span", { class: "svc-name" }, s.name), el("span", { class: `state ${s.state}` }, STATE[s.state] ?? s.state)),
    bars,
    el("div", { class: "svc-foot" }, el("span", {}, `${DAYS} days ago`), el("span", {}, uptime), el("span", {}, "Today")),
    el("div", { class: "svc-foot" }, el("span", {}, last)),
  );
}

async function main() {
  document.getElementById("year").textContent = String(new Date().getFullYear());
  let data;
  try {
    const res = await fetch(`status.json?t=${Date.now()}`, { cache: "no-store" });
    data = await res.json();
  } catch {
    document.getElementById("headline").textContent = "Status data is unavailable right now";
    return;
  }
  const banner = document.getElementById("banner");
  banner.classList.add(data.summary);
  document.getElementById("headline").textContent = TEXT[data.summary] ?? data.summary;
  document.getElementById("updated").textContent = `Last checked ${fmtTime(data.updated)}`;

  const groups = document.getElementById("groups");
  for (const g of data.groups ?? []) {
    const box = el("div", { class: "group" }, el("h2", {}, g.name));
    for (const id of g.services) if (data.services[id]) box.append(service(id, data.services[id]));
    groups.append(box);
  }

  const list = document.getElementById("incidents");
  list.replaceChildren();
  const recent = (data.incidents ?? []).slice(0, 10);
  if (!recent.length) list.append(el("li", { class: "muted" }, "No incidents in the last 90 days."));
  for (const i of recent) {
    const dur = i.ended ? ` · resolved after ${fmtDuration(new Date(i.ended) - new Date(i.started))}` : " · ongoing";
    list.append(el("li", {}, el("strong", {}, `${i.name} was unavailable`), el("div", { class: "when" }, `${fmtTime(i.started)}${dur}`)));
  }
}

main();
