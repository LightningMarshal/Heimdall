# Heimdall — Roadmap

_Last updated: 2026-10-29 · app version 0.16.0_

Post-MVP ideas, ranked by how much they improve the one question Heimdall exists to
answer — **who is carrying too much, and who has room** — against what they cost in a
single HTML file with no build step and no network.

Nothing here is committed work. It is a place to argue about priority before writing
code, and a record of what was deliberately left out and why.

## The constraints that decide what is feasible

Every idea below is scored against these. They are not negotiable defaults; they are
the reasons the tool is usable at all.

1. **One file, no build step.** `heimdall.html` is the deployment artifact. An idea
   that needs a bundler, a package manager, or a second file to ship is a different
   product.
2. **No network calls, ever.** The CSP meta tag sets `connect-src 'none'`. Anything
   needing `fetch`/XHR — a real server, a webhook, a Jira sync, an LLM call — is a
   scope change that breaks the security posture the tool is trusted on, not a
   feature increment.
3. **Last-write-wins on a shared file.** There is no merge engine and no server to
   arbitrate. Features that assume concurrent editing resolves cleanly will lose data.
4. **Nothing is hard-deleted.** Archiving is the only removal. New entities need an
   archive story, not a delete button.
5. **Ten-ish people, thousands of rows at most.** Everything re-renders from scratch
   on every change. That is fine at this size and is why the code has no framework;
   an idea that only pays off at 10,000 rows is solving someone else's problem.

## Gaps found in the 2026-09-28 full review

Each needed a product decision rather than a bug fix. Outcomes:

- **Projects could not be removed** — *built in 0.7.0.* Projects now archive and
  restore (Projects → Show: Archived); archived projects count nowhere.
- **`relatedProjectId` was write-only** — *built in 0.7.0.* Shown in the queue, the
  drawer, and the 1:1 summary; counted and linked on the project card; filterable.
- **One Lead per project was not enforced** — *decided: don't enforce.* Two co-leads
  is rare but real. Both score as leads; the docs now say "usually one".
- **Sync conflicts are still last-write-wins.** 0.6.1 stops a background tab from
  overwriting a newer local save, and stops a form open across a sync from dropping
  its edit, but two people editing the shared file inside the same few seconds still
  lose one side. That is constraint #3, and it is what #6 and #11 below address
  (#6, the change log, is built in 0.12.0: the lost side is now on record).

## Near-term — small, high leverage

### 1. A test harness — *built 2026-10-19*
**Built:** `tests/` holds a Playwright smoke suite (`npm install`, `npm test`) that
seeds IndexedDB, drives the real file over `file://`, and asserts on rendered DOM,
with the date checks repeated in UTC, New York and Auckland. See the README's
*Development & tests* section. `heimdall.html` is untouched by it. Original note:

The highest-value thing missing. The repo has no tests; every regression so far was
caught by reading code or by a user hitting it in production. Chromium is the only
dependency needed to drive the real file over `file://`, so a `tests/` directory with
a Playwright smoke suite — seed IndexedDB (db `heimdall`, store `kv`, key `data`),
click through board / projects / work items / settings, assert on **rendered DOM**
rather than internals — would catch exactly the class of bug that issues #6 and #7
were. Run the date-sensitive checks in several time zones; plain `YYYY-MM-DD` dates
have bitten this app twice.

It would not touch `heimdall.html`, so the one-file, no-dependency constraint survives
intact — the cost is that the repo gains dev-time tooling it has so far done without.
That is the trade to weigh. **Cost: small. Value: compounding.**

### 2. Capacity per manager — *built in 0.8.0*
**Built:** `managers[].capacity` (percentage in the manager form, 100% default). The
band is chosen from score ÷ capacity, and both numbers are shown — "score 12 · raw 6"
plus a Capacity chip — whenever capacity isn't 100%. Original note:

Heat bands are global, so a part-time manager, a new hire still ramping, and a
25-year veteran are all judged against 0–4 / 5–9 / 10–14 / 15+. A per-manager
`capacity` multiplier (or a "score ÷ capacity" normalization) would make the board
honest about a team that is not uniform. Needs a new field on `managers[]`, a Settings
explanation, and a decision about whether the displayed score is raw or normalized —
showing both is probably right.

### 3. Undo for the last archive — *built in 0.9.0*
**Built:** an *Undo* button on the message bar (and in the Needs attention dialog)
for the most recent archive, Done, or *Archive all past roll-off*, good until the next
change. It records only the fields it changed and skips records edited since.
Original note:

Archiving is one click and reversible in principle (Restore in the work items table,
Settings for managers) but not obviously so in the moment, and "Archive all past
roll-off" is a bulk action with no way back short of hunting through History. A single
"Undo" affordance on the notice bar, good for the most recent archive action, is a
few dozen lines and removes real hesitation from the panel that most wants to be used
without hesitation.

### 4. CSV export from Reports — *built in 0.10.0*
**Built:** *Download CSV* on the Reports view — one row per period at the chosen
grouping, every period (the chart stops at 20), oldest first, Total plus a column per
type. Original note:

The Reports view answers volume questions well and then dead-ends: the numbers cannot
leave. A CSV download of the current buckets (same `Blob` route Export already uses)
makes the tool feed the quarterly review deck instead of being retyped into it.

## Medium — worth doing, bigger surface

### 5. Roll-off timeline / "who frees up when" — *built in 0.11.0*
**Built:** a *Timeline* view: a 90-day lane per active manager, markers at end /
roll-off dates (hollow where a target or due date stands in), past and later gutters,
projected load at 2 / 6 / 12 weeks with a *Most room in 6 weeks* sort, click-through
markers, and a print layout. Projections are display-only; the board's scoring is
unchanged (#10 remains on hold). Original note:

Today the board answers "who is loaded **now**". The recurring planning question is
"who has room in six weeks", and the data to answer it already exists — assignment
`endDate`, work-item `rollOffDate`, project `targetDate`. A horizontal 90-day lane per
manager showing what comes off and when would turn Heimdall from a status board into a
planning tool. This is the single biggest functional gain available. It is also the
most layout work: a timeline that stays legible at four managers and at fifteen, and
prints, is real design.

### 6. Change log — *built in 0.12.0*
**Built:** `changes[]`, generated by diffing each commit against the previous state,
capped at 500, shown (and downloadable as CSV) in Settings → Change log. The log is
union-merged by entry id whenever data is replaced, so both sides of a last-write-wins
overwrite stay on record. Original note:

Last-write-wins means a teammate's edit can vanish and nobody can reconstruct what it
was. An append-only `changes[]` (who, when, entity, field, old → new, capped at the
last few hundred entries) would make conflicts diagnosable after the fact without
pretending to solve them. Grows the data file, so the cap matters; the shared file is
read whole on every sync.

### 7. Reassignment history — *built in 0.13.0*
**Built:** `workItems[].ownerHistory`, backfilled for existing items. Shown as
"previously …" in the queue, *Handed off* in the drawer and 1:1 summary, and a
*Work items carried per manager* table in Reports (last four periods at the chosen
grouping). Original note:

When a work item changes owner, the previous owner disappears from the record — the
item simply belongs to someone else, and "how much did Ada carry last quarter" quietly
becomes unanswerable. Storing an owner history on `workItems[]` is a small model
change with a large reporting payoff, and it is a prerequisite for any honest
per-person trend view (#9).

### 8. Recurring / template work items
Monthly DITL rotations, quarterly audits, and on-call weeks are re-entered by hand
every cycle. A template that stamps out a work item on a cadence would remove the most
repetitive data entry. The catch: with no server nothing fires while the tab is
closed, so "recurring" means "offer to create the due ones when you next open the
app", which needs a clear UI or it feels like the app is inventing work.

### 9. Workload trend over time — *built in 0.14.0*
**Built:** `managers[].scoreHistory`, one snapshot per day written on save. A 12-week
sparkline on each card, a six-month chart over the heat bands in the drawer, and
"Heavy since … (N days)" in the drawer and 1:1 summary. Reassignment (#7) is recorded,
so the trend reflects who actually held the work. Original note:

The board is a snapshot with no memory: it cannot show that someone has been Heavy for
three months. A periodic score snapshot per manager (written on save, deduplicated to
one per day) would enable a sparkline on each card and a trend line in the drawer —
much better 1:1 material than a single number. Interacts with #7: trends are only
truthful if reassignment is recorded.

## Larger bets — worth arguing about first

### 10. Honour assignment date ranges in scoring
`assignments[]` carries `startDate` and `endDate`, and `managerScore` ignores both: an
assignment that ended last month keeps counting until someone archives it from
**Needs attention**. That is deliberate — nothing disappears silently — but it means
the board can overstate load for anyone who has not done their roll-off review. An
opt-in setting ("stop counting assignments past their end date") would suit teams that
trust their dates, while leaving the review-first default for teams that do not.

### 11. Soft-locking / presence
Writing a `{name} is editing` marker with a heartbeat into the shared file would let the app warn
before two people overwrite each other. It is a real improvement on silence — and it is
also the point where the honest answer may be that a tool wanting true concurrent
editing wants a server, which constraint #2 rules out. Worth prototyping precisely to
find out how much it helps within the constraint.

### 12. Multi-team rollup
A second level of hierarchy (teams, or skip-level grouping) so a director sees several
managers-of-managers at once. Straightforward data-wise, and a serious change to every
view's information density. Only worth it if the tool is actually adopted a level up.

### 13. Dark mode — *built in 0.15.0*
**Built:** every hard-coded color moved to a token; a dark palette follows the system
setting, Settings → Appearance can force Light or Dark (per browser), and print is
always light. Original note:

All colors already live in CSS custom properties on `:root`, so this is a
`prefers-color-scheme` block plus a check of every hard-coded value — the type pill
colors and heat backgrounds in particular. Low risk, moderate tedium, purely cosmetic:
listed last on purpose, since it is often the first thing suggested.

## Deliberately not doing

- **Any server, API, or hosted component.** Breaks constraint #2 and the entire
  security story. If a team needs multi-user concurrency with real conflict
  resolution, they need a different tool, and Heimdall's export makes leaving easy.
- **Jira / ticketing integration.** Same reason. Links to tickets are the integration.
- **Storing incident detail or customer data.** The file syncs through a shared drive
  with no encryption and no access control beyond the folder's. Reference tickets by
  ID and keep the content where it belongs.
- **A framework or build step.** The file is ~2,000 lines and re-renders in
  milliseconds. React would cost the double-click-and-it-runs property, which is the
  reason the tool gets used.
