# Project Context: Heimdall
_Last updated: 2026-08-27_
_This file changes rarely. If the stack or architecture shifts significantly, re-run /first-principles._

## Stack
Vanilla JS, HTML, and CSS — no framework, no build step, no package manager,
no dependencies of any kind. The entire application is one file,
`heimdall.html` (~1,840 lines: inlined `<style>` + a single IIFE `<script>`
using ES5-style `function` expressions, not classes/modules). Currently at
`APP_VERSION = "0.5.0"` (heimdall.html:613). Double-clicking the file runs
it — there is no `npm install`, no dev server, no compiler.

## Deployment
There is no deployment target in the usual sense: the "deployment artifact"
*is* `heimdall.html`, distributed by simply copying the file. It's designed
to be opened directly via `file://` in a browser (Edge/Chrome recommended;
Firefox/Safari supported with reduced sync features — see Known gotchas).
No server, no port, no Electron wrapper.

## Domain vocabulary
- **Manager** — a person on the team being tracked (name, title, location,
  active/archived). The unit the Workload Board reports on.
- **Project** — has status, priority, dates, an optional Jira epic link, and
  a team of Assignments. A person can appear only once per project.
- **Assignment** — links a Manager to a Project with a **role** (Lead or
  Contributor) and an **effort** level (Light / Medium / Heavy). Effort is a
  multiplier on the role's base weight (×1 / ×1.5 / ×2).
- **Work item** — a piece of non-project work: customer escalation,
  Day-in-the-Life (DITL) request, or one-off task. Has type, owner, status,
  dates, and an aging flag once open 14+ days.
- **Backlog** — work items with no owner assigned yet; surfaced separately
  from the board so distribution decisions are visible.
- **Roll-off** — a project/work-item end date; items past it aren't
  auto-deleted, they surface under **Needs attention** for deliberate
  archiving.
- **Heat label** — the board's headline signal per manager, derived from a
  **weighted workload score**: Light (0–4) / Balanced (5–9) / Heavy (10–14)
  / Overloaded (15+). Weights (Lead 3, Contributor 1, escalation 4, DITL 2,
  one-off 1, other 1) and bands are editable in Settings and stored in the
  data file, not hardcoded assumptions.
- **Archiving** — the app's only form of deletion. Nothing is hard-deleted;
  archived managers/projects/items are preserved for history.

## Conventions
- Single IIFE, ES5-style function declarations (`function () {}`, `var`, no
  `class`/`let`/arrow functions in the core — see heimdall.html for the
  established style before adding new code).
- Small DOM helper functions instead of a templating library: `el()`,
  `elem()`, `clear()`, `pill()`, `miniBtn()`, `notice()` (heimdall.html:648,
  740–753).
- Data validated/normalized through a single `validate(parsed)` function
  (heimdall.html:695) whenever loading from IndexedDB, an imported file, or
  a synced shared file — new fields on any entity should be threaded
  through there.
- No test framework, no linter config present — this is a hand-verified,
  manually-tested single file.
- No git submodules/monorepo; this is the whole repo.

## Known gotchas
- The CSP meta tag (heimdall.html:15) requires `'unsafe-inline'` for both
  `script-src` and `style-src` specifically because the file is loaded over
  `file://` — don't tighten this without testing `file://` loads, not just
  `http://`.
- Live shared-file sync (via `showDirectoryPicker`/File System Access API)
  is Chromium-only (`DIR_API` check at heimdall.html:618). Firefox/Safari
  get full local (IndexedDB) functionality but must use manual JSON
  Export/Import to share — there is no feature-equivalent fallback to
  build, this is a real platform gap the README documents deliberately.
- IndexedDB is the source of truth locally; the shared file is a
  best-effort sync layer with last-write-wins conflict resolution (by save
  timestamp) — not a CRDT or merge strategy. Don't assume concurrent edits
  merge cleanly.
- Clearing browser site data destroys the local copy with no server-side
  backup; only a linked shared file or manual export protects against this.
- `connect-src 'none'` in the CSP is intentional and load-bearing for the
  "no network calls ever" security posture — any future feature needing
  `fetch`/XHR is a scope change, not a bug fix.
