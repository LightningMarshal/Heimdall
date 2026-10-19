# Heimdall — Team Workload Tracker

A single-file, browser-based tool for a senior manager (and 2–4 peers) to see, at a
glance, what each manager on the team is carrying and how loaded they are. It tracks
project assignments (lead vs. contributor, with an effort level), occasional work
items (customer escalations, Day-in-the-Life requests, one-offs), keeps full history
as items roll off, and turns it all into a weighted workload signal so it's obvious
who is overloaded and who has room.

The entire application is **one file — `heimdall.html`** — with no build step, no
server, no database engine, and no external dependencies of any kind. Double-click
it and it runs.

## Quick start

1. Open `heimdall.html` in a modern browser (Microsoft Edge or Chrome recommended).
2. Add your managers (name, title, location, and capacity — 100% unless they are
   part-time or still ramping).
3. Add projects and build each team inline: a Lead (occasionally two co-leads), any
   Contributors, and an effort level (Light / Medium / Heavy) per person.
4. Log work items as they arrive. Leave the owner blank to park an item in the
   **Backlog** until you decide who takes it.
5. Read the **Board**: each manager card shows a color-coded heat label
   (Light → Balanced → Heavy → Overloaded) computed from the weighted score.

Everything saves automatically — there is no Save button. You'll be asked your name
once so the "Last saved by" banner can attribute changes.

## Features

- **Workload Board** — one card per manager: heat label, score, and counts for
  projects leading / supporting, escalations, DITL, one-offs. Escalations pop in red.
  Hover a heat label to see the band's score range and the exact score behind it.
- **Capacity per manager** — a percentage of a full load (default 100%). The heat
  band uses score ÷ capacity, so a half-time manager with 6 points reads as 12
  (Heavy). Whenever capacity isn't 100% the card shows both numbers
  ("score 12 · raw 6") and a Capacity chip.
- **Workload trend** — every save records each active manager's score for the day.
  Cards show a 12-week sparkline; the drawer charts six months against the heat bands
  and says how long they've been in their current band ("Heavy since 2026-07-20
  (91 days)"), which the 1:1 summary includes too.
- **Manager drawer** — click a card for everything that manager carries, recent
  wins, and upcoming roll-offs, plus in-context quick-add and a copy / export /
  print **1:1 summary** for weekly one-on-ones (printing from the drawer prints the
  drawer alone).
- **Timeline — who frees up when** — a 90-day lane per active manager with a marker
  wherever something they carry comes off: an assignment's end date (else its
  project's target date, hollow marker) or a work item's roll-off date (else its due
  date, hollow). Past dates sit in a left gutter, later ones and undated ones in a
  right gutter. Each lane shows the load now and projected at 2 / 6 / 12 weeks
  (assuming dated items come off on time and nothing new arrives), and can be sorted
  by most room in six weeks. Projections never change the board's score. Prints.
- **Projects** — status, priority, dates, Jira epic link, and the team with the
  lead highlighted (co-leads are allowed). A person can appear only once per project.
  Each card counts its related work items and links to them; *+ Work item* logs one
  already linked to the project.
- **Archive / Restore projects** — for a project entered by mistake, duplicated, or
  cancelled. It leaves the list and stops counting anywhere, but keeps its team and
  related work; *Show archived* lists it again with a *Restore* button.
- **Close out / Reopen** — one click on the project card. Closing out asks for a
  completion date (today by default, backdate it freely) and never requires a start,
  target, or end date, so open-ended and non-time-bound projects close the same way.
  The project keeps its team and history and stops counting toward workload; *Reopen*
  puts it back to Active.
- **Custom "Other" types** — choosing type **Other** prompts for a short free-text label
  ("Vendor audit", "Hiring loop"), which then replaces "Other" wherever the item is shown
  and is included in search. Reports still group these under Other.
- **Work Items queue** — filterable by scope (Active / All / History), type, owner,
  related project, status, and date range, with an aging flag for items open 14+ days.
  An item's related project shows under its title and links to it.
- **Reassignment history** — a work item remembers every owner and when they had it.
  The queue shows "previously …", the earlier owner's drawer and 1:1 summary list it
  under *Handed off* for 90 days, and Reports → *Work items carried per manager* counts
  it for each person who owned it during a period.
- **Backlog** — unassigned items surface next to the board so distribution
  decisions happen where the load is visible.
- **Needs attention** — items past their roll-off / end date or overdue are never
  silently removed; a review panel lets you archive them deliberately. Active projects
  past their target date show up there too, with a *Close out* action, and so does open
  work whose owner has been archived, with a *Reassign* action.
- **Undo** — the most recent archive (a work item, project, or manager, marking an
  item Done, or *Archive all past roll-off*) can be undone from the message bar or the
  Needs attention dialog until the next change. It restores only the fields that action
  changed, and skips any record edited again since.
- **Reports** — work-item volume over all time or by year / quarter / month / week,
  segmented by type. The chart shows the 20 most recent periods; **Download CSV**
  saves every period at the chosen grouping (Period, Total, one column per type,
  oldest first; UTF-8 with a byte-order mark so Excel reads it correctly).
- **Change log** — Settings → Change log: every saved change, field by field (when,
  who, record, old → new), the last 500 kept, downloadable as CSV. When one copy
  overwrites another, the data is still last-write-wins but both copies' log entries
  are kept, so a lost edit can be seen and redone.
- **Settings** — every weight, effort multiplier, and heat band is editable and
  stored in the data file; manager archive lives here (off the board) on purpose.
- **Help** — a full in-app guide (Help tab).

## Workload scoring (defaults, all editable)

| Item                   | Weight |
|------------------------|--------|
| Project — Lead         | 3      |
| Project — Contributor  | 1      |
| Customer escalation    | 4      |
| Day-in-the-Life (DITL) | 2      |
| One-off task           | 1      |
| Other                  | 1      |

Project weights are multiplied by effort: Light ×1, Medium ×1.5, Heavy ×2. Only
active projects and open / in-progress items count. Heat bands: 0–4 Light ·
5–9 Balanced · 10–14 Heavy · 15+ Overloaded.

**Capacity** then divides the total: the band is chosen from
`score ÷ capacity`, where capacity is the manager's share of a full load (1 = 100%,
set as a percentage between 10 and 300 in the manager form). At 100% nothing changes.
The raw score is always shown alongside the adjusted one.

Because effort multiplies, scores are fractional and can land between two
whole-number bands — 4.5, say. Such a score belongs to the band below it: the highest
band it has actually reached. One medium-effort lead role is 3 × 1.5 = 4.5, which is
**Light**, not the band above.

## Where the data lives

- **Local-first:** data is stored in the browser (IndexedDB) and saves
  automatically on every change. The app opens instantly with zero prompts in any
  modern browser.
- **Team sync (Edge / Chrome):** *Settings → Link shared file* points Heimdall at a
  folder in a synced drive (OneDrive / SharePoint / Google Drive). It maintains a
  shared `heimdall-data.json` there, pulls teammates' changes when you return to
  the tab, and remembers the link across sessions.
- **Other tabs:** two Heimdall tabs in one browser share the same local copy; returning
  to a tab loads anything newer the other saved, instead of overwriting it.
- **Conflict model:** last write wins by save timestamp (documented and accepted —
  the banner always shows who saved last, and *Reload latest* re-reads on demand).
  The change log is the exception: it is union-merged by entry, so an overwritten
  edit is still on record.
- **Upgrade together:** everyone on a shared file should run the same version of
  `heimdall.html`. An older copy keeps only the data it knows about, so its next save
  drops newer top-level data such as `changes[]`.
- **Backups:** synced saves also write `heimdall-data.backup-YYYYMMDD-HHMM.json`
  beside the shared file, at most one every 30 minutes; the 10 most recent are kept. A corrupted shared file is
  never overwritten — the app offers to restore from a backup instead.
- **Export / Import (all browsers):** manual JSON download / load, which is also
  the sharing route for non-Chromium browsers.

> ⚠️ Clearing the browser's site data erases the local copy. Link a shared file or
> export periodically so a copy always exists on disk.

## Security posture

- No network calls of any kind: no CDN, no fonts, no analytics, no fetch/XHR — a
  strict `Content-Security-Policy` meta tag (`connect-src 'none'`) enforces this.
- No server, no open port, no Electron, no database engine, no `eval`.
- System font stack only; everything inlined in the one HTML file.
- Intended for non-sensitive coordination data: reference tickets by ID or short
  title with an optional link — keep incident details and customer data out.

## Browser support

| Capability                | Edge / Chrome | Firefox / Safari |
|---------------------------|---------------|------------------|
| Full app, local auto-save | ✅            | ✅               |
| Shared-file live sync     | ✅            | — (use Export/Import) |

## Data model (in `heimdall-data.json`)

`managers[]` (id, name, title, location, capacity, active, scoreHistory[] of
{d, s, c} — date, raw score, capacity; one per day, kept for 400) · `projects[]` (id, name,
description, status, priority, startDate, targetDate, completedDate, link, archived) ·
`assignments[]` (id, projectId, managerId, role, effort, startDate, endDate,
archived) · `workItems[]` (id, type, typeOther, title, managerId, relatedProjectId,
status, priority, openedDate, dueDate, rollOffDate, completedDate, archived, link,
notes, ownerHistory[] of {managerId, from, to}) ·
`changes[]` (id, at, by, entity, entityId, label, field, from, to — capped at 500) ·
`settings` (weights, effort, bands, appVersion, lastSavedBy, lastSavedAt).

Nothing is hard-deleted — archiving preserves the historical record.

## Development & tests

`heimdall.html` needs nothing installed to run. The repo carries one piece of
dev-time tooling: a Playwright smoke suite in `tests/` that drives the real file over
`file://` in Chromium and asserts on what is rendered.

```sh
npm install        # once — installs @playwright/test (pinned) into node_modules/
npm test           # runs every spec in tests/
```

- `tests/helpers.js` — `openApp(page, data)` seeds IndexedDB (db `heimdall`, store
  `kv`, keys `data` and `name`) and reloads, so each test starts from a known data
  file without clicking through setup; `seed({...})` builds a minimal valid file.
  Every test also fails on any uncaught page error.
- `tests/smoke.spec.js` — board, drawer, projects, work items, backlog, Needs
  attention, reports, settings, search.
- `tests/dates.spec.js` — the date-sensitive checks, run in UTC, New York (late
  evening) and Auckland (early morning), where the local and UTC dates differ.
- Chromium comes from the environment's Playwright install; the pinned
  `@playwright/test` version must match it, or run `npx playwright install chromium`.

Add a test with every behavior change. The tests never touch `heimdall.html`; they
are not shipped with it.

## Possible future enhancements

See **[docs/roadmap.md](docs/roadmap.md)** for the ranked list of post-MVP ideas —
soft-locking, a change log, a roll-off timeline, recurring-item templates, capacity
targets per manager, dark mode, and more — along with what each one would cost and
which ones would break the "one file, no network" constraints.
