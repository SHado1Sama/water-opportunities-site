#!/usr/bin/env python3
"""Auto-updater for the Water Opportunities Board.

Reads data/sources.json and config/rules.json, fetches the sources that
expose a machine-readable feed (RSS/Atom) or API (ReliefWeb), scores and
filters the results, and merges them into data/opportunities.json.

Standard library only — no pip installs — so it runs anywhere, including
the daily GitHub Actions workflow (.github/workflows/update-and-deploy.yml).

Usage:
    python3 scripts/update.py            # fetch, score, and write files
    python3 scripts/update.py --dry-run  # fetch and report only, no writes

Design rule: a failing source is logged and skipped. It never crashes the run.
"""

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES_PATH = ROOT / "data" / "sources.json"
RULES_PATH = ROOT / "config" / "rules.json"
OPPS_PATH = ROOT / "data" / "opportunities.json"
LAST_UPDATE_PATH = ROOT / "data" / "last_update.json"

USER_AGENT = "water-opportunities-site-updater/1.0 (+https://github.com/)"
FETCH_TIMEOUT_SECONDS = 25


# ---------------------------------------------------------------- helpers

def load_json(path, default):
    try:
        with path.open(encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        return default
    except json.JSONDecodeError as exc:
        print(f"WARNING: {path} is not valid JSON ({exc}); using default.", file=sys.stderr)
        return default


def fetch(url):
    """Return the response body as bytes, or raise."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT,
                                                 "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT_SECONDS) as resp:
        return resp.read()


def strip_html(text):
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = (text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
            .replace("&quot;", '"').replace("&#39;", "'").replace("&nbsp;", " "))
    return " ".join(text.split())


def normalize_key(title, organization):
    def norm(value):
        value = (value or "").lower()
        value = re.sub(r"[^a-z0-9 ]+", " ", value)
        return " ".join(value.split())
    return f"{norm(title)}|{norm(organization)}"


def slugify(text):
    slug = re.sub(r"[^a-z0-9]+", "-", (text or "opportunity").lower()).strip("-")
    return slug[:70] or "opportunity"


def parse_date(value):
    """Best-effort parse of RSS/ISO dates -> datetime.date or None."""
    if not value:
        return None
    value = str(value).strip()
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        pass
    try:
        return parsedate_to_datetime(value).date()
    except (TypeError, ValueError):
        pass
    for fmt in ("%Y-%m-%d", "%d %B %Y", "%B %d, %Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------- fetching

def parse_feed(xml_bytes):
    """Parse RSS 2.0 or Atom into a list of {title, link, description, date}."""
    items = []
    root = ET.fromstring(xml_bytes)
    atom = "{http://www.w3.org/2005/Atom}"

    # RSS: channel/item ; Atom: feed/entry
    rss_items = root.findall(".//item")
    atom_items = root.findall(f"{atom}entry")
    if rss_items:
        for node in rss_items:
            link_node = node.find("link")
            items.append({
                "title": (node.findtext("title") or "").strip(),
                "link": (link_node.text.strip() if link_node is not None and link_node.text else ""),
                "description": strip_html(node.findtext("description") or ""),
                "date": node.findtext("pubDate") or node.findtext(
                    "{http://purl.org/dc/elements/1.1/}date"),
            })
    elif atom_items:
        for node in atom_items:
            link = ""
            for link_node in node.findall(f"{atom}link"):
                if link_node.get("rel") in (None, "alternate"):
                    link = link_node.get("href", "")
                    break
            items.append({
                "title": (node.findtext(f"{atom}title") or "").strip(),
                "link": link,
                "description": strip_html(node.findtext(f"{atom}summary")
                                          or node.findtext(f"{atom}content") or ""),
                "date": node.findtext(f"{atom}updated") or node.findtext(f"{atom}published"),
            })
    return items


def fetch_reliefweb(source):
    """Fetch ReliefWeb jobs via its public API (JSON).

    v1 response shape: {"data": [{"fields": {title, url, date: {closing},
    source: [{name}], country: [{name}], city: [{name}], body}}, ...]}
    """
    payload = json.loads(fetch(source["api_url"]).decode("utf-8", "replace"))
    results = []
    for entry in payload.get("data", []):
        fields = entry.get("fields", {}) or {}
        dates = fields.get("date") or {}
        sources = fields.get("source") or []
        countries = fields.get("country") or []
        cities = fields.get("city") or []
        location_bits = []
        if cities:
            location_bits.append(cities[0].get("name", ""))
        if countries:
            location_bits.append(countries[0].get("name", ""))
        results.append({
            "title": (fields.get("title") or "").strip(),
            "link": fields.get("url") or "",
            "description": strip_html(fields.get("body") or "")[:1200],
            "date": None,
            "deadline": dates.get("closing"),
            "organization": sources[0].get("name", "") if sources else "ReliefWeb listing",
            "location": ", ".join(b for b in location_bits if b),
        })
    return results


# ---------------------------------------------------------------- scoring

def contains_keyword(text, keyword):
    """Word-boundary keyword match.

    Plain substring matching is too loose for short field words: 'wash'
    matches inside 'Washington' (which is how a generic Washington D.C.
    fellowship once scored as a WASH listing). Boundaries fix that while
    multi-word phrases ('water resources') still match normally.
    """
    return re.search(r"\b" + re.escape(keyword) + r"\b", text) is not None

AFRICAN_COUNTRIES = {
    "nigeria", "ghana", "kenya", "uganda", "tanzania", "ethiopia", "rwanda",
    "senegal", "mali", "burkina faso", "niger", "cameroon", "angola", "zambia",
    "zimbabwe", "mozambique", "malawi", "south africa", "egypt", "morocco",
    "algeria", "tunisia", "libya", "sudan", "south sudan", "somalia", "benin",
    "togo", "ivory coast", "cote d'ivoire", "liberia", "sierra leone", "guinea",
    "mauritania", "chad", "congo", "dr congo", "gabon", "namibia", "botswana",
    "madagascar", "mauritius", "lesotho", "eswatini",
}


def guess_region(text, source_region):
    lowered = text.lower()
    if "nigeria" in lowered or "lagos" in lowered or "abuja" in lowered or "kano" in lowered:
        return "Nigeria"
    if "remote" in lowered:
        return "Remote"
    for country in AFRICAN_COUNTRIES:
        if country in lowered:
            return "Africa"
    if source_region in ("Nigeria", "Africa", "Remote", "Global"):
        return source_region
    return "Global"


def guess_type(text, source_categories):
    lowered = text.lower()
    order = ["scholarship", "fellowship", "graduate-trainee", "internship", "job"]
    phrase_map = {
        "scholarship": ["scholarship", "fully funded master", "master's scholarship"],
        "fellowship": ["fellowship"],
        "graduate-trainee": ["graduate trainee", "graduate programme", "graduate program",
                             "management trainee"],
        "internship": ["internship", " intern "],
        "job": ["vacancy", "recruiting", "hiring", "officer", "engineer", "specialist"],
    }
    for kind in order:
        if any(p in lowered for p in phrase_map[kind]):
            return kind
    for cat in source_categories or []:
        if cat in order:
            return cat
    return "job"


def score_candidate(candidate, source, rules, today):
    """Score one fetched candidate. Returns (score, details) or (None, reason)."""
    scoring = rules["scoring"]
    hard = rules["hard_rules"]
    text = f"{candidate.get('title','')} {candidate.get('description','')}".lower()
    title = (candidate.get("title") or "").lower()

    # Hard rule: application fees are a scam signal — never list these.
    for phrase in hard.get("application_fee_phrases", []):
        if phrase in text:
            return None, f"dropped: mentions an application fee ('{phrase}')"

    # Hard rule: must be on-field — at least one strong keyword somewhere.
    strong = rules["field_keywords_strong"]
    title_hits = [kw for kw in strong if contains_keyword(title, kw)]
    desc_hits = [kw for kw in strong
                 if contains_keyword(text, kw) and kw not in title_hits]
    if not title_hits and not desc_hits:
        return None, "dropped: off-field (no strong field keyword)"

    # Hard rule (added 2026-11-06 after a generic youth fellowship slipped
    # through on description keywords alone): auto-added listings must carry
    # a field keyword in the TITLE. Description matches alone are not enough.
    if hard.get("auto_add_requires_title_keyword", True) and not title_hits:
        gate_words = list(strong) + list(hard.get("title_gate_extra_keywords", []))
        if not any(contains_keyword(title, kw) for kw in gate_words):
            return None, "dropped: title gate (no field keyword in title)"

    score = 0
    if title_hits:
        score += scoring["title_strong_keyword"]
    score += min(len(desc_hits) * scoring["description_strong_keyword"],
                 scoring["keyword_points_cap"] - (scoring["title_strong_keyword"] if title_hits else 0))

    # Location fit
    region = candidate.get("region") or guess_region(
        f"{candidate.get('title','')} {candidate.get('location','')} {candidate.get('description','')}",
        source.get("region", "Global"))
    score += scoring["location_points"].get(region.lower(), 0)
    if any(p in text for p in scoring.get("restricted_region_keywords", [])):
        score += scoring["restricted_region_penalty"]

    # Level fit
    senior = False
    years = [int(m) for m in re.findall(r"(\d{1,2})\s*\+?\s*(?:years?|yrs?)", text)]
    if (years and max(years) >= scoring["senior_years_threshold"]) or \
            any(p in title for p in scoring.get("senior_keywords", [])):
        senior = True
    if any(p in text for p in scoring.get("student_keywords", [])):
        level = "Student / recent graduate"
        score += scoring["level_points"]["student"]
    elif any(p in text for p in scoring.get("entry_keywords", [])) and not senior:
        level = "Entry level"
        score += scoring["level_points"]["entry"]
    elif senior:
        level = "Senior"
        score += scoring["level_points"]["senior"]
    else:
        level = "See listing"
        score += scoring["level_points"]["mid"]

    # Funding
    funding_label, funding_points = "See listing", scoring["funding_points"]["unknown"]
    for bucket in ("fully-funded", "paid", "stipend", "unpaid"):
        if any(p in text for p in scoring["funding_keywords"].get(bucket, [])):
            funding_label = {"fully-funded": "Fully funded", "paid": "Paid",
                             "stipend": "Stipend", "unpaid": "Unpaid / voluntary"}[bucket]
            funding_points = scoring["funding_points"][bucket]
            break
    score += funding_points

    # Source trust
    score += scoring["trust_points"].get(source.get("trust", "aggregator"), 0)

    # Deadline urgency
    deadline = parse_date(candidate.get("deadline"))
    if deadline:
        if deadline < today:
            return None, "dropped: expired"
        days_left = (deadline - today).days
        for band in scoring["urgency_points"]:
            if days_left <= band["max_days_left"]:
                score += band["points"]
                break

    details = {
        "region": region,
        "level": level,
        "funding": funding_label,
        "senior": senior,
        "deadline": deadline.isoformat() if deadline else None,
    }
    return max(0, min(100, score)), details


# ---------------------------------------------------------------- main flow

def collect_candidates(sources, rules, today):
    """Fetch every machine-readable source; log and skip failures."""
    kept, report = [], []
    for source in sources:
        name = source.get("name", "?")
        feed_url = source.get("feed_url")
        api_url = source.get("api_url")
        if not feed_url and not api_url:
            report.append(f"- {name}: no feed/API configured (kind=html) — skipped, "
                          "checked manually instead")
            continue
        try:
            if api_url:
                raw_items = fetch_reliefweb(source)
                origin = "api"
            else:
                raw_items = parse_feed(fetch(feed_url))
                origin = "feed"
        except Exception as exc:  # network, parse, API rejection — never fatal
            report.append(f"- {name}: FAILED ({type(exc).__name__}: {exc}) — skipped")
            continue

        source_kept = 0
        gate_drops = 0
        for raw in raw_items:
            if not raw.get("title") or not raw.get("link"):
                continue
            candidate = {
                "title": raw["title"],
                "link": raw["link"],
                "description": raw.get("description", ""),
                "deadline": raw.get("deadline"),
                "location": raw.get("location", ""),
                "organization": raw.get("organization") or name,
            }
            candidate["region"] = guess_region(
                f"{candidate['title']} {candidate['location']} {candidate['description']}",
                source.get("region", "Global"))
            scored, details = score_candidate(candidate, source, rules, today)
            if scored is None:
                if isinstance(details, str) and "title gate" in details:
                    gate_drops += 1
                continue
            if scored < rules["hard_rules"]["min_score_to_keep"]:
                continue
            kept.append({
                "id": slugify(candidate["title"]) + "-" + slugify(source["name"]),
                "title": candidate["title"],
                "organization": candidate["organization"],
                "type": guess_type(f"{candidate['title']} {candidate['description']}",
                                   source.get("categories")),
                "location": candidate["location"] or source.get("region", "See listing"),
                "region": details["region"],
                "eligibility": "See the original listing for full eligibility.",
                "deadline": details["deadline"],
                "url": candidate["link"],
                "source": name,
                "funding": details["funding"],
                "experience": details["level"] + (" (senior — kept for reference)"
                                                  if details["senior"] else ""),
                "score": scored,
                "summary": (candidate["description"][:280] +
                            ("…" if len(candidate["description"]) > 280 else "")),
                "tags": [kw for kw in rules["field_keywords_strong"]
                         if kw in f"{candidate['title']} {candidate['description']}".lower()][:5],
                "manual": False,
                "verified_date": today.isoformat(),
            })
            source_kept += 1
        report.append(f"- {name}: {origin} OK — {len(raw_items)} fetched, "
                      f"{source_kept} kept after rules, "
                      f"{gate_drops} dropped by title gate")
    return kept, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true",
                        help="fetch and report only; do not write any files")
    args = parser.parse_args()

    today = date.today()
    sources_doc = load_json(SOURCES_PATH, {})
    sources = sources_doc.get("sources", []) if isinstance(sources_doc, dict) else sources_doc
    rules = load_json(RULES_PATH, {})
    existing = load_json(OPPS_PATH, [])

    print(f"Water Opportunities updater — {today.isoformat()}"
          f"{' (DRY RUN)' if args.dry_run else ''}")
    print(f"Sources configured: {len(sources)}")

    fetched, report = collect_candidates(sources, rules, today)
    for line in report:
        print(line)

    # Merge: keep manual entries unless expired; refresh auto entries.
    merged = {}
    for item in existing:
        if item.get("manual"):
            deadline = parse_date(item.get("deadline"))
            if deadline and deadline < today:
                print(f"- manual entry expired, dropping: {item.get('title')}")
                continue
            merged[normalize_key(item.get("title"), item.get("organization"))] = item
        # Non-manual existing entries are re-fetched each run; anything no
        # longer returned by a feed drops off naturally.
    new_count = 0
    for item in fetched:
        key = normalize_key(item["title"], item["organization"])
        if key not in merged:
            new_count += 1
        merged[key] = item

    result = sorted(merged.values(),
                    key=lambda i: (-(i.get("score") or 0), i.get("deadline") or "9999-99-99"))
    best = sum(1 for i in result if (i.get("score") or 0) >= rules.get("thresholds", {}).get("best_match", 50))
    print(f"Result: {len(result)} listings ({best} best matches, "
          f"{new_count} new auto listings this run)")

    if args.dry_run:
        print("Dry run — no files were written.")
        return 0

    with OPPS_PATH.open("w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    last_update = {
        "updated_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "count": len(result),
        "note": "Updated automatically by scripts/update.py (GitHub Actions).",
    }
    with LAST_UPDATE_PATH.open("w", encoding="utf-8") as fh:
        json.dump(last_update, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(f"Wrote {OPPS_PATH.relative_to(ROOT)} and {LAST_UPDATE_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
