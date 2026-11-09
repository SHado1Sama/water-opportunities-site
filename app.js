"use strict";

/* Water Opportunities Board — renders data/opportunities.json, no dependencies. */

const BEST_MATCH_SCORE = 50; // mirrors config/rules.json thresholds.best_match

const SAVED_KEY = "wob_saved_v1";

function loadSaved() {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (err) {
    return new Set();
  }
}

const state = {
  items: [], query: "", type: "all", region: "all", sort: "score",
  level: "all", funding: "all", deadline: "all", mode: "all",
  savedOnly: false, saved: loadSaved(),
};

/* Application tracker status (shared with vault.html, key wob_tracker_v1).
   Cards show a badge once a saved listing moves past "Saved", so visitors
   can see where each application stands while browsing the board. */
const TRACKER_KEY = "wob_tracker_v1";
const TRACKER_STATUSES = ["Saved", "Preparing", "Applied", "Interview", "Outcome"];
function loadTracker() {
  try {
    const raw = localStorage.getItem(TRACKER_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    return {};
  }
}
function trackerBadge(item) {
  if (!state.saved.has(item.id)) return "";
  const idx = Math.min(Math.max(Number(loadTracker()[item.id] || 0), 0), TRACKER_STATUSES.length - 1);
  if (idx === 0) return "";
  const label = TRACKER_STATUSES[idx];
  return `<span class="status-badge status-${idx}" title="Your application status for this listing, from Saved Opportunities">${idx === 2 ? "✓ " : ""}${label}</span>`;
}


const els = {
  results: document.getElementById("results"),
  bestList: document.getElementById("best-list"),
  bestSection: document.getElementById("best-section"),
  empty: document.getElementById("empty-state"),
  error: document.getElementById("load-error"),
  loading: document.getElementById("loading-state"),
  lastUpdated: document.getElementById("last-updated"),
  count: document.getElementById("listing-count"),
  search: document.getElementById("search"),
  type: document.getElementById("filter-type"),
  region: document.getElementById("filter-region"),
  sort: document.getElementById("sort"),
  level: document.getElementById("filter-level"),
  funding: document.getElementById("filter-funding"),
  deadline: document.getElementById("filter-deadline"),
  mode: document.getElementById("filter-mode"),
  savedBtn: document.getElementById("filter-saved"),
  clearBtn: document.getElementById("clear-filters"),
  emptyClear: document.getElementById("empty-clear"),
  errorRetry: document.getElementById("error-retry"),
  filtersToggle: document.getElementById("filters-toggle"),
  controls: document.getElementById("controls"),
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
  if (!item.deadline) return `<span class="due-chip"><span class="icon" aria-hidden="true">📅</span> Deadline: see listing</span>`;
  const days = daysLeft(item.deadline);
  let label = `Closes ${formatDate(item.deadline)}`;
  if (days !== null) {
    if (days < 0) label += " · closed";
    else if (days === 0) label += " · today!";
    else if (days === 1) label += " · 1 day left";
    else label += ` · ${days} days left`;
  }
  const cls = days !== null && days <= 7 && days >= 0 ? "due-chip urgent" : "due-chip";
  return `<span class="${cls}"><span class="icon" aria-hidden="true">📅</span> ${escapeHtml(label)}</span>`;
}

/* Derived facets: the data file has free-text level/funding/location, so the
   Level, Funding and Mode filters classify each listing with simple rules. */
function levelOf(item) {
  const t = `${item.experience || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
  if (isSenior(item) || t.includes("experienced") || t.includes("professional")) return "experienced";
  if (t.includes("student") || t.includes("undergraduate")) return "student";
  if (t.includes("recent graduate") || t.includes("new graduate") || t.includes("master's entry") || t.includes("graduate")) return "graduate";
  return "entry";
}

function fundingOf(item) {
  const t = (item.funding || "").toLowerCase();
  if (t.includes("unpaid") || t.includes("volunteer") || t.includes("no stipend")) return "unpaid";
  if (t.includes("fund") || t.includes("paid") || t.includes("stipend") || t.includes("salary") || t.includes("scholarship") || t.includes("allowance")) return "funded";
  return "other";
}

function modeOf(item) {
  const t = `${item.location || ""} ${(item.tags || []).join(" ")} ${item.region || ""}`.toLowerCase();
  return t.includes("remote") ? "remote" : "onsite";
}

function deadlineMatches(item) {
  if (state.deadline === "all") return true;
  const days = daysLeft(item.deadline);
  if (days === null) return state.deadline === "later";
  if (state.deadline === "14") return days >= 0 && days <= 14;
  if (state.deadline === "30") return days >= 0 && days <= 30;
  return days > 30;
}

function orgInitials(org) {
  const words = String(org || "?").replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const letterWords = words.filter(w => /^[A-Za-z]/.test(w));
  if (letterWords.length >= 2) return (letterWords[0][0] + letterWords[1][0]).toUpperCase();
  if (letterWords.length === 1) return letterWords[0].slice(0, 2).toUpperCase();
  return words.length ? words[0].slice(0, 2).toUpperCase() : "?";
}

function typeLabel(type) {
  return {
    "internship": "Internship",
    "scholarship": "Scholarship",
    "fellowship": "Fellowship",
    "graduate-trainee": "Graduate Trainee",
    "job": "Job",
    "course": "Course",
  }[type] || type;
}

function isSenior(item) {
  const text = `${item.experience || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
  return text.includes("senior") || /[5-9]\s*\+?\s*years/.test(text);
}

function cardHtml(item, index) {
  const best = (item.score || 0) >= BEST_MATCH_SCORE;
  const senior = isSenior(item) ? `<span class="badge senior">Senior role</span>` : "";
  const score = typeof item.score === "number"
    ? `<span class="badge score" title="Match score under the board's rules">Match ${item.score}</span>` : "";
  const tags = (item.tags || []).length
    ? `<p class="meta">${item.tags.map(t => `#${escapeHtml(t)}`).join(" ")}</p>` : "";
  const isSaved = state.saved.has(item.id);
  const delay = Math.min((index || 0) * 45, 270);
  return `
  <article class="card${best ? " best" : ""}" style="--d:${delay}ms">
    <div class="card-top">
      <span class="org-avatar" aria-hidden="true">${escapeHtml(orgInitials(item.organization))}</span>
      <div class="card-head">
        <div class="badges">
          <span class="badge type-${escapeHtml(item.type)}">${escapeHtml(typeLabel(item.type))}</span>
          ${score}${senior}${trackerBadge(item)}
        </div>
        <p class="org">${escapeHtml(item.organization)}</p>
      </div>
      <button type="button" class="bookmark-btn${isSaved ? " saved" : ""}" data-save="${escapeHtml(item.id)}"
        aria-pressed="${isSaved}" aria-label="${isSaved ? "Remove bookmark for" : "Bookmark"} ${escapeHtml(item.title)}"
        title="${isSaved ? "Saved. Tap to remove" : "Save this opportunity"}">${isSaved ? "🔖" : "📑"}</button>
    </div>
    <h3><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></h3>
    <p class="due-line">${deadlineHtml(item)}</p>
    <div class="facts">
      <p class="fact"><span class="icon" aria-hidden="true">📍</span> <strong>${escapeHtml(item.location || "See listing")}</strong></p>
      <p class="fact"><span class="icon" aria-hidden="true">💰</span> ${escapeHtml(item.funding || "See listing")}</p>
      <p class="fact"><span class="icon" aria-hidden="true">🎓</span> ${escapeHtml(item.experience || "See listing")}</p>
    </div>
    <p class="summary">${escapeHtml(item.summary || "")}</p>
    ${tags}
    <p class="card-actions">
      <a class="apply" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${item.type === "course" ? "View course →" : "View &amp; apply →"}</a>
      <button type="button" class="pack-btn" data-pack="${escapeHtml(item.id)}"><span class="icon" aria-hidden="true">📋</span> Application pack</button>
      <button type="button" class="muse-btn" data-muse="${escapeHtml(item.id)}"><span class="icon" aria-hidden="true">🤖</span> Apply with Muse</button>
    </p>
  </article>`;
}

function matches(item) {
  if (state.savedOnly && !state.saved.has(item.id)) return false;
  if (state.type !== "all" && item.type !== state.type) return false;
  if (state.region !== "all" && item.region !== state.region) return false;
  if (state.level !== "all" && levelOf(item) !== state.level) return false;
  if (state.funding !== "all" && fundingOf(item) !== state.funding) return false;
  if (state.mode !== "all" && modeOf(item) !== state.mode) return false;
  if (!deadlineMatches(item)) return false;
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

/* The board is arranged by category: one section per opportunity type. */
const TYPE_ORDER = ["internship", "scholarship", "fellowship", "graduate-trainee", "job", "course"];
const TYPE_HEADINGS = {
  "internship": "🌱 Internships",
  "scholarship": "🎓 Scholarships",
  "fellowship": "🤝 Fellowships",
  "graduate-trainee": "🚀 Graduate Trainee",
  "job": "💼 Jobs",
  "course": "📚 Courses & Training",
};
function groupedHtml(items) {
  const groups = new Map();
  items.forEach(it => {
    const k = TYPE_ORDER.includes(it.type) ? it.type : "job";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  });
  return TYPE_ORDER.filter(k => groups.has(k)).map(k => `
    <div class="type-group">
      <h3 class="type-heading">${TYPE_HEADINGS[k]} <span class="type-count">${groups.get(k).length}</span></h3>
      <div class="cards">${groups.get(k).map((item, i) => cardHtml(item, i)).join("")}</div>
    </div>`).join("");
}

function render() {
  const visible = sorted(state.items.filter(matches));
  els.results.innerHTML = groupedHtml(visible);
  els.empty.hidden = visible.length > 0;

  const filtering = state.query || state.type !== "all" || state.region !== "all" || state.savedOnly ||
    state.level !== "all" || state.funding !== "all" || state.deadline !== "all" || state.mode !== "all";
  markActiveFilters();
  const best = sorted(state.items.filter(i => (i.score || 0) >= BEST_MATCH_SCORE && matches(i)));
  els.bestSection.hidden = best.length === 0;
  els.bestList.innerHTML = best.slice(0, 6).map((item, i) => cardHtml(item, i)).join("");
  els.count.textContent = filtering
    ? ` — showing ${visible.length} of ${state.items.length} listings`
    : ` — ${state.items.length} listings`;
  els.count.classList.remove("pulse");
  void els.count.offsetWidth;
  els.count.classList.add("pulse");
  if (els.savedBtn) {
    els.savedBtn.textContent = state.saved.size
      ? `${state.savedOnly ? "★" : "☆"} Saved only (${state.saved.size})`
      : "☆ Saved only";
    els.savedBtn.classList.toggle("active", state.savedOnly);
    els.savedBtn.setAttribute("aria-pressed", String(state.savedOnly));
  }
}

function activeFilterCount() {
  let n = 0;
  if (state.query) n += 1;
  ["type", "region", "level", "funding", "deadline", "mode"].forEach(k => { if (state[k] !== "all") n += 1; });
  if (state.savedOnly) n += 1;
  return n;
}

function markActiveFilters() {
  const pairs = [[els.type, state.type], [els.region, state.region], [els.level, state.level],
    [els.funding, state.funding], [els.deadline, state.deadline], [els.mode, state.mode]];
  pairs.forEach(([el, val]) => {
    if (!el) return;
    el.classList.toggle("active", val !== "all");
    const wrap = el.closest(".control");
    if (wrap) wrap.classList.toggle("active", val !== "all");
  });
  if (els.search) {
    els.search.classList.toggle("active", Boolean(state.query));
    const wrap = els.search.closest(".control");
    if (wrap) wrap.classList.toggle("active", Boolean(state.query));
  }
  if (els.clearBtn) {
    const n = activeFilterCount();
    els.clearBtn.disabled = n === 0;
    els.clearBtn.textContent = n ? `Clear all filters (${n})` : "Clear all filters";
  }
}

function clearFilters() {
  state.query = ""; state.type = "all"; state.region = "all"; state.level = "all";
  state.funding = "all"; state.deadline = "all"; state.mode = "all"; state.savedOnly = false;
  els.search.value = "";
  [els.type, els.region, els.level, els.funding, els.deadline, els.mode].forEach(el => { if (el) el.value = "all"; });
  render();
}

function toggleSave(id) {
  if (state.saved.has(id)) state.saved.delete(id);
  else state.saved.add(id);
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(Array.from(state.saved))); } catch (err) { /* storage full/blocked: keep in-memory state */ }
  render();
}

async function init() {
  try {
    const res = await fetch("data/opportunities.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    state.items = await res.json();
  } catch (err) {
    if (els.loading) els.loading.hidden = true;
    els.error.hidden = false;
    els.bestSection.hidden = true;
    els.lastUpdated.textContent = "unavailable";
    return;
  }
  if (els.loading) els.loading.hidden = true;
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

/* ---- Application packs (built on-device from the visitor's vault) ---- */

const VAULT_KEY = "wob_vault_v1";
const CLIMATE_WORDS = ["climate", "energy", "renewable", "sustainability", "sustainable", "carbon", "waste", "recycling", "solar", "environment"];
const WATER_WORDS = ["water", "wash", "sanitation", "hygiene", "hydro", "irrigation", "groundwater", "flood", "borehole", "drainage", "watershed", "river"];

function loadVault() {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function vaultHasContent(v) {
  if (!v) return false;
  const p = v.personal || {};
  return Boolean(p.full_name || p.email || (v.education || []).length || (v.experience || []).length ||
    (v.stories && (v.stories.water || v.stories.climate || v.stories.generic)));
}

function pickStoryKey(vault, item) {
  const text = [item.title, item.summary, (item.tags || []).join(" ")].join(" ").toLowerCase();
  const count = words => words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);
  const stories = vault.stories || {};
  let key = count(CLIMATE_WORDS) > count(WATER_WORDS) ? "climate" : "water";
  if (!stories[key]) key = key === "water" ? "climate" : "water";
  if (!stories[key] && stories.generic) key = "generic";
  return key;
}

function lines(pairs) {
  return pairs.filter(([, val]) => val && String(val).trim()).map(([k, val]) => `${k}: ${val}`).join("\n");
}

function educationText(e) {
  const head = [e.degree, e.field].filter(Boolean).join(", ");
  const where = [e.institution, e.city, e.country].filter(Boolean).join(", ");
  const when = [e.start, e.end].filter(Boolean).join(" to ");
  return lines([
    ["Qualification", head], ["Institution", where], ["Period", when],
    ["Class / GPA", e.class_or_gpa], ["Final project", e.project_title],
  ]);
}

function experienceText(x) {
  const where = [x.organisation, x.city, x.country].filter(Boolean).join(", ");
  const when = [x.start, x.end].filter(Boolean).join(" to ");
  const sup = [x.supervisor_name, x.supervisor_phone, x.supervisor_email].filter(Boolean).join(", ");
  return lines([
    ["Role", x.title], ["Organisation", where], ["Period", when],
    ["Paid", x.paid], ["Supervisor", sup], ["Duties and results", x.duties],
  ]);
}

function buildPackBlocks(vault, item, storyKey) {
  const p = vault.personal || {};
  const blocks = [];
  const personal = lines([
    ["Full name", p.full_name], ["Email", p.email], ["Phone", p.phone],
    ["Date of birth", p.date_of_birth], ["Gender", p.gender], ["Marital status", p.marital_status],
    ["Nationality", p.nationality], ["Current city", p.current_city],
    ["Current address", p.current_address], ["Home address", p.home_address],
  ]);
  if (personal) blocks.push({ title: "Personal details", text: personal });
  (vault.education || []).forEach((e, i) => {
    const t = educationText(e);
    if (t) blocks.push({ title: `Education ${vault.education.length > 1 ? (i + 1) : ""}`.trim(), text: t });
  });
  (vault.experience || []).forEach((x, i) => {
    const t = experienceText(x);
    if (t) blocks.push({ title: `Experience ${vault.experience.length > 1 ? (i + 1) : ""}`.trim(), text: t });
  });
  const skills = vault.skills || [];
  if (skills.length) {
    const text = [item.title, item.summary, (item.tags || []).join(" ")].join(" ").toLowerCase();
    const matched = skills.filter(s => text.includes(String(s).toLowerCase()));
    const rest = skills.filter(s => !matched.includes(s));
    blocks.push({
      title: "Skills" + (matched.length ? " (best matches for this listing first)" : ""),
      text: matched.concat(rest).join(", "),
    });
  }
  const langs = (vault.languages || []).join(", ");
  if (langs) blocks.push({ title: "Languages", text: langs });
  const linksText = lines([
    ["GitHub", vault.links && vault.links.github], ["LinkedIn", vault.links && vault.links.linkedin],
    ["Portfolio", vault.links && vault.links.portfolio],
  ]);
  if (linksText) blocks.push({ title: "Links", text: linksText });
  const story = (vault.stories || {})[storyKey];
  if (story) {
    blocks.push({
      title: `Project story (${storyKey} framing)`,
      text: story,
      storySwitcher: true,
    });
  }
  blocks.push({
    title: "Before you apply, checklist",
    text: [
      `Deadline: ${item.deadline ? formatDate(item.deadline) : "see listing"}. Apply on the official listing page and keep proof of submission.`,
      "CV or resume, updated and saved as PDF.",
      "Cover letter, tailored to this organisation and role (your story block above is the core of it).",
      "Degree certificate and transcript, if the listing asks for them.",
      "Passport or national ID, if asked.",
      "Referee or supervisor contact details, including email addresses.",
      "Never pay an application fee. Legitimate employers and scholarship bodies do not charge them.",
    ].map(s => "• " + s).join("\n"),
  });
  return blocks;
}

const packModal = document.getElementById("pack-modal");
const packBody = document.getElementById("pack-body");
const packFor = document.getElementById("pack-for");
let packItem = null;

function renderPack(storyKey) {
  const vault = loadVault();
  if (!vaultHasContent(vault)) {
    packFor.textContent = "";
    packBody.innerHTML = `<div class="pack-block"><p>Your vault is empty, so there is nothing to build a pack from yet.</p>
      <p><a class="btn" href="vault.html">Build your vault first</a></p>
      <p class="section-note">It takes a few minutes, you only do it once, and it stays in your browser.</p></div>`;
    return;
  }
  packFor.textContent = `For: ${packItem.title} at ${packItem.organization}`;
  const key = storyKey || pickStoryKey(vault, packItem);
  packBody.innerHTML = buildPackBlocks(vault, packItem, key).map((b, i) => `
    <div class="pack-block">
      <div class="pack-head"><h3>${escapeHtml(b.title)}</h3>
      ${b.storySwitcher ? `<label class="story-switch">Framing:
        <select id="pack-story-key">
          <option value="water"${key === "water" ? " selected" : ""}>Water</option>
          <option value="climate"${key === "climate" ? " selected" : ""}>Climate &amp; energy</option>
          <option value="generic"${key === "generic" ? " selected" : ""}>Generic</option>
        </select></label>` : ""}
      <button type="button" class="btn small" data-copy="${i}">Copy</button></div>
      <pre class="pack-text">${escapeHtml(b.text)}</pre>
    </div>`).join("");
  packBody.querySelectorAll("[data-copy]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const blocks = buildPackBlocks(vault, packItem, currentStoryKey());
      const text = blocks[Number(btn.getAttribute("data-copy"))].text;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "Copied ✓";
      } catch (err) {
        btn.textContent = "Select the text and copy";
      }
      setTimeout(() => { btn.textContent = "Copy"; }, 2000);
    });
  });
  const sel = document.getElementById("pack-story-key");
  if (sel) sel.addEventListener("change", () => renderPack(sel.value));
}

function currentStoryKey() {
  const sel = document.getElementById("pack-story-key");
  return sel ? sel.value : undefined;
}

function openPack(id) {
  packItem = state.items.find(i => i.id === id);
  if (!packItem) return;
  renderPack();
  if (packModal) packModal.hidden = false;
  const pc = document.getElementById("pack-close");
  if (pc) pc.focus();
}
function closePack() { if (packModal) packModal.hidden = true; }

document.addEventListener("click", e => {
  const saveBtn = e.target.closest("[data-save]");
  if (saveBtn) { toggleSave(saveBtn.getAttribute("data-save")); return; }
  const btn = e.target.closest("[data-pack]");
  if (btn) openPack(btn.getAttribute("data-pack"));
  const mBtn = e.target.closest("[data-muse]");
  if (mBtn) openMuse(mBtn.getAttribute("data-muse"));
});
const packCloseBtn = document.getElementById("pack-close");
if (packCloseBtn) packCloseBtn.addEventListener("click", closePack);
if (packModal) packModal.addEventListener("click", e => { if (e.target === packModal) closePack(); });
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (packModal && !packModal.hidden) closePack();
  if (museModal && !museModal.hidden) closeMuse();
});

/* ---- Apply with Muse: a copy-ready brief for the visitor's own Muse agent ----
   The site cannot talk to a visitor's agent directly, so it hands the visitor a
   structured brief to paste into their own Muse. The brief carries the listing
   plus the board's working rules: the agent prepares and fills, the human
   cross-checks and submits. If the visitor has a site vault, the brief can
   include their details so their agent does not have to ask for everything. */

// New visitors can join Muse through this link. (Site owner: swap in your
// personal Muse invite link here so sign-ups come through your board.)
const MUSE_HOME_URL = "https://muse.ai";

const museModal = document.getElementById("muse-modal");
const museBody = document.getElementById("muse-body");
const museFor = document.getElementById("muse-for");
let museItem = null;

function buildAgentBrief(item, vault) {
  const parts = [];
  parts.push("You are Muse, my personal AI assistant. I found this opportunity on the Water and Environmental Opportunities Board and I want you to help me apply for it. Work the careful way throughout: you prepare and fill, I review and submit.");
  parts.push("");
  parts.push("THE OPPORTUNITY");
  parts.push(lines([
    ["Title", item.title],
    ["Organisation", item.organization],
    ["Type", typeLabel(item.type)],
    ["Location", item.location],
    ["Funding", item.funding],
    ["Deadline", item.deadline ? `${formatDate(item.deadline)} (${item.deadline})` : "see listing"],
    ["Apply here", item.url],
    ["About", item.summary],
    ["Eligibility", item.eligibility],
  ]));
  parts.push("");
  parts.push("HOW I WANT YOU TO HELP");
  [
    "Open the listing link and confirm it is still live and the deadline has not passed. Tell me the exact closing date.",
    "Check my eligibility against the listing requirements using my details. Flag anything I do not meet or cannot prove yet, and ask me about gaps instead of guessing.",
    "If I have not given you my details yet, collect them into an application vault I can reuse: full name, email, phone, date of birth, nationality, current and home addresses, education (institution, qualification, dates, class of degree, final year project), work and internship experience (organisation, role, dates, supervisor name, phone and email, duties), skills, languages, links, and a short project story.",
    "Draft my application answers and cover letter from my real experience only. Never invent qualifications, employers, dates or results. Show me every draft before you use it.",
    "When I say go, fill the application form with my details, then STOP before the final submit button and show me a summary of everything you entered. I will cross-check and submit it myself.",
    "Track this application and remind me ahead of the deadline if I have not submitted.",
  ].forEach((s, i) => parts.push(`${i + 1}. ${s}`));
  parts.push("");
  parts.push("RULES");
  [
    "Never pay any fee on my behalf and never enter my payment details. If the process asks for an application fee, stop and tell me: legitimate employers and scholarship bodies do not charge them.",
    "Never click the final submit for me.",
    "If anything about the listing looks like a scam, say so plainly.",
  ].forEach(s => parts.push(`- ${s}`));
  if (vault && vaultHasContent(vault)) {
    parts.push("");
    parts.push("MY DETAILS (from my application vault on the board; use these, and ask me only for what is missing)");
    buildPackBlocks(vault, item, pickStoryKey(vault, item))
      .filter(b => !b.title.startsWith("Before you apply"))
      .forEach(b => { parts.push(""); parts.push(b.title.toUpperCase()); parts.push(b.text); });
  }
  return parts.join("\n");
}

function renderMuse() {
  const vault = loadVault();
  const hasVault = vaultHasContent(vault);
  museFor.textContent = `For: ${museItem.title} at ${museItem.organization}`;
  museBody.innerHTML = `
    <ol class="muse-steps">
      <li>Copy the brief below.</li>
      <li>Open your Muse and paste it as a new message.</li>
      <li>Your Muse checks the listing, drafts from your details, fills the form, and stops before submit so you cross-check and submit yourself.</li>
    </ol>
    ${hasVault
      ? `<label class="muse-vault-toggle"><input type="checkbox" id="muse-include-vault" checked>
           <span>Include my vault details in the brief (recommended: your Muse can start right away instead of asking for everything)</span></label>`
      : `<p class="section-note">Tip: <a href="vault.html">build your free vault</a> on this site first and this brief can carry your details automatically.</p>`}
    <div class="pack-block">
      <div class="pack-head"><h3>Your agent brief</h3>
        <button type="button" class="btn small" id="muse-copy">Copy brief</button>
        <a class="btn small secondary" href="${MUSE_HOME_URL}" target="_blank" rel="noopener noreferrer">Open Muse</a>
      </div>
      <pre class="pack-text" id="muse-brief-text"></pre>
    </div>
    <p class="section-note">No Muse yet? <a href="${MUSE_HOME_URL}" target="_blank" rel="noopener noreferrer">Get Muse</a>, then come back and copy this brief.
    The brief exists only in this tab and on your clipboard: this site sends nothing anywhere.</p>`;
  const update = () => {
    const cb = document.getElementById("muse-include-vault");
    document.getElementById("muse-brief-text").textContent =
      buildAgentBrief(museItem, cb && cb.checked ? vault : null);
  };
  update();
  const cb = document.getElementById("muse-include-vault");
  if (cb) cb.addEventListener("change", update);
  const copyBtn = document.getElementById("muse-copy");
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(document.getElementById("muse-brief-text").textContent);
      copyBtn.textContent = "Copied ✓";
    } catch (err) {
      copyBtn.textContent = "Select the text and copy";
    }
    setTimeout(() => { copyBtn.textContent = "Copy brief"; }, 2000);
  });
}

function openMuse(id) {
  museItem = state.items.find(i => i.id === id);
  if (!museItem) return;
  renderMuse();
  if (museModal) museModal.hidden = false;
  const mc = document.getElementById("muse-close");
  if (mc) mc.focus();
}
function closeMuse() { if (museModal) museModal.hidden = true; }
const museCloseBtn = document.getElementById("muse-close");
if (museCloseBtn) museCloseBtn.addEventListener("click", closeMuse);
if (museModal) museModal.addEventListener("click", e => { if (e.target === museModal) closeMuse(); });

let searchTimer = null;
els.search.addEventListener("input", e => {
  const value = e.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.query = value.trim().toLowerCase(); render(); }, 120);
});
els.type.addEventListener("change", e => { state.type = e.target.value; render(); });
els.region.addEventListener("change", e => { state.region = e.target.value; render(); });
els.sort.addEventListener("change", e => { state.sort = e.target.value; render(); });
if (els.level) els.level.addEventListener("change", e => { state.level = e.target.value; render(); });
if (els.funding) els.funding.addEventListener("change", e => { state.funding = e.target.value; render(); });
if (els.deadline) els.deadline.addEventListener("change", e => { state.deadline = e.target.value; render(); });
if (els.mode) els.mode.addEventListener("change", e => { state.mode = e.target.value; render(); });
if (els.savedBtn) {
  els.savedBtn.addEventListener("click", () => { state.savedOnly = !state.savedOnly; render(); });
}
if (els.clearBtn) els.clearBtn.addEventListener("click", clearFilters);
if (els.emptyClear) els.emptyClear.addEventListener("click", clearFilters);
if (els.errorRetry) els.errorRetry.addEventListener("click", () => window.location.reload());
if (els.filtersToggle && els.controls) {
  els.filtersToggle.addEventListener("click", () => {
    const open = els.controls.classList.toggle("open");
    els.filtersToggle.setAttribute("aria-expanded", String(open));
    const label = document.getElementById("filters-toggle-state");
    if (label) label.textContent = open ? "· hide" : "· show";
  });
}

init();
