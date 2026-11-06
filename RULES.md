# The rules — how the board picks the best opportunities for you

The machine-readable version is [`config/rules.json`](config/rules.json); the updater
(`scripts/update.py`) applies exactly what is described here. This page is the same
rules in plain language.

## Who the board is scoring for

A **water resources & environmental engineering student in Nigeria** — currently
studying, in final year, a recent graduate, or early-career. Every rule below follows
from that: a perfect-fit paid internship in Lagos should outrank a brilliant senior
role in Houston that needs US work authorisation, every time.

## Step 1 — Hard rules (no points, just in or out)

A listing is **dropped immediately** if:

1. **It has expired** — its deadline is before today. (Hand-verified listings are kept
   until their deadline passes, then dropped too.)
2. **It asks for an application fee** — phrases like "application fee", "pay to apply"
   or "send payment to apply". Real employers and scholarship bodies do not charge you
   to apply; fee-charging listings are a classic scam pattern.
3. **It is off-field** — it contains none of the strong field keywords (below) in its
   title or description.
4. **It fails the title gate (auto-added listings only)** — an automatically found
   listing must carry a field keyword in its **title** (the strong keywords below,
   plus: water, environmental, Watsan, hydrologist, hydrogeologist, borehole).
   Matching only in the description is not enough. This was added on 2026-11-06
   after a generic youth fellowship slipped through on description keywords alone.
   Hand-verified listings added by a person are not subject to this gate.
5. **It is a duplicate** — same normalised title + organisation as another listing
   (the same job cross-posted to three boards appears once).

## Step 2 — Scoring (0–100)

Survivors are scored on five things:

### Field relevance (biggest factor)
Strong keywords: **water resources, hydrology, hydrogeology, groundwater, wastewater,
WASH, sanitation, irrigation, environmental engineering, water engineering, flood
management, water quality, water supply/management, climate adaptation (water),
drainage, hydraulics, water treatment, sewage, river basin, watershed.**
A strong keyword in the **title** is worth 35 points; extra matches in the description
add up to the keyword cap. This is why "WASH Specialist" outranks "Programme Officer"
even at the same organisation.

### Location fit
| Location | Points |
|---|---|
| Nigeria | +20 |
| Elsewhere in Africa, or fully Remote | +15 |
| Global / open to Africans | +12 |
| Anywhere else | 0 |
| Requires US/EU-only work authorisation (e.g. "must be authorised to work in the US", "EU/Danish work permit required") | **−25** |

### Level fit
- Written for **students / final-year / currently enrolled**: +15
- **Entry level / recent graduate / graduate trainee** signals: +10
- Neutral mid-career: 0
- **Senior** (title signals like Senior/Principal/Director, or 5+ years' experience
  required): −10, tagged `senior` and labelled **"Senior role"** on the site.
  Senior roles are *kept, not dropped* — a UNICEF WASH Specialist post is a useful
  career target — they just rank below things you can apply for now.

### Funding
Fully funded scholarship +15 · paid job / paid internship +12 · stipend or allowance
+10 · unknown 0 · explicitly unpaid/voluntary −5 (still listed — a UN internship can
be worth it — but it must say so honestly).

### Source trust & urgency
Official source (the organisation itself, a university, the UN, DAAD…) +10 vs.
aggregator +3. And a deadline boost so things about to close surface in time:
closing within 7 days +10, within 14 days +6, within 30 days +3.

## Step 3 — What the score means

| Score | Label on the site |
|---|---|
| **50 and above** | **Best match** — highlighted section, teal "Match NN" badge |
| **30–49** | **Worth a look** — stays in the main list |
| **Below 30** | Dropped by the updater — never reaches the site |

## Honest limits

- The score is a **ranking aid, not an eligibility guarantee**. The updater reads
  titles, descriptions and feed data; it cannot read a full PDF call for applications.
  Always open the original listing and check eligibility, deadline and location
  yourself before applying.
- Listings with no stated deadline ("see listing") get no urgency boost and sort
  after dated ones when sorting by deadline.
- You can retune everything — keywords, points, thresholds — in
  `config/rules.json`, then run `python3 scripts/update.py --dry-run` to see the
  effect before committing.
