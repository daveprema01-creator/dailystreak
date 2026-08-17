# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Daily Streak — a minimal habit tracker. Vanilla HTML/CSS/JS with **no build tools, no package manager, no framework, and no backend**. Three files: `index.html`, `style.css`, `app.js`. All state lives in the browser's `localStorage`.

## Running it

There is no build/lint/test tooling in this project. To run it:

- Open `index.html` directly in a browser, or
- Serve it locally for a more realistic environment: `python3 -m http.server 8642` from this directory, then visit `http://localhost:8642/index.html`.

To verify a change, reload the page in a browser and exercise the feature manually — there is no automated test suite.

## Architecture

Everything lives in three flat files with no modules/bundler — `index.html` loads `style.css` and `app.js` directly via `<link>`/`<script>` tags.

**Storage (localStorage keys, defined at the top of `app.js`):**
- `daily-streak-habits` — JSON array of habit objects (see below)
- `daily-streak-username` — the user's display name, set via a first-visit modal
- `daily-streak-theme` — `"light"` or `"dark"`, absent means "follow system preference"

**Habit data model** (`app.js`, `addHabit`):
```
{ id, name, target, periodValue, periodUnit, completions: [...dateStrings], milestonesHit: [...numbers] }
```
`completions` is a flat array of `YYYY-MM-DD` strings, one entry per completion — the same date can appear multiple times for habits with a target > 1. There is no per-completion timestamp, only the date.

**Period/cadence system** — a habit's goal is "`target` times every `periodValue` `periodUnit`(s)" (day/week/month/custom). This is the trickiest part of the codebase: everything reduces to a single abstraction, a rolling N-day window ending on a given date (`periodDays`, `countInWindow`, `calcStreak` in `app.js`). Day, week, month, and custom-day cadences are NOT handled as special cases — they all go through the same rolling-window math with `UNIT_DAYS = { day: 1, week: 7, month: 30 }`. `getPeriod()` also handles back-compat with an older `{ timeframe: "day" | "week" }` data shape from before the flexible-period feature existed.

**Streak semantics**: a streak counts consecutive *completed* periods, but the current (still in-progress) period doesn't break the streak just because it isn't finished yet — `calcStreak` checks whether the current window already fails the target and, if so, starts counting from the *previous* window instead. This "still alive until proven broken" leniency is intentional, not a bug.

**Rendering** (`render()` in `app.js`): fully re-renders the entire `#habit-list` from `localStorage` on every mutation (add/delete/mark-done/undo) — it clones `#habit-card-template` per habit rather than diffing. Every mutation function (`addHabit`, `deleteHabit`, `markDone`, `undoLast`) follows the same pattern: mutate the array, `saveHabits()`, call `render()`.

**Progress visual**: every habit card shows a single animated progress bar (`.progress-bar-track`/`-fill`) filled to `periodCount / target`, regardless of period. The complete-button is `disabled` once `goalMet` so completions can't exceed `target`; a habit's own 7-day/12-week history lives in the history modal (heatmap), not on the card.

**Theming**: all colors are CSS custom properties on `:root` in `style.css`, with overrides under both `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]` so the in-app toggle (`app.js` `applyTheme`/`initTheme`) can override system preference. When adding UI, use existing `var(--...)` tokens rather than hardcoded colors so dark mode keeps working.

**Milestone celebrations**: `markDone()` computes the new streak after each completion and checks it against `STREAK_MILESTONES = [7, 30, 100, 365]`, tracking which have already fired per-habit in `milestonesHit` so each one celebrates exactly once.

**Backup/restore**: `exportData()`/`importData()` serialize `{ name, habits }` to/from a downloaded JSON file — this is the only way a user's data survives a cleared `localStorage` or a device switch, since there is no server sync.
