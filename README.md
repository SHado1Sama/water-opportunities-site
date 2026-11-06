# Water & Environmental Engineering Opportunities Board

A free, self-updating website that finds **internships, scholarships, fellowships,
graduate-trainee schemes and jobs** for a **water resources & environmental engineering
student in Nigeria**, scores them for how well they actually fit, and displays the best
ones first.

No server, no database, no cost: the site is plain HTML/CSS/JS hosted on GitHub Pages,
and a GitHub Actions workflow refreshes the listings every day.

## How the auto-update works

```
data/sources.json ──► scripts/update.py ──► data/opportunities.json ──► index.html (in your browser)
 (30+ sources)         fetches feeds/APIs,        scored, filtered,         app.js renders cards,
                       applies config/rules.json  deduplicated               search & filters
```

1. Every day at **06:00 UTC (07:00 Lagos time)**, the workflow in
   `.github/workflows/update-and-deploy.yml` runs `scripts/update.py`.
2. The updater fetches the sources that offer a feed or API (currently the
   **Opportunities For Africans RSS feed** and the **ReliefWeb jobs API**), scores every
   listing with the rules in `config/rules.json`, drops expired / off-field /
   application-fee / duplicate listings, and merges the survivors into
   `data/opportunities.json`. Hand-verified listings (`"manual": true`) are preserved
   until they expire. A source that fails is logged and skipped — it never breaks the run.
3. The workflow commits the refreshed data back to the repo ("Auto-update
   opportunities") and deploys the site to GitHub Pages.
4. Sources without a feed (most job boards and official careers pages) are listed in
   `data/sources.json` / `SOURCES.md` so the list can grow — anyone can add a feed URL
   there and the updater will start using it automatically.

> Note: GitHub disables scheduled workflows in public repos after 60 days without
> repository activity. This workflow's own daily data commits count as activity, so it
> normally keeps itself alive. If it is ever disabled, re-enable it in the **Actions** tab.

## Set it up on GitHub (one time, ~10 minutes)

1. **Create a public GitHub repository** (e.g. `water-opportunities`) — do *not* add a
   README/gitignore when creating it; this project already has everything.
2. **Push these files** to that repository. From inside this folder:
   ```bash
   git init
   git add .
   git commit -m "Water opportunities board"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
   git push -u origin main
   ```
   (Or upload the files with GitHub's web interface / GitHub Desktop instead.)
3. **Turn on Pages:** repo **Settings → Pages → Build and deployment → Source =
   "GitHub Actions"**.
4. **Let the workflow write:** repo **Settings → Actions → General → Workflow
   permissions = "Read and write permissions"**.
5. **Run it once by hand:** repo **Actions tab → "Update opportunities and deploy site"
   → Run workflow**. When it finishes green, your site is live.
6. Your site URL will be:
   **`https://YOUR-USERNAME.github.io/YOUR-REPO/`**

## Change what it looks for

- **Sources:** edit `data/sources.json`. Each entry has a name, homepage `url`,
  optional `feed_url` / `api_url` (only add one if you are sure it exists — otherwise
  use `null`), `kind` (`rss` / `api` / `html`), `categories`, `region` and `trust`
  (`official` / `aggregator`). See `SOURCES.md` for the full list and notes.
- **Rules:** edit `config/rules.json` — field keywords, location/level/funding points,
  hard drops (expired, application fees, duplicates, off-field) and the score
  thresholds (`50+` = "Best match", `30–49` = kept as "Worth a look", below 30 dropped).
  `RULES.md` explains the rules in plain language.
- **Test the updater locally before pushing:**
  ```bash
  python3 scripts/update.py --dry-run   # fetch + report, writes nothing
  python3 scripts/update.py             # fetch + rewrite data files
  ```
- **Preview the site locally:**
  ```bash
  python3 -m http.server 8000           # then open http://localhost:8000
  ```
  (Opening `index.html` directly from disk will not load the JSON data — browsers block
  local file fetches — so always serve the folder.)

## A word of caution

Scores rank listings for a student audience; they are **not** an eligibility guarantee.
Always open the original listing and confirm the deadline, location and eligibility
before applying — and never pay an "application fee": legitimate employers and
scholarship bodies do not charge one, which is why the updater drops any listing that
asks for one.
