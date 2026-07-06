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
2. Add your managers (name, title, location).
3. Add projects and build each team inline: one Lead, any Contributors, and an
   effort level (Light / Medium / Heavy) per person.
4. Log work items as they arrive. Leave the owner blank to park an item in the
   **Backlog** until you decide who takes it.
5. Read the **Board**: each manager card shows a color-coded heat label
   (Light → Balanced → Heavy → Overloaded) computed from the weighted score.

Everything saves automatically — there is no Save button. You'll be asked your name
once so the "Last saved by" banner can attribute changes.

## Features

- **Workload Board** — one card per manager: heat label, score, and counts for
  projects led / supporting, escalations, DITL, one-offs. Escalations pop in red.
- **Manager drawer** — click a card for everything that manager carries, recent
  wins, and upcoming roll-offs, plus in-context quick-add and a copy / export /
  print **1:1 summary** for weekly one-on-ones.
- **Projects** — status, priority, dates, Jira epic link, and the team with the
  lead highlighted. A person can appear only once per project.
- **Work Items queue** — filterable by scope (Active / All / History), type, owner,
  status, and date range, with an aging flag for items open 14+ days.
- **Backlog** — unassigned items surface next to the board so distribution
  decisions happen where the load is visible.
- **Needs attention** — items past their roll-off / end date or overdue are never
  silently removed; a review panel lets you archive them deliberately.
- **Reports** — work-item volume over all time or by year / quarter / month / week,
  segmented by type.
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

## Where the data lives

- **Local-first:** data is stored in the browser (IndexedDB) and saves
  automatically on every change. The app opens instantly with zero prompts in any
  modern browser.
- **Team sync (Edge / Chrome):** *Settings → Link shared file* points Heimdall at a
  folder in a synced drive (OneDrive / SharePoint / Google Drive). It maintains a
  shared `heimdall-data.json` there, pulls teammates' changes when you return to
  the tab, and remembers the link across sessions.
- **Conflict model:** last write wins by save timestamp (documented and accepted —
  the banner always shows who saved last, and *Reload latest* re-reads on demand).
- **Backups:** every synced save also writes `heimdall-data.backup-YYYYMMDD-HHMM.json`
  beside the shared file; the 10 most recent are kept. A corrupted shared file is
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

`managers[]` (id, name, title, location, active) · `projects[]` (id, name,
description, status, priority, startDate, targetDate, completedDate, link) ·
`assignments[]` (id, projectId, managerId, role, effort, startDate, endDate,
archived) · `workItems[]` (id, type, title, managerId, relatedProjectId, status,
priority, openedDate, dueDate, rollOffDate, completedDate, archived, link, notes) ·
`settings` (weights, effort, bands, appVersion, lastSavedBy, lastSavedAt).

Nothing is hard-deleted — archiving preserves the historical record.

## Possible future enhancements

Soft-locking ("{name} is editing"), a lightweight change log, a roll-off timeline
view, recurring-item templates, dark mode, and reassignment history are documented
as post-MVP ideas and intentionally not built yet.
