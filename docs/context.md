# Project Context: Heimdall
_Last updated: 2026-10-19_
_This file changes rarely. If the stack or architecture shifts significantly, re-run /first-principles._

## Stack
Vanilla JS, HTML, and CSS — no framework, no build step, no runtime package manager,
no runtime dependencies of any kind (npm is used only for the dev-time test suite). The entire application is one file,
`heimdall.html` (~3,240 lines: inlined `<style>` + a single IIFE `<script>`
using ES5-style `function` expressions, not classes/modules). Currently at
`APP_VERSION = "0.15.0"`. Double-clicking the file runs it — there is no
`npm install`, no dev server, no compiler.

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
  a team of Assignments. A person can appear only once per project. Usually
  one Lead, but co-leads are legitimate (owner decision, 2026-10-02) — do not
  enforce a single Lead.
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
  archiving. Active projects past their target date surface there too, with
  a **Close out** action rather than an archive one.
- **Close out** — how a project ends: status goes to Complete with a
  completion date (today by default, backdatable). It requires no start,
  target, or end date — open-ended projects close the same way — keeps the
  team and history, and stops counting toward workload. **Reopen** reverses
  it and clears the completion date.
- **Heat label** — the board's headline signal per manager, derived from a
  **weighted workload score**: Light (0–4) / Balanced (5–9) / Heavy (10–14)
  / Overloaded (15+). Weights (Lead 3, Contributor 1, escalation 4, DITL 2,
  one-off 1, other 1) and bands are editable in Settings and stored in the
  data file, not hardcoded assumptions. Scores are fractional (effort
  multiplies), so one landing between two whole-number bands resolves
  *downward*, to the highest band it has reached — see `bandFor`.
- **Timeline** — the "who frees up when" view. Built on `scoreItems(id)`,
  which lists every item counting toward a manager's score with its weight
  and expected end date (`a.endDate || project.targetDate`,
  `w.rollOffDate || w.dueDate`); `managerScore` just sums it, so the board
  and the timeline cannot disagree about what counts. Projections
  (`projectedLoad`) drop dated items after their date and are display-only:
  never feed them back into `managerScore` — honouring dates in scoring is
  roadmap #10, deliberately on hold.
- **Capacity** — `managers[].capacity`, a fraction of a full load (1 = 100%,
  entered as a percentage 10–300 in the manager form; validate() turns a
  missing, non-numeric, or non-positive value into 1). `managerScore`
  returns `score` (raw), `capacity`, and `load` = score ÷ capacity; the heat
  band is always `bandFor(sc.load)`, never `bandFor(sc.score)`. Wherever a
  score is shown, use `scoreText(sc)` so the raw number appears beside the
  adjusted one when capacity isn't 100%.
- **Archiving** — the app's only form of deletion. Nothing is hard-deleted;
  archived managers, assignments, work items, and projects are preserved for
  history. A project is *closed out* when finished and *archived* only when it
  should not be on the list at all (mistake, duplicate, cancelled). An
  archived project counts nowhere — scoring, the drawer, Needs attention, the
  assign dialogs — but its assignments are left un-archived so Restore brings
  the team back intact; any new code that walks `assignments` must check
  `project.archived` as well as `assignment.archived`.
- **Related project** — a work item's optional `relatedProjectId`. Shown under
  the title in the queue, beside the item in the drawer and 1:1 summary, and
  counted on the project card; the queue's Project filter selects by it.
- **Score history** — `managers[].scoreHistory`, `[{d, s, c}]` (local date,
  raw score, capacity), written by `recordScoreHistory()` inside `persist()`
  — one entry per day, today's overwritten by each save, entries equal to the
  previous one skipped, last 400 kept. Reading it (`trendSeries`) carries a
  value forward over days with no entry, which is honest because the score
  only changes when the data does. Stored per manager row (not top level) so
  older clients keep it; `replaceData` merges it by day across copies.
- **Owner history** — `workItems[].ownerHistory`, `[{managerId, from, to}]`
  in local dates, `to: null` for the current owner. Changing an owner must go
  through `reassignOwner(w, newId)` (today only `editWorkItem` does; Backlog
  *Assign…* and Needs attention *Reassign…* both route through it).
  `validate()` → `normalizeOwnerHistory` backfills older items from
  `openedDate` and repairs history an older client left stale. "Carried"
  counts (`ownedDuring`) end at the completion date, else the roll-off date
  for archived items, else today.
- **Orphaned work** — an open work item whose owner is archived. It is off the
  board and not in the Backlog, so Needs attention lists it ("Owner archived")
  until it is reassigned.

## Conventions
- Single IIFE, ES5-style function declarations (`function () {}`, `var`, no
  `class`/`let`/arrow functions in the core — see heimdall.html for the
  established style before adding new code).
- Small DOM helper functions instead of a templating library: `el()`,
  `elem()`, `clear()`, `pill()`, `miniBtn()`, `notice()` (heimdall.html:699,
  832–846).
- Data validated/normalized through a single `validate(parsed)` function
  (heimdall.html:746) whenever loading from IndexedDB, an imported file, or
  a synced shared file — new fields on any entity should be threaded
  through there. It also coerces weights / multipliers / bands to numbers
  (a string weight concatenates instead of adding) and fills missing keys
  from the defaults.
- `ensureName()` resolves to `null` when the name prompt is cancelled, and
  every mutation returns on that: cancelling the prompt cancels the edit.
- Anything that `await`s user input (`openForm`, the name prompt) must
  re-find its record by id afterwards (`findById(data.…, id)`), never keep
  writing to the object it held before the await: returning to the tab runs
  `syncFromLocal` / `syncFromFile`, which can replace `data` wholesale while
  a form is open, and an edit written to the old object is silently lost.
- Tests: a Playwright smoke suite lives in `tests/` (`npm install`, then
  `npm test`). It drives the real file over `file://` in Chromium, seeds
  IndexedDB through `openApp(page, seed({...}))` in `tests/helpers.js`
  (db `heimdall`, store `kv`, keys `data` and `name`), and asserts on
  **rendered DOM** only — the app exports nothing to test against. Date
  checks run in several time zones with `page.clock.setFixedTime()` given a
  UTC instant. `package.json` exists only for this dev tooling; the shipped
  artifact is still the one HTML file with no dependencies. No linter config.
- **Change log** (`data.changes[]`) is generated, not written by hand:
  `commit()` calls `logChanges()`, which diffs the data against `baseline`
  (a snapshot taken at the previous commit) and appends one entry per
  changed field. Any code that **replaces** `data` must go through
  `replaceData(next)`, which union-merges both logs by entry id and resets
  the baseline — assigning `data = …` directly would either lose the other
  side's log or log the whole incoming copy as one user's edits. Fields that
  are bookkeeping rather than user edits go in `LOG_SKIP`.
- New **top-level** keys must be added to `defaultData()` and copied in
  `validate()` — it rebuilds the object from defaults and drops anything it
  doesn't know. Older app versions drop them too, so everyone on a shared
  file must upgrade together; new per-row fields survive older clients.
- Archive-type actions go through `applyWithUndo(label, changes, message)`
  with changes built by `fieldChange(coll, record, field, next)`, so the
  last one can be undone. Undo re-finds each record by id and restores a
  field only if it still holds the value the action set — never a whole-data
  snapshot, which would wipe a sync. `commit()` ends the undo window, so the
  undoable action must call `applyWithUndo` (which commits) rather than
  mutating and then calling `commit()` itself.
- No git submodules/monorepo; this is the whole repo.

## Known gotchas
- The CSP meta tag (heimdall.html:15) requires `'unsafe-inline'` for both
  `script-src` and `style-src` specifically because the file is loaded over
  `file://` — don't tighten this without testing `file://` loads, not just
  `http://`.
- Live shared-file sync (via `showDirectoryPicker`/File System Access API)
  is Chromium-only (`DIR_API` check at heimdall.html:667). Firefox/Safari
  get full local (IndexedDB) functionality but must use manual JSON
  Export/Import to share — there is no feature-equivalent fallback to
  build, this is a real platform gap the README documents deliberately.
- IndexedDB is the source of truth locally; the shared file is a
  best-effort sync layer with last-write-wins conflict resolution (by save
  timestamp) — not a CRDT or merge strategy. Don't assume concurrent edits
  merge cleanly.
- IndexedDB is shared by every Heimdall tab and window in the browser — and,
  because `file://` pages share one origin in Chromium, by every copy of
  `heimdall.html` on the machine. Returning to a tab adopts a newer local
  save (`syncFromLocal`); last write still wins between them.
- **Colors are tokens.** Every color is a CSS custom property on `:root`
  (including heat bands `--h-*`, the warm `--warn*` accents, and the type
  colors JS uses via `var(--t-…)`). Dark mode redefines them twice — once
  under `prefers-color-scheme: dark` (unless `data-theme="light"`), once for
  `:root[data-theme="dark"]` — and the two blocks must stay identical. Both
  are `@media screen`, so print stays light. Don't add a hard-coded hex in
  a rule; add a token and give it a dark value. The theme choice lives in
  `localStorage` (`heimdall-theme`), applied by a small script in `<head>`.
- Heat-label colors follow a band's *position* (lowest → highest), not its
  name, so renaming a band in Settings keeps its color.
- Clearing browser site data destroys the local copy with no server-side
  backup; only a linked shared file or manual export protects against this.
- `connect-src 'none'` in the CSP is intentional and load-bearing for the
  "no network calls ever" security posture — any future feature needing
  `fetch`/XHR is a scope change, not a bug fix.
- All dates in the data file are plain `YYYY-MM-DD` calendar dates with no
  time zone. Read and write them **locally** — `todayISO()` builds from
  `getFullYear/getMonth/getDate`, and `parseISODate()` parses to local
  midnight. `new Date("2026-01-01")` and `toISOString().slice(0,10)` are
  UTC-based and put the app a day off for anyone not on UTC; both have
  caused real bugs (wrong report buckets, "-1d" ages, roll-off flagged a day
  early).
