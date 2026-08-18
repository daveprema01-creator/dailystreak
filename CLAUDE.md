# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Daily Streak — a minimal habit tracker. Vanilla HTML/CSS/JS with **no build tools, no package manager, no framework**. Three files: `index.html`, `style.css`, `app.js`. Signing in is optional: signed out, all state lives in the browser's `localStorage`; signed in, the same UI reads/writes a Supabase Postgres table instead, so habits sync across devices. The Supabase JS SDK is loaded via a plain CDN `<script>` tag (no bundler) to keep the no-build-tools constraint intact.

## Running it

There is no build/lint/test tooling in this project. To run it:

- Open `index.html` directly in a browser, or
- Serve it locally for a more realistic environment: `python3 -m http.server 8642` from this directory, then visit `http://localhost:8642/index.html`.

To verify a change, reload the page in a browser and exercise the feature manually — there is no automated test suite.

## Architecture

Everything lives in three flat files with no modules/bundler — `index.html` loads `style.css` and `app.js` directly via `<link>`/`<script>` tags.

**Storage (localStorage keys, defined at the top of `app.js`) — used when signed out:**
- `daily-streak-habits` — JSON array of habit objects (see below)
- `daily-streak-username` — the user's display name, set via a first-visit modal
- `daily-streak-theme` — `"light"` or `"dark"`, absent means "follow system preference" (this key is used regardless of sign-in state — theme is a device preference, not synced)

**Sync (Supabase, project ref `yyeexumwqboxfpbssoqj`) — used when signed in:** a single RLS-scoped `habits` table (`id, user_id, name, target, period_value, period_unit, created_at, completions, milestones_hit, rest_days, position`) mirrors the local habit shape almost 1:1 — `habitToRow`/`rowToHabit` in `app.js` convert between the two. `completions`/`milestones_hit`/`rest_days` are `jsonb` columns holding JS arrays. `position` is a DB-only identity column used purely for `ORDER BY` on fetch; the in-memory array's own order already reflects it and it never round-trips into the JS habit object. The display name synced across devices is stored in Supabase auth's `user_metadata.display_name` rather than in `localStorage`. Auth supports email/password plus Google OAuth via `supabaseClient.auth.signInWithOAuth`.

**The `habitsCache` array** (`app.js`, top of file) is the single in-memory source of truth every render/stat function reads through `loadHabits()`. `refreshHabitsCache()` fills it from either `localStorage` (signed out) or a Supabase `select` (signed in) and is called on the initial `onAuthStateChange` firing and again on every sign-in/sign-out. Mutations (`addHabit`, `deleteHabit`/`restoreHabit`, `markDone`/`undoLast`, the edit-form submit) update `habitsCache` in place and call `render()` immediately for an instant UI update, *then* fire an `async` targeted Supabase `insert`/`update`/`delete` (or `saveLocalHabits()` when signed out) in the background — a failed cloud write surfaces a toast (reusing `.undo-toast` styling) rather than failing silently or blocking the UI.

**Habit data model** (`app.js`, `addHabit`):
```
{ id, name, target, periodValue, periodUnit, completions: [...dateStrings], milestonesHit: [...numbers], restDays: [...dateStrings] }
```
`completions` is a flat array of `YYYY-MM-DD` strings, one entry per completion — the same date can appear multiple times for habits with a target > 1. There is no per-completion timestamp, only the date. `restDays` is the same shape, one entry per period a rest day was spent on (see "Rest days" below) — it never overlaps with `completions`.

**Date parsing**: any stored `YYYY-MM-DD` key must go through `parseDateKey()`, not `new Date(dateStr)` — the latter parses as UTC and silently shifts a day in timezones behind UTC. `new Date()` with no argument (today) and cloning an existing `Date` object are both fine as-is.

**Rest days**: each habit gets 3 rest days per calendar month (`restDaysLeft`, `restDaysUsedThisMonth`), spendable to credit a missed period without it counting as a real completion. `calcStreak`/`longestStreak` add `restDaysInWindow(...)` on top of `countInWindow(...)` when checking whether a window met target; `totalCompletions`/`completionRate` deliberately don't. `pickRestOfferHabit()` decides which habit (if any) shows the rest-day offer card in place of its normal card on a given render; declining is tracked only in the in-memory `dismissedRestOffers` set (no persisted field for it). The underlying streak math stays a pure rolling window (see below) — `periodDaysLeft()`/`previousPeriodWindow()` layer a creation-date-anchored period grid on top purely for the rest-day-offer and at-risk UI, not for `calcStreak` itself.

**Period/cadence system** — a habit's goal is "`target` times every `periodValue` `periodUnit`(s)" (day/week/month/custom). This is the trickiest part of the codebase: everything reduces to a single abstraction, a rolling N-day window ending on a given date (`periodDays`, `countInWindow`, `calcStreak` in `app.js`). Day, week, month, and custom-day cadences are NOT handled as special cases — they all go through the same rolling-window math with `UNIT_DAYS = { day: 1, week: 7, month: 30 }`. `getPeriod()` also handles back-compat with an older `{ timeframe: "day" | "week" }` data shape from before the flexible-period feature existed.

**Streak semantics**: a streak counts consecutive *completed* periods, but the current (still in-progress) period doesn't break the streak just because it isn't finished yet — `calcStreak` checks whether the current window already fails the target and, if so, starts counting from the *previous* window instead. This "still alive until proven broken" leniency is intentional, not a bug.

**Rendering** (`render()` in `app.js`): fully re-renders the entire `#habit-list` from `habitsCache` on every mutation (add/delete/mark-done/undo) — it clones `#habit-card-template` per habit rather than diffing, except for the one habit `pickRestOfferHabit()` selects (if any), which clones `#habit-offer-card-template` instead. `render()` also calls `updateHero()` (the dark hero band's longest-run/done-today/last-12-weeks/rest-days-left stats) and `pickAtRiskHabit()` (flips at most one non-offer card to the ink "at risk" polarity, via `.habit-card.at-risk`). The complete-button is `disabled` once `goalMet` so completions can't exceed `target`.

**Card map**: each habit card shows a 12-week map (`renderCardMap()`, reusing `buildHeatmap`/`heatmapLevel`) instead of a progress bar — filled cells are `.map-cell.level-1..4`, rest days are `.map-cell.rested`, today is `.map-cell.today`. The same `buildHeatmap`/`heatmapLevel` pair also drives the larger heatmap in the history modal (`renderHeatmap()`), which shows a habit's full current/longest streak and completion-rate stats.

**Weekly review** (`#weekly-review-view`, opened via `openWeeklyReview()`/`renderWeeklyReview()`): a second top-level view toggled in place of `#main-view` — not a route, just a show/hide swap, since there's no router. Recaps the most recently completed Monday–Sunday week (a display-only convention layered on top of the rolling-window streak math, not a change to it) and surfaces at most one "drifting" habit via `computeDrift()` (median gap between completions vs. its cadence). Accepting a drift suggestion and the edit-habit modal's submit both funnel through the shared `saveHabitEdits()`.

**Theming**: all colors are CSS custom properties on `:root` in `style.css`, with overrides under both `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]` so the in-app toggle (`app.js` `applyTheme`/`initTheme`) can override system preference. When adding UI, use existing `var(--...)` tokens rather than hardcoded colors so dark mode keeps working. Exception: the ink surfaces (hero band, at-risk card, rest-day offer card, weekly review's drifting tile) are hardcoded to the design system's literal coffee/orange hex values (`#201515`, `#ff4f00`, etc.) rather than theme tokens — they're deliberately the same "always ink" surface regardless of the light/dark toggle, not a missed dark-mode case.

**Milestone celebrations**: `markDone()` computes the new streak after each completion and checks it against `STREAK_MILESTONES = [7, 30, 100, 365]`, tracking which have already fired per-habit in `milestonesHit` so each one celebrates exactly once. Celebrations are a `.milestone-toast` message plus a `.habit-card.celebrate` pulse — no confetti/particle effects and no emoji tier icons; the design system allows exactly one chromatic accent (`--accent`), so streak numerals are plain numbers.

**Backup/restore**: `exportData()`/`importData()` serialize `{ name, habits }` to/from a downloaded JSON file, working against whatever's currently loaded (local or cloud). For a signed-out user this remains the only way data survives a cleared `localStorage` or a device switch; for a signed-in user it's a manual export/full-replace-import on top of the automatic sync. Signing in for the first time with existing local habits and an empty cloud account prompts (via `confirm()`, same pattern as import) to bulk-copy the local habits into the new account.
