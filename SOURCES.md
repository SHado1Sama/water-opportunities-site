# Sources — where the board looks

The updater checks a deliberately **varied mix**: official employers and funders first,
then trusted aggregators, then Nigeria/Africa job boards, then WASH-sector specialists.
That variety is the point — a scholarship on the DAAD database, a WASH job on a Nigerian
NGO board and an internship on ReliefWeb would never all appear in one place otherwise.

The machine-readable list lives in [`data/sources.json`](data/sources.json) — the updater
reads that file, not this one. This page explains the choices for humans.

**How to read the "Fetch" column:** `RSS` / `API` = the daily updater can pull listings
automatically today. `Manual` = no reliable feed exists, so the source is watched by hand
(Muse sweeps and verified finds are added as `manual: true` listings). Never invent a
feed URL for a manual source — if you find a real one, add it as `feed_url` in
`data/sources.json` and the updater will use it from the next run.

## (a) Official & international organisations

| Source | What it is good for | Fetch | Trust |
|---|---|---|---|
| [ReliefWeb Jobs](https://reliefweb.int/jobs) | UN/NGO humanitarian jobs, many WASH roles in Africa | API — `api.reliefweb.int/v2/jobs` (needs an approved ReliefWeb `appname`; failures are logged and skipped) | Official (UN OCHA) |
| [UN Careers](https://careers.un.org/) | UN Secretariat jobs & internships | Manual | Official |
| [UNEP](https://www.unep.org/) | Environment programme vacancies & internships (see Careers section; also on UN Careers/Impactpool) | Manual | Official |
| [UNDP Jobs](https://jobs.undp.org/) | UNDP vacancies & internships, incl. International Waters | Manual | Official |
| [UNICEF Careers](https://www.unicef.org/careers/) | WASH roles, incl. UNICEF Nigeria | Manual | Official |
| [World Bank Careers](https://www.worldbank.org/en/about/careers) | Internship Program, Young Professionals Program, water-sector roles | Manual | Official |
| [WaterAid](https://www.wateraid.org/) | WASH NGO jobs, incl. Nigeria programme | Manual | Official |
| [IRC WASH](https://www.ircwash.org/) | WASH systems organisation (Netherlands), Africa programmes | Manual | Official |
| [IHE Delft](https://www.un-ihe.org/) | Water education: MSc/PhD scholarships, fellowships, vacancies | Manual | Official |
| [SIWI](https://siwi.org/) | Stockholm International Water Institute — jobs, World Water Week, prizes | Manual | Official |
| [IWA](https://iwa-network.org/) | International Water Association — jobs, young water professionals | Manual | Official |

## (b) Scholarships & funded study

| Source | What it is good for | Fetch | Trust |
|---|---|---|---|
| [DAAD](https://www.daad.de/en/) | German scholarships incl. In-Country/In-Region awards for Sub-Saharan Africa (scholarship database linked from the site) | Manual | Official |
| [Erasmus Mundus Catalogue](https://www.eacea.ec.europa.eu/scholarships/erasmus-mundus-catalogue_en) | Official EU list of fully funded joint masters, incl. GroundwatCh | Manual | Official |
| [Commonwealth Scholarships](https://cscuk.fcdo.gov.uk/) | UK Master's/PhD awards open to Nigerians | Manual | Official |
| [Chevening](https://www.chevening.org/) | UK fully funded one-year Master's, open to Nigerians | Manual | Official |
| [Mastercard Foundation](https://mastercardfdn.org/) | Scholars Program for African students | Manual | Official |
| [ScholarshipPortal](https://www.scholarshipportal.com/) | Huge searchable scholarship database | Manual | Aggregator |
| [Scholars4Dev](https://www.scholars4dev.com/) | Curated scholarships for developing-country students | Manual | Aggregator |

## (c) Africa & Nigeria

| Source | What it is good for | Fetch | Trust |
|---|---|---|---|
| [Opportunities For Africans](https://www.opportunitiesforafricans.com/) | Scholarships, internships, fellowships & jobs for Africans | **RSS — fetched daily** | Aggregator |
| [Opportunity Desk](https://www.opportunitydesk.org/) | Global youth opportunities | Manual | Aggregator |
| [Hot Nigerian Jobs](https://www.hotnigerianjobs.com/) | Nigerian engineering/NGO/graduate jobs at volume | Manual | Aggregator |
| [Jobberman Nigeria](https://www.jobberman.com/) | Nigeria's main jobs platform | Manual | Aggregator |
| [MyJobMag Nigeria](https://www.myjobmag.com/) | Nigerian jobs with field filters | Manual | Aggregator |
| [NGOJobsite](https://ngojobsite.com/) | NGO/humanitarian jobs in Nigeria — key WASH source | Manual | Aggregator |

## (d) WASH & sector specialists

| Source | What it is good for | Fetch | Trust |
|---|---|---|---|
| [SuSanA](https://www.susana.org/) | Sanitation alliance — partner vacancies posted on its forum (Jobs category) | Manual | Official (alliance) |
| [RWSN](https://www.rural-water-supply.net/) | Rural Water Supply Network — news, mentoring, sector calls | Manual | Official (network) |
| [AfWASA / AfWA](https://www.afwasa.org/) | African Water & Sanitation Association — research scholarships for young African water professionals | Manual | Official |
| [Devex](https://www.devex.com/jobs) | International development jobs, strong WASH coverage | Manual | Aggregator |
| [Impactpool](https://www.impactpool.org/) | UN & international-organisation careers (UNEP/UNDP/UNICEF) | Manual | Aggregator |
| [Josh's Water Jobs](https://www.joshswaterjobs.com/) | Specialist water-sector jobs board (recommended by SuSanA) | Manual | Aggregator |

## Notes & verification (2026-11-06)

- Homepages above were checked against the organisations' own sites / web search on
  2026-11-06. Two naming notes: the African Water Association is now the **African Water
  and Sanitation Association (AfWASA)** at `afwasa.org` (its older `afwa-hq.org` address
  still appears in its publications), and RWSN's home is `rural-water-supply.net`
  (`rwsn.ch` is an older address).
- Only **two** sources are fetched automatically today, because only two could be
  included with confidence: the Opportunities For Africans RSS feed (URL supplied and
  standard for that WordPress site) and the ReliefWeb jobs API (documented at
  apidoc.reliefweb.int). In local testing on 2026-11-06 the OFA feed fetched fine
  (its 10 latest posts were all off-field, so none were kept — the rules working as
  intended), while ReliefWeb's old v1 endpoint returned **410 Gone** and ReliefWeb
  now requires a pre-approved `appname` for v2, so that source may return an
  authorisation error until one is requested from ReliefWeb; the updater logs
  that and carries on with the other sources.
- Everything marked Manual is a deliberate, honest limitation, not an oversight:
  most job boards either have no public feed or prohibit automated scraping in their
  terms. They stay in the rotation for human/Muse sweeps instead.
