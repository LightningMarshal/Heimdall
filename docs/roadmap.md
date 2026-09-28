# Heimdall — Roadmap

_Last updated: 2026-09-28 · app version 0.6.1_

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

Not fixed in 0.6.1 because each is a product decision rather than a bug. Recorded so
they are not rediscovered as surprises.

- **Projects cannot be removed.** A project entered by mistake stays in the Projects
  list forever; closing it out is the only exit, and it then shows as a completed
  project. Needs a project `archived` flag threaded through scoring, the assign
  dialogs, the related-project select, and a "show archived" toggle.
- **`relatedProjectId` is write-only.** Work items record a related project, but
  nothing displays it: not the project card, the queue, or the drawer. Either show it
  (e.g. "3 open items" on the project card) or stop asking for it.
- **One Lead per project is not enforced.** The README and Help say a team has one
  Lead; the team builder accepts several, and each scores as a lead. Decide whether
  co-leads are legitimate; if not, block or warn on save.
- **Sync conflicts are still last-write-wins.** 0.6.1 stops a background tab from
  overwriting a newer local save, and stops a form open across a sync from dropping
  its edit, but two people editing the shared file inside the same few seconds still
  lose one side. That is constraint #3, and it is what #6 and #11 below address.

## Near-term — small, high leverage

### 1. A test harness
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

### 2. Capacity per manager
Heat bands are global, so a part-time manager, a new hire still ramping, and a
25-year veteran are all judged against 0–4 / 5–9 / 10–14 / 15+. A per-manager
`capacity` multiplier (or a "score ÷ capacity" normalization) would make the board
honest about a team that is not uniform. Needs a new field on `managers[]`, a Settings
explanation, and a decision about whether the displayed score is raw or normalized —
showing both is probably right.

### 3. Undo for the last archive
Archiving is one click and reversible in principle (Restore in the work items table,
Settings for managers) but not obviously so in the moment, and "Archive all past
roll-off" is a bulk action with no way back short of hunting through History. A single
"Undo" affordance on the notice bar, good for the most recent archive action, is a
few dozen lines and removes real hesitation from the panel that most wants to be used
without hesitation.

### 4. CSV export from Reports
The Reports view answers volume questions well and then dead-ends: the numbers cannot
leave. A CSV download of the current buckets (same `Blob` route Export already uses)
makes the tool feed the quarterly review deck instead of being retyped into it.

## Medium — worth doing, bigger surface

### 5. Roll-off timeline / "who frees up when"
Today the board answers "who is loaded **now**". The recurring planning question is
"who has room in six weeks", and the data to answer it already exists — assignment
`endDate`, work-item `rollOffDate`, project `targetDate`. A horizontal 90-day lane per
manager showing what comes off and when would turn Heimdall from a status board into a
planning tool. This is the single biggest functional gain available. It is also the
most layout work: a timeline that stays legible at four managers and at fifteen, and
prints, is real design.

### 6. Change log
Last-write-wins means a teammate's edit can vanish and nobody can reconstruct what it
was. An append-only `changes[]` (who, when, entity, field, old → new, capped at the
last few hundred entries) would make conflicts diagnosable after the fact without
pretending to solve them. Grows the data file, so the cap matters; the shared file is
read whole on every sync.

### 7. Reassignment history
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

### 9. Workload trend over time
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

### 13. Dark mode
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
