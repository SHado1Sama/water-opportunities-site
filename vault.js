"use strict";

/* My Application Vault: local-first. Data lives in this browser only (localStorage).
   Schema v1 mirrors the vault structure used by the board's application packs. */

const VAULT_KEY = "wob_vault_v1";

const PERSONAL_FIELDS = [
  "full_name", "email", "phone", "date_of_birth", "gender", "marital_status",
  "nationality", "country_of_residence", "current_city", "current_address",
  "home_address", "passport_or_id",
];

const EDUCATION_FIELDS = [
  ["degree", "Degree (e.g. B.Eng.)"],
  ["field", "Field of study"],
  ["institution", "Institution"],
  ["city", "City"],
  ["country", "Country"],
  ["start", "Start (e.g. 2019-11)"],
  ["end", "End (e.g. 2026-10)"],
  ["class_or_gpa", "Class / GPA"],
  ["project_title", "Final project title (optional)"],
];

const EXPERIENCE_FIELDS = [
  ["title", "Role / job title"],
  ["organisation", "Organisation"],
  ["city", "City"],
  ["country", "Country"],
  ["start", "Start (e.g. 2025-06)"],
  ["end", "End (e.g. 2025-11)"],
  ["paid", "Paid? (yes / no)"],
  ["supervisor_name", "Supervisor name"],
  ["supervisor_phone", "Supervisor phone"],
  ["supervisor_email", "Supervisor email"],
  ["duties", "Duties and results (a few sentences)"],
];

function blankVault() {
  return {
    vault_version: 1,
    personal: {},
    education: [],
    experience: [],
    skills: [],
    languages: [],
    links: { github: "", linkedin: "", portfolio: "" },
    stories: { water: "", climate: "", generic: "", one_liner: "" },
  };
}

function loadVault() {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return blankVault();
    const data = JSON.parse(raw);
    const base = blankVault();
    return {
      vault_version: 1,
      personal: Object.assign({}, data.personal || {}),
      education: Array.isArray(data.education) ? data.education : base.education,
      experience: Array.isArray(data.experience) ? data.experience : base.experience,
      skills: Array.isArray(data.skills) ? data.skills : [],
      languages: Array.isArray(data.languages) ? data.languages : [],
      links: Object.assign(base.links, data.links || {}),
      stories: Object.assign(base.stories, data.stories || {}),
    };
  } catch (err) {
    return blankVault();
  }
}

let saveTimer = null;
function persist(vault) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
  const el = document.getElementById("save-state");
  if (el) el.textContent = "Saved in this browser · " + new Date().toLocaleTimeString();
}
function persistSoon(vault) {
  const el = document.getElementById("save-state");
  if (el) el.textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persist(vault), 300);
}

function entryCard(kind, fields, entry, onChange, onRemove) {
  const wrap = document.createElement("div");
  wrap.className = "entry-card";
  fields.forEach(([key, label]) => {
    const lab = document.createElement("label");
    lab.textContent = label;
    let input;
    if (key === "duties" || key === "project_title") {
      input = document.createElement("textarea");
      input.rows = key === "duties" ? 4 : 2;
    } else {
      input = document.createElement("input");
      input.type = "text";
    }
    input.value = entry[key] || "";
    input.addEventListener("input", () => { entry[key] = input.value; onChange(); });
    lab.appendChild(input);
    wrap.appendChild(lab);
  });
  const rm = document.createElement("button");
  rm.type = "button";
  rm.className = "btn danger small";
  rm.textContent = "Remove entry";
  rm.addEventListener("click", () => { onRemove(); });
  wrap.appendChild(rm);
  return wrap;
}

function renderEntries(vault) {
  const eduList = document.getElementById("education-list");
  eduList.innerHTML = "";
  vault.education.forEach((entry, i) => {
    eduList.appendChild(entryCard("education", EDUCATION_FIELDS, entry,
      () => persistSoon(vault),
      () => { vault.education.splice(i, 1); persist(vault); renderEntries(vault); }));
  });
  const expList = document.getElementById("experience-list");
  expList.innerHTML = "";
  vault.experience.forEach((entry, i) => {
    expList.appendChild(entryCard("experience", EXPERIENCE_FIELDS, entry,
      () => persistSoon(vault),
      () => { vault.experience.splice(i, 1); persist(vault); renderEntries(vault); }));
  });
}

function fillForm(vault) {
  PERSONAL_FIELDS.forEach(f => {
    const el = document.getElementById("p-" + f);
    if (el) el.value = vault.personal[f] || "";
  });
  document.getElementById("skills").value = (vault.skills || []).join(", ");
  document.getElementById("languages").value = (vault.languages || []).join(", ");
  document.getElementById("link-github").value = vault.links.github || "";
  document.getElementById("link-linkedin").value = vault.links.linkedin || "";
  document.getElementById("link-portfolio").value = vault.links.portfolio || "";
  document.getElementById("story-water").value = vault.stories.water || "";
  document.getElementById("story-climate").value = vault.stories.climate || "";
  document.getElementById("story-generic").value = vault.stories.generic || "";
  document.getElementById("story-one_liner").value = vault.stories.one_liner || "";
  renderEntries(vault);
}

function splitList(text) {
  return String(text || "").split(",").map(s => s.trim()).filter(Boolean);
}

/* ---- Saved opportunities & application tracker ---- */

const SAVED_KEY = "wob_saved_v1";
const TRACKER_KEY = "wob_tracker_v1";
const STATUSES = ["Saved", "Preparing", "Applied", "Interview", "Outcome"];

function loadIdSet(key) {
  try {
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (err) { return new Set(); }
}
function loadTracker() {
  try {
    const obj = JSON.parse(localStorage.getItem(TRACKER_KEY) || "{}");
    return obj && typeof obj === "object" ? obj : {};
  } catch (err) { return {}; }
}
function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function tDaysLeft(deadline) {
  if (!deadline) return null;
  const due = new Date(deadline + "T23:59:59");
  if (Number.isNaN(due.getTime())) return null;
  const now = new Date();
  return Math.round((due - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
}
function tFormatDate(deadline) {
  const d = new Date(deadline + "T12:00:00");
  if (Number.isNaN(d.getTime())) return deadline;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function tInitials(org) {
  const words = String(org || "?").replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const letterWords = words.filter(w => /^[A-Za-z]/.test(w));
  if (letterWords.length >= 2) return (letterWords[0][0] + letterWords[1][0]).toUpperCase();
  if (letterWords.length === 1) return letterWords[0].slice(0, 2).toUpperCase();
  return words.length ? words[0].slice(0, 2).toUpperCase() : "?";
}

async function renderTracker() {
  const host = document.getElementById("tracker-list");
  if (!host) return;
  const saved = loadIdSet(SAVED_KEY);
  if (!saved.size) {
    host.innerHTML = `<div class="empty"><p class="empty-icon" aria-hidden="true">🔖</p>
      <p><strong>Nothing saved yet.</strong></p>
      <p>Tap the bookmark on any listing on the <a href="index.html">opportunities board</a> and it will appear here with its deadline and your progress.</p></div>`;
    return;
  }
  let items = [];
  try {
    const res = await fetch("data/opportunities.json");
    if (res.ok) items = await res.json();
  } catch (err) { /* fall through with empty items */ }
  const tracker = loadTracker();
  const mine = items.filter(i => saved.has(i.id))
    .sort((a, b) => String(a.deadline || "9999").localeCompare(String(b.deadline || "9999")));
  if (!mine.length) {
    host.innerHTML = `<div class="empty"><p><strong>Your saved listings are no longer on the board.</strong></p>
      <p>Listings are removed when they close. Your bookmarks stay saved in this browser in case a listing returns.</p></div>`;
    return;
  }
  host.innerHTML = mine.map(item => {
    const statusIdx = Math.min(Math.max(Number(tracker[item.id] || 0), 0), STATUSES.length - 1);
    const days = tDaysLeft(item.deadline);
    const dueCls = days !== null && days <= 7 && days >= 0 ? "due-chip urgent" : "due-chip";
    const dueText = !item.deadline ? "Deadline: see listing"
      : days === null ? `Closes ${tFormatDate(item.deadline)}`
      : days < 0 ? `Closed ${tFormatDate(item.deadline)}`
      : days === 0 ? `Closes today, ${tFormatDate(item.deadline)}`
      : `Closes ${tFormatDate(item.deadline)} · ${days} day${days === 1 ? "" : "s"} left`;
    const steps = STATUSES.map((s, i) =>
      `<li><button type="button" class="step${i < statusIdx ? " done" : ""}${i === statusIdx ? " current" : ""}"
        data-track="${esc(item.id)}" data-step="${i}" aria-label="Set status to ${s}">${s}</button></li>`).join("");
    return `
    <article class="tracker-row">
      <div class="tracker-main">
        <span class="org-avatar" aria-hidden="true">${esc(tInitials(item.organization))}</span>
        <div class="tracker-info">
          <h3><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></h3>
          <p class="org">${esc(item.organization)}</p>
          <p class="tracker-meta"><span class="${dueCls}"><span class="icon" aria-hidden="true">📅</span> ${esc(dueText)}</span>
          <span class="status-badge status-${statusIdx}">${STATUSES[statusIdx]}</span></p>
        </div>
        <button type="button" class="btn secondary small" data-unsave="${esc(item.id)}">Remove</button>
      </div>
      <ol class="progress" aria-label="Application progress">${steps}</ol>
    </article>`;
  }).join("");
  host.querySelectorAll("[data-track]").forEach(btn => {
    btn.addEventListener("click", () => {
      const t = loadTracker();
      t[btn.getAttribute("data-track")] = Number(btn.getAttribute("data-step"));
      localStorage.setItem(TRACKER_KEY, JSON.stringify(t));
      renderTracker();
    });
  });
  host.querySelectorAll("[data-unsave]").forEach(btn => {
    btn.addEventListener("click", () => {
      const s = loadIdSet(SAVED_KEY);
      s.delete(btn.getAttribute("data-unsave"));
      localStorage.setItem(SAVED_KEY, JSON.stringify(Array.from(s)));
      renderTracker();
    });
  });
}

function init() {
  const vault = loadVault();
  fillForm(vault);
  const state = document.getElementById("save-state");
  if (state && (vault.personal.full_name || vault.education.length)) {
    state.textContent = "Loaded your saved vault from this browser";
  }

  PERSONAL_FIELDS.forEach(f => {
    const el = document.getElementById("p-" + f);
    if (el) el.addEventListener("input", () => { vault.personal[f] = el.value; persistSoon(vault); });
  });
  document.getElementById("skills").addEventListener("input", e => {
    vault.skills = splitList(e.target.value); persistSoon(vault);
  });
  document.getElementById("languages").addEventListener("input", e => {
    vault.languages = splitList(e.target.value); persistSoon(vault);
  });
  [["link-github", "github"], ["link-linkedin", "linkedin"], ["link-portfolio", "portfolio"]]
    .forEach(([id, key]) => {
      document.getElementById(id).addEventListener("input", e => {
        vault.links[key] = e.target.value; persistSoon(vault);
      });
    });
  [["story-water", "water"], ["story-climate", "climate"], ["story-generic", "generic"], ["story-one_liner", "one_liner"]]
    .forEach(([id, key]) => {
      document.getElementById(id).addEventListener("input", e => {
        vault.stories[key] = e.target.value; persistSoon(vault);
      });
    });

  document.getElementById("add-education").addEventListener("click", () => {
    vault.education.push({}); persist(vault); renderEntries(vault);
  });
  document.getElementById("add-experience").addEventListener("click", () => {
    vault.experience.push({}); persist(vault); renderEntries(vault);
  });

  document.getElementById("export-btn").addEventListener("click", () => {
    persist(vault);
    const blob = new Blob([JSON.stringify(vault, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-application-vault.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById("import-file").addEventListener("change", e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data || typeof data !== "object" || !("personal" in data || "education" in data)) {
          throw new Error("not a vault file");
        }
        localStorage.setItem(VAULT_KEY, JSON.stringify(data));
        const fresh = loadVault();
        Object.keys(vault).forEach(k => delete vault[k]);
        Object.assign(vault, fresh);
        fillForm(vault);
        persist(vault);
        alert("Vault imported. Check the fields, then head to the board and open an application pack.");
      } catch (err) {
        alert("That file could not be imported. It does not look like a vault export.");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  renderTracker();

  document.getElementById("clear-btn").addEventListener("click", () => {
    if (!confirm("Clear your vault from this browser? Export first if you want a backup.")) return;
    localStorage.removeItem(VAULT_KEY);
    const fresh = blankVault();
    Object.keys(vault).forEach(k => delete vault[k]);
    Object.assign(vault, fresh);
    fillForm(vault);
    document.getElementById("save-state").textContent = "Vault cleared";
  });
}

init();
