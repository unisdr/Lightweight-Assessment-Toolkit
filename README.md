# Lightweight Assessment Toolkit

A client-side single-page application for conducting structured self-assessments against a form-definition CSV.
Built for the [RRFAT (Recovery Readiness Framework & Assessment Tool)](https://www.undrr.org/implementing-sendai-framework/recovery) under [IRP](https://www.recoveryplatform.org/) / [UNDRR](https://www.undrr.org/).

![UNDRR IRP](https://assets.undrr.org/static/mangrove/1.6.0/images/irp-logo.svg)

---

## Features

- **Load a form definition** — drag-drop or file-picker for the RRFAT CSV (or any compatible schema)
- **Structured self-assessment** — domain tabs, area grouping, per-indicator 4-point scoring scale with narrative and evidence fields
- **Save / resume** — download a sparse save-state CSV; reload at any time to resume
- **Auto-save** — optional browser `localStorage` persistence between sessions
- **Word report** — generate a `.docx` summary report
- **Fully offline** — no server, no backend; everything runs in the browser

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- npm ≥ 9

### Install & run

```bash
npm install
npm run dev        # starts Vite dev server at http://localhost:5174
```

### Build for production

```bash
npm run build      # output in dist/
npm run preview    # preview the production build locally
```

### Run tests

```bash
npm test           # run all Vitest unit tests once
npm run test:watch # watch mode
```

---

## Usage

1. **Open the app** in your browser at `http://localhost:5174`
2. **Load a form definition** — click *Load form definition* or drag-drop the file `reference/rrfat_form_definition.csv` onto the page
3. Fill in the **assessment metadata** (country, date, focal point, etc.) in the dialog that appears
4. **Score each indicator** using the 1–4 scale; add narrative and evidence notes
5. Use the **domain tabs** and **sidebar** to navigate between indicators
6. **Save** your progress at any time with the *Save* button (downloads a CSV)
7. **Resume** a saved session by clicking *Open saved* and loading your save-state CSV
8. **Build report** generates a `.docx` Word document summary

---

## Project structure

```
├── index.html                  # App shell (welcome screen, header, sidebar, modals)
├── css/
│   └── app.css                 # Layout and component styles (lat- prefix)
├── js/
│   ├── app.js                  # DOM application layer
│   └── lib/
│       ├── parser.js           # CSV parsing (form definition + save state)
│       ├── serializer.js       # Save-state serialization and filename generation
│       ├── progress.js         # Progress calculation per domain
│       └── __tests__/          # Vitest unit tests
├── reference/
│   └── rrfat_form_definition.csv   # RRFAT form definition (loaded at runtime)
├── vite.config.js
└── CONTRIBUTING.md
```

---

## CSV schemas

### Form definition (`row_type,id,parent_id,label,description,detail_1,detail_2`)

| `row_type`     | Purpose |
|----------------|---------|
| `meta`         | Assessment-level metadata; value is in the `description` column |
| `score_anchor` | 1–4 scoring scale labels and definitions |
| `domain`       | Top-level domain |
| `area`         | Measurement area (child of domain) |
| `indicator`    | Assessment indicator (child of area) |

### Save state (`row_type,id,score,value,narrative,evidence`)

Sparse format — only answered indicators are included.

---

## Design system

Uses [Mangrove IRP](https://unisdr.github.io/undrr-mangrove/) (UNDRR design system) via CDN for typography, buttons, form controls, and layout utilities. Custom layout classes use the `lat-` prefix.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the conventional-commits workflow, branching strategy, and TDD guidelines.

---

## Licence

© UNDRR / IRP. All rights reserved.
