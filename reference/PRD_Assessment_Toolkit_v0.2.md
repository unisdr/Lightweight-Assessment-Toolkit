# PRD — Lightweight Assessment Toolkit (working title)

**Status:** Draft v0.2
**Author:** Ken Hawkins, COS (UNDRR)
**Date:** 26 April 2026
**First instance:** Recovery Readiness Framework & Assessment Tool (RRFAT), under IRP

---

## 1. Purpose

A reusable pattern for building structured self-assessment tools that combine numeric scoring with substantial narrative input, packaged in a way that survives institutional environments (SharePoint, Teams) and is cheap to maintain across multiple instances.

RRFAT is the driving use case. The same pattern should serve future UNDRR self-assessments without each one being commissioned as a bespoke web application.

## 2. Background

UNDRR teams keep arriving at the same problem from different directions:

- The Recovery Readiness assessment is currently distributed as a 58-indicator Excel workbook. The quantitative scoring is the smaller part of the work; the qualitative justification (policy citations, legislation, institutional structures, evidence) is where the value sits. Excel is poor at long-form text entry and review.
- Comparable assessment products inside the organisation have followed similar paths: spreadsheets that are hard to fill in, PDFs that are meant to be printed and filled by hand, or full custom web applications (MCR-style) that ended up with low usage and high maintenance cost.
- The IRP team has prototyped a self-contained HTML file (`RRFAT_Assessment_Prototype_.html`) that handles state, save, and Word export. It works locally but breaks when distributed via SharePoint or Teams, which strip rendering of standalone HTML for security reasons.

The shape of the problem repeats. The solution should too.

## 3. Problem statement

We need a delivery format for assessments that meets these conditions:

- Substantial qualitative input per item, comfortably entered and reviewed
- Per-item guidance: plain-language description, rationale, guiding questions
- Numeric scoring with clear anchors
- State portability across ministries and reviewers (water ministry hands off to agriculture ministry)
- Distribution that does not require a full custom web stack per assessment
- Distribution that survives enterprise email and collaboration platforms
- Output suitable for archiving and reporting (Word, ideally with the qualitative content readable as a document)

The prototype demonstrates that a single HTML file can do most of this. The constraint it hits is institutional: SharePoint and Teams will not render it, and the file format gives no analytics handle for tracking use.

## 4. Out of scope

- Multi-user concurrent editing
- Server-side persistence of assessment data
- Authentication beyond optional access codes
- A full content management UI for non-technical authors
- Comparison or aggregation across countries' submissions

If any of these become required later, that is a different product class (a database-backed application). This PRD deliberately stays inside the cheap-and-static envelope that PreventionWeb and IRP can sustain.

## 5. Users

| Role | Need |
|---|---|
| Country focal point (lead) | Open the tool, fill in indicators relevant to their portfolio, save state, hand off to colleagues |
| Sectoral contributor (e.g. water ministry) | Receive the in-progress file, fill in the indicators relevant to their sector, return it |
| Assessment programme owner (e.g. IRP, MCR) | Maintain the question set, publish a new version, see basic usage signal |
| Tool author (UNDRR web team) | Stand up a new assessment instance from the same template without writing application code |

## 6. Solution overview

Three layers, decoupled:

1. **Authoring layer.** An Excel workbook is the source of truth for question structure (domains, measurement areas, indicators, guidance text, scoring scale). The web team or programme owner edits this directly. The workbook is exported to CSV.
2. **Publishing layer.** The CSV is uploaded to a single reference point — the UNDRR assets repository and CDN — at a stable URL. Updating the assessment is replacing the file at that URL. There is no site rebuild and no Drupal release tied to a content change.
3. **Runtime layer.** A single-page web app fetches the CSV at load time and renders the assessment form. In the eventual production model, the SPA is wrapped in a Drupal Gutenberg block that takes a CSV URL as a parameter, so that any IRP or UNDRR page can host an assessment by dropping a block and pointing it at the right file.

State management:

- Working state lives in browser memory while the user has the tab open.
- "Save" produces a downloadable CSV file containing the user's answers (scores, narrative, evidence) plus minimal metadata (country, date, assessment version). The file is human-readable in Excel, which means a focal point can open the saved file, see what they have written, and share it with confidence.
- "Open" accepts a previously-saved CSV file and rehydrates the form.
- Optional: a checkbox-based opt-in to also keep state in browser storage on the same machine, so an accidental tab close does not lose work. This is convenience, not durability.

Two distinct CSVs in this design:

| File | Author | Contents | Schema |
|---|---|---|---|
| Form-definition CSV | IRP / programme owner | Questions, guidance, scoring anchors | One row per indicator, plus rows for scoring scale and metadata |
| Save-state CSV | The SPA, on user save | Answers, evidence, country, date | One row per indicator, plus rows for assessment metadata |

Reporting:

- "Build report" produces a Word document containing the user's scores, narrative, evidence, and supporting metadata. Generated client-side.
- The Word report is the artefact a country files with the programme. The save-state CSV is the working file for handoff and continued editing.

Optional analytics handle:

- A short access code field on the landing page, or simple GA4 page-load tracking, gives the programme owner a usage signal. Not authentication.

## 7. Functional requirements

### 7.1 Authoring (Excel as content source)

- The workbook contains one row per indicator and includes columns for: domain, measurement area, indicator number, question, "what this means", "why this matters", guiding questions, field types required, field-specific placeholder text.
- Scoring scale anchors (label and description) live on a separate sheet.
- A second sheet defines branding tokens (title, organisation strap, colour accents).
- The workbook is exported to a CSV by the web team or programme owner. The CSV is uploaded to the UNDRR assets repository at a stable, versioned URL. Replacing the file at that URL updates the live assessment.
- No CMS database, no Drupal release, no site rebuild for content changes.

### 7.2 Runtime form

- Renders all indicators grouped by domain and measurement area.
- Collapsible per-indicator card (closed by default) showing the question and short definition; opening reveals rationale, guiding questions, scoring options, and free-text fields.
- Sticky progress bar showing scored count per domain.
- Domain tabs and a contents panel with anchor links.
- Field types per indicator typically: scoring radio group, narrative textarea, evidence textarea. The data layer should allow other field types (single-line text, multiple choice, date) without changing the runtime.
- Auto-growing textareas; no character limits enforced.

### 7.3 State

- Save: download a CSV file named `<assessment-slug>_<country>_<YYYY-MM-DD>.csv`. The file contains one row per indicator (id, score, narrative, evidence) plus a small metadata header (country, date, assessment version). Format will be defined in Phase 1; readability in Excel is a hard requirement.
- Open: file picker that accepts the save-state CSV and repopulates fields. The SPA validates that the save-state CSV matches the loaded form-definition CSV (same indicator IDs, compatible version) and warns if they do not.
- New: clears state with confirmation.
- Optional convenience persistence in browser storage, off by default, with clear copy that this is not a substitute for saving.

### 7.4 Reporting

- "Build report" generates a Word document, client-side, that includes:
  - Country name and assessment date
  - Summary scoring table by domain and measurement area
  - Per-indicator section: question, score, narrative, evidence
  - Headers, table of contents, basic styling
- The report is downloadable in one click.

### 7.5 Distribution

The eventual production model:

- A Drupal Gutenberg block, configured with a CSV URL parameter, is dropped onto a Drupal page. The block renders the SPA, which loads the assessment from the configured URL.
- The page lives at a stable URL on a UNDRR-managed Drupal site, alongside a methodology publication (the "what this is and why" companion document) so that the assessment fits existing promotional channels: news update, publication record, taxonomy.
- Programme owners can host an assessment by adding a page and a block; they do not need a custom build.

The Phase 1 prototype (see Phasing below) deliberately defers the Drupal integration. Country focal points use a standalone SPA that takes the form-definition CSV as a manual upload. This keeps the prototype shippable while the Drupal block work happens in parallel.

## 8. First instance: RRFAT

| Field | Value |
|---|---|
| Branding | IRP, under UNDRR |
| Host site | TBC, recoveryplatform.org or PreventionWeb |
| Domains | 4 (Governance, Finance, Capacity, Data & Knowledge) |
| Measurement areas | 12 |
| Indicators | 58 |
| Scoring scale | 4 anchors: Early stage, Developing, Partially functional, Functional |
| Per-indicator fields | Score, Narrative justification, Evidence sources |
| Funding | ADB, BMZ |
| Deployment scope | Six countries imminent, four to five more in next cycle |
| Owner | IRP team (Geneva), with COS supporting the web build |

The IRP working document `RRFAT_Working_Document_7_1_6.docx` is the source content. The HTML prototype is the visual design reference; its layout, scoring UI, and Word export behaviour can be lifted directly into the SPA.

## 9. What varies across future instances

| Variable | Examples |
|---|---|
| Number of domains and indicators | 20-indicator MCR follow-up vs 58-indicator RRFAT |
| Scoring scale | 3-point, 4-point, 5-point, yes/no |
| Field types per indicator | Some assessments may not need an evidence field; some may need attachment links |
| Branding | IRP, MCR, SFM, country-level deployments |
| Reporting layout | Some teams want regional comparisons in the report; others do not |
| Hosting | PreventionWeb pages, dedicated subdomain, programmatic micro-site |

Changes to the first four should require only edits to the Excel workbook and the data file. Changes to reporting layout and hosting will require web team work.

## 10. Non-functional requirements

- Loads on a poor connection (target initial payload under 200 KB excluding the data file).
- Works offline once loaded (so a focal point on a flaky connection in a country office does not lose the session).
- Accessible: keyboard navigation, sufficient colour contrast, screen-reader labels on form controls.
- Tested in current Chrome, Edge, Firefox, Safari. No IE.
- Print-friendly stylesheet so the open form prints cleanly to PDF as a fallback.
- All data stays on the user's device unless they choose to share it. No third-party calls beyond standard site analytics.

## 11. Phasing

### Phase 0 — immediate fallback (already exists)

- The Excel and PDF versions of RRFAT remain available to country teams that cannot wait. The IRP HTML prototype is shared internally with the caveat that it does not render in SharePoint or Teams.
- Programmatic value: country teams can still review and comment on the methodology, which de-risks the web build.

### Phase 1 — standalone SPA prototype

- Build a single-page web app that runs entirely client-side and is shareable as a hosted page (or even a single file, if needed).
- Country focal point uploads the form-definition CSV at the start of a session. The form renders. They fill it in. They download the save-state CSV.
- For RRFAT, IRP shares the form-definition CSV with country teams alongside the link to the SPA.
- This is genuinely portable. The SPA + CSV pair can sit on any host, and the user does not depend on any Drupal infrastructure.
- Goal: validate the abstraction, the rendering, the save/load roundtrip, and the Word report output before committing to the full integration.

### Phase 2 — Drupal Gutenberg block + CDN-hosted CSV

- Wrap the same SPA in a Drupal Gutenberg block that takes a CSV URL parameter.
- Move the RRFAT form-definition CSV to the UNDRR assets repository at a stable URL.
- The block fetches the CSV automatically; users no longer manually upload the form definition.
- Same save/load CSV behaviour for users; the only thing that changes for them is that the form is already there when they land on the page.
- Programme owners can now publish a new assessment by uploading a CSV and dropping a block.

### Phase 3 — generalisation

- Document the Excel authoring format and the CSV schemas (form-definition and save-state).
- Use the second instance (likely an MCR or SFM follow-up assessment) as the test of the abstraction.
- Decide whether the SPA and block become a small shared library with formal versioning, or stay as a copyable template.

Phases 1 and 2 should overlap. The SPA built in Phase 1 should be designed so that the Phase 2 work is wrapping and hosting changes, not a rewrite.

## 12. Risks

| Risk | Mitigation |
|---|---|
| The pattern is treated as "easy" and the team is asked to absorb instances without resourcing | Track build effort honestly; cost-recover from programme budgets where possible |
| Country focal points lose work because they do not understand "saved" means "downloaded" | Onboarding copy and a clear save-confirmation toast; opt-in browser persistence as a safety net |
| Multi-ministry handoff fails because the JSON file is mishandled in email | Keep the file format simple, name it predictably, and include short usage notes in the page itself |
| SPA bloat, particularly Word generation, makes the page slow to load | Lazy-load the Word generation library; do not parse it on first render |
| Programme owners want comparison or aggregation features that push the product into database territory | Hold the line on scope; if cross-country aggregation is needed, that is a separate platform conversation |
| Drupal embedding constraints force compromises on the SPA | Confirm the embedding approach with the platform team before Phase 1 implementation |

## 13. Dependencies

- **For Phase 1:** A host page (anywhere) that can serve the SPA. Word generation library suitable for client-side use (for example, `docx` JS). CSV parser for browser use (for example, PapaParse). Excel authoring conventions agreed with IRP for RRFAT.
- **For Phase 2:** UNDRR assets repository / CDN as the host for form-definition CSVs. Drupal Gutenberg module installed on the target Drupal site. Confirmed embedding pattern with the platform team. Decision on whether the hosted page sits under recoveryplatform.org, the IRP section of PreventionWeb, or its own URL.

## 14. Open questions

- Where does RRFAT live in Phase 2? Recovery platform site or PreventionWeb? This affects branding, taxonomy, and whose KPIs the page rolls into.
- Save-state CSV format: a flat one-row-per-indicator file with metadata header rows is the simplest design. Worth confirming this opens cleanly in Excel, Google Sheets, and LibreOffice for country focal points who may use any of them.
- Where in the UNDRR assets repository should form-definition CSVs live, and what versioning convention? Pattern likely matters less than picking one and sticking to it.
- Is there appetite for an access code in front of the assessment, even a soft one, to give IRP a usage signal? Mommoko's call suggested this would be welcome.
- For the broader pattern, do we want a UNDRR-internal reference instance (e.g. a portfolio self-assessment for COS) as the second test, or do we wait for an external programme to ask?
- Versioning: when RRFAT moves from version 1 to version 2 of the question set, how do existing in-progress save-state CSVs behave? Lock to the version they were started against, or migrate? The save-state CSV should at minimum carry a version stamp that the SPA can check against the loaded form-definition CSV.
- Cost-recovery framing: how do we describe the tooling work to ADB, BMZ, and future donors so that the Phase 3 generalisation is funded rather than absorbed?

---

*This is a working draft for discussion with IRP (Mommoko) and the COS web team. Next step: a follow-up call to confirm scope of Phase 1 and lock the host site decision.*
