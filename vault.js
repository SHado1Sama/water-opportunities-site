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
