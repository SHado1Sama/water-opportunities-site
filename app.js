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

const state = { items: [], query: "", type: "all", region: "all", sort: "score", savedOnly: false, saved: loadSaved() };

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
  savedBtn: document.getElementById("filter-saved"),
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
    <p class="card-actions">
      <a class="apply" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">View &amp; apply →</a>
      <button type="button" class="pack-btn" data-pack="${escapeHtml(item.id)}"><span class="icon" aria-hidden="true">📋</span> Application pack</button>
      <button type="button" class="save-btn${isSaved ? " saved" : ""}" data-save="${escapeHtml(item.id)}" aria-pressed="${isSaved}"><span class="icon" aria-hidden="true">${isSaved ? "★" : "☆"}</span> ${isSaved ? "Saved" : "Save"}</button>
    </p>
  </article>`;
}

function matches(item) {
  if (state.savedOnly && !state.saved.has(item.id)) return false;
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
  els.results.innerHTML = visible.map((item, i) => cardHtml(item, i)).join("");
  els.empty.hidden = visible.length > 0;

  const filtering = state.query || state.type !== "all" || state.region !== "all" || state.savedOnly;
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
  packModal.hidden = false;
  document.getElementById("pack-close").focus();
}
function closePack() { packModal.hidden = true; }

document.addEventListener("click", e => {
  const saveBtn = e.target.closest("[data-save]");
  if (saveBtn) { toggleSave(saveBtn.getAttribute("data-save")); return; }
  const btn = e.target.closest("[data-pack]");
  if (btn) openPack(btn.getAttribute("data-pack"));
});
document.getElementById("pack-close").addEventListener("click", closePack);
packModal.addEventListener("click", e => { if (e.target === packModal) closePack(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !packModal.hidden) closePack(); });

let searchTimer = null;
els.search.addEventListener("input", e => {
  const value = e.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.query = value.trim().toLowerCase(); render(); }, 120);
});
els.type.addEventListener("change", e => { state.type = e.target.value; render(); });
els.region.addEventListener("change", e => { state.region = e.target.value; render(); });
els.sort.addEventListener("change", e => { state.sort = e.target.value; render(); });
if (els.savedBtn) {
  els.savedBtn.addEventListener("click", () => { state.savedOnly = !state.savedOnly; render(); });
}

init();
