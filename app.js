"use strict";

/* Water Opportunities Board — renders data/opportunities.json, no dependencies. */

const BEST_MATCH_SCORE = 50; // mirrors config/rules.json thresholds.best_match

const state = { items: [], query: "", type: "all", region: "all", sort: "score" };

const els = {
  results: document.getElementById("results"),
  bestList: document.getElementById("best-list"),
  bestSection: document.getElementById("best-section"),
  empty: document.getElementById("empty-state"),
  error: document.getElementById("load-error"),
  lastUpdated: document.getElementById("last-updated"),
  count: document.getElementById("listing-count"),
  search: document.getElementById("search"),
  type: document.getElementById("filter-type"),
  region: document.getElementById("filter-region"),
  sort: document.getElementById("sort"),
};

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function daysLeft(deadline) {
  if (!deadline) return null;
  const due = new Date(deadline + "T23:59:59");
  if (Number.isNaN(due.getTime())) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - startOfToday) / 86400000);
}

function formatDate(deadline) {
  const d = new Date(deadline + "T12:00:00");
  if (Number.isNaN(d.getTime())) return deadline;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function deadlineHtml(item) {
  if (!item.deadline) return `<span class="deadline">Deadline: see listing</span>`;
  const days = daysLeft(item.deadline);
  let label = `Deadline: ${formatDate(item.deadline)}`;
  if (days !== null) {
    if (days < 0) label += " (closed)";
    else if (days === 0) label += " — today!";
    else if (days === 1) label += " — 1 day left";
    else label += ` — ${days} days left`;
  }
  const cls = days !== null && days <= 7 && days >= 0 ? "deadline urgent" : "deadline";
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

function typeLabel(type) {
  return {
    "internship": "Internship",
    "scholarship": "Scholarship",
    "fellowship": "Fellowship",
    "graduate-trainee": "Graduate Trainee",
    "job": "Job",
  }[type] || type;
}

function isSenior(item) {
  const text = `${item.experience || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
  return text.includes("senior") || /[5-9]\s*\+?\s*years/.test(text);
}

function cardHtml(item) {
  const best = (item.score || 0) >= BEST_MATCH_SCORE;
  const senior = isSenior(item) ? `<span class="badge senior">Senior role</span>` : "";
  const score = typeof item.score === "number"
    ? `<span class="badge score" title="Match score under the board's rules">Match ${item.score}</span>` : "";
  const tags = (item.tags || []).length
    ? `<p class="meta">${item.tags.map(t => `#${escapeHtml(t)}`).join(" ")}</p>` : "";
  return `
  <article class="card${best ? " best" : ""}">
    <div class="badges">
      <span class="badge type-${escapeHtml(item.type)}">${escapeHtml(typeLabel(item.type))}</span>
      ${score}${senior}
    </div>
    <h3><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></h3>
    <p class="org">${escapeHtml(item.organization)}</p>
    <p class="meta"><strong>Location:</strong> ${escapeHtml(item.location || "See listing")} ·
      ${deadlineHtml(item)}</p>
    <p class="meta"><strong>Funding:</strong> ${escapeHtml(item.funding || "See listing")}</p>
    <p class="meta"><strong>Level:</strong> ${escapeHtml(item.experience || "See listing")}</p>
    <p class="summary">${escapeHtml(item.summary || "")}</p>
    ${tags}
    <a class="apply" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">View &amp; apply →</a>
  </article>`;
}

function matches(item) {
  if (state.type !== "all" && item.type !== state.type) return false;
  if (state.region !== "all" && item.region !== state.region) return false;
  if (state.query) {
    const haystack = [item.title, item.organization, item.location, item.summary,
      item.eligibility, (item.tags || []).join(" ")].join(" ").toLowerCase();
    if (!haystack.includes(state.query)) return false;
  }
  return true;
}

function sorted(items) {
  const list = items.slice();
  if (state.sort === "deadline") {
    list.sort((a, b) => {
      if (!a.deadline && !b.deadline) return (b.score || 0) - (a.score || 0);
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline) || (b.score || 0) - (a.score || 0);
    });
  } else {
    list.sort((a, b) => (b.score || 0) - (a.score || 0) ||
      String(a.deadline || "9999").localeCompare(String(b.deadline || "9999")));
  }
  return list;
}

function render() {
  const visible = sorted(state.items.filter(matches));
  els.results.innerHTML = visible.map(cardHtml).join("");
  els.empty.hidden = visible.length > 0;

  const filtering = state.query || state.type !== "all" || state.region !== "all";
  const best = sorted(state.items.filter(i => (i.score || 0) >= BEST_MATCH_SCORE && matches(i)));
  els.bestSection.hidden = best.length === 0;
  els.bestList.innerHTML = best.slice(0, 6).map(cardHtml).join("");
  els.count.textContent = filtering
    ? ` — showing ${visible.length} of ${state.items.length} listings`
    : ` — ${state.items.length} listings`;
}

async function init() {
  try {
    const res = await fetch("data/opportunities.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    state.items = await res.json();
  } catch (err) {
    els.error.hidden = false;
    els.bestSection.hidden = true;
    els.lastUpdated.textContent = "unavailable";
    return;
  }
  try {
    const metaRes = await fetch("data/last_update.json");
    if (metaRes.ok) {
      const meta = await metaRes.json();
      const when = new Date(meta.updated_at);
      els.lastUpdated.textContent = Number.isNaN(when.getTime())
        ? meta.updated_at : when.toLocaleString();
    } else {
      els.lastUpdated.textContent = "unknown";
    }
  } catch (err) {
    els.lastUpdated.textContent = "unknown";
  }
  render();
}

els.search.addEventListener("input", e => { state.query = e.target.value.trim().toLowerCase(); render(); });
els.type.addEventListener("change", e => { state.type = e.target.value; render(); });
els.region.addEventListener("change", e => { state.region = e.target.value; render(); });
els.sort.addEventListener("change", e => { state.sort = e.target.value; render(); });

init();
