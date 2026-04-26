# Contributing Guide

## Overview

We follow a **test-first approach** (TDD) with [Vitest](https://vitest.dev/) and [Vite](https://vitejs.dev/).
Keep pure logic in `js/lib/` — that's what gets unit-tested. DOM code lives in `js/app.js` and is covered by manual testing.

---

## Getting started

```bash
npm install
npm run dev        # Vite dev server at http://localhost:5174
npm test           # Run all tests once
npm run test:watch # Watch mode
npm run build      # Production bundle → dist/
```

---

## TDD workflow

1. **Write a failing test first** in `js/lib/__tests__/*.test.js`
2. **Run tests in watch mode**: `npm run test:watch`
3. **Implement** only enough code to make the test pass
4. **Refactor** while keeping tests green
5. **Never push failing tests** to `main`

Pure functions belong in `js/lib/`. DOM code belongs in `js/app.js` (not unit-tested; covered by manual testing).

## Commit conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <description>
```

### Types

| Type       | When to use                                              |
|------------|----------------------------------------------------------|
| `feat`     | New feature visible to users                            |
| `fix`      | Bug fix                                                  |
| `test`     | Adding or fixing tests (no production code change)      |
| `refactor` | Code change that is neither a feature nor a bug fix     |
| `docs`     | Documentation only                                       |
| `style`    | CSS / formatting (no logic change)                       |
| `chore`    | Build config, dependencies, tooling                      |
| `perf`     | Performance improvement                                  |

### Scopes (optional but encouraged)

`parser` · `serializer` · `progress` · `app` · `css` · `html` · `deps`

### Examples

```
feat(parser): support multi-area indicators
fix(serializer): preserve quotes in narrative field
test(progress): add cross-domain edge case
refactor(app): extract modal helpers into module
docs: update CONTRIBUTING with scope list
chore(deps): bump vite to 5.4.2
```

### Breaking changes

Add `!` after the type/scope and a `BREAKING CHANGE:` footer:

```
feat(parser)!: rename row_type 'meta' value column

BREAKING CHANGE: meta values now read from 'description', not 'label'
```

---

## Branch strategy

| Branch   | Purpose                                              |
|----------|------------------------------------------------------|
| `main`   | Stable, tested code only                             |
| `dev`    | Integration branch; PRs target here                 |
| `feat/*` | Feature branches                                    |
| `fix/*`  | Bug fix branches                                    |

All PRs need at least one review before merging.

---

## CI pipeline

Two GitHub Actions workflows run automatically:

| Workflow | File | Trigger |
|----------|------|---------|
| **CI** | `.github/workflows/ci.yml` | Every push and every pull request |
| **Deploy** | `.github/workflows/pages.yml` | Push to `main` only |

### CI (`ci.yml`)

Runs on every branch push and PR:

1. `npm ci` — clean install
2. `npm test` — all Vitest unit tests must pass
3. `npm run build` — production bundle must compile without error

**PRs cannot be merged if CI is red.**

### Deploy (`pages.yml`)

Triggered automatically when a commit lands on `main`:

1. `actions/configure-pages` detects the repo path and sets `VITE_BASE_URL`
2. Vite builds with the correct sub-path base (e.g. `/Lightweight-Assessment-Toolkit/`)
3. The `dist/` artifact is uploaded and deployed to GitHub Pages

The live URL is shown in the workflow summary and in the repo's *Environments* panel (github-pages).

To trigger a re-deploy manually: **Actions → Deploy to GitHub Pages → Run workflow**.

---

## Pull request checklist

Before opening a PR, make sure:

- [ ] `npm test` passes locally with no failures
- [ ] `npm run build` completes without errors
- [ ] Commit messages follow Conventional Commits
- [ ] New pure-logic code has unit tests in `js/lib/__tests__/`
- [ ] CSS-only changes have been visually verified in the dev server
- [ ] The PR description explains *what* changed and *why*

---

## Architecture notes

### File layout

```
js/
  app.js              DOM layer — event handling, rendering, file I/O
  lib/
    parser.js         parseFormDefinition(), parseSaveState()
    serializer.js     serializeSaveState(), buildFilename()
    progress.js       calculateProgress()
    __tests__/
      parser.test.js
      serializer.test.js
      progress.test.js
css/
  app.css             lat-* classes; Mangrove handles components
index.html            App shell; loads Mangrove IRP CSS from CDN
```

### Design system

All component classes come from [Mangrove](https://unisdr.github.io/undrr-mangrove/) (IRP theme).
Use the `mg-` prefix for components (buttons, form fields, etc.) and `lat-` prefix for layout-specific
classes defined in `css/app.css`. Do not duplicate Mangrove component styling — override only
when absolutely necessary.

### CSV data model

See `reference/PRD_Assessment_Toolkit_v0.2.md` for the full specification.
Key invariant: **indicator IDs are only unique within their `row_type`**; always use the separate
`indicatorMap`, `areaMap`, and `domainMap` lookup objects — never a single flat map.
