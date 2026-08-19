# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Daily Streak — a minimal habit tracker. Vanilla HTML/CSS/JS with **no build tools, no package manager, no framework**. Three files: `index.html`, `style.css`, `app.js`. Signing in is optional: signed out, all state lives in the browser's `localStorage`; signed in, the same UI reads/writes a Supabase Postgres table instead, so habits sync across devices. The Supabase JS SDK is loaded via a plain CDN `<script>` tag (no bundler) to keep the no-build-tools constraint intact. Design system: warm-cream canvas, coffee-ink surfaces, a single orange accent — see `design_handoff_daily_streak/README.md` and `design.md` before changing colors, type, or spacing.

## Running it

There is no build/lint/test tooling in this project.

- Open `index.html` directly in a browser, or serve it locally: `python3 -m http.server 8642` from this directory, then visit `http://localhost:8642/index.html`.
- To verify a change, reload the page and exercise the feature manually in a real browser — there is no automated test suite, and plain code review has already missed real bugs here (a UTC date-parsing bug and a CSS `[hidden]`-specificity bug both only showed up once actually clicked through).

## Architecture

Everything lives in three flat files with no modules/bundler — `index.html` loads `style.css` and `app.js` directly via `<link>`/`<script>` tags.

### Storage

- `daily-streak-habits` (localStorage) — JSON array of habit objects, used when signed out.
- `daily-streak-username` (localStorage) — display name; also doubles as a pending name during account creation (see Onboarding).
- `daily-streak-theme` (localStorage) — `"light"`/`"dark"`, absent means "follow system." Used regardless of sign-in state — theme is a device preference, not synced.
- **Supabase** (project ref `yyeexumwqboxfpbssoqj`, used when signed in): one RLS-scoped `habits` table (`id, user_id, name, target, period_value, period_unit, created_at, completions, milestones_hit, rest_days, position`). `habitToRow`/`rowToHabit` in `app.js` convert to/from the local habit shape. `completions`/`milestones_hit`/`rest_days` are `jsonb` columns holding JS arrays. `position` is a DB-only identity column for `ORDER BY` on fetch — the in-memory array's own order already reflects it and it never round-trips into the JS object. The synced display name lives in Supabase auth's `user_metadata.display_name`, not a table column. Auth supports email/password plus Google OAuth.

The `habitsCache` array (top of `app.js`) is the single in-memory source of truth every render/stat function reads via `loadHabits()`. `refreshHabitsCache()` fills it from `localStorage` or a Supabase `select` and runs on the first `onAuthStateChange` and every sign-in/sign-out after. Mutations update `habitsCache` in place, call `render()` immediately, *then* fire an `async` Supabase write (or `saveLocalHabits()`) in the background — a failed cloud write surfaces a toast rather than blocking the UI.

### Habit data model

```
{ id, name, target, periodValue, periodUnit, completions: [...dateStrings], milestonesHit: [...numbers], restDays: [...dateStrings] }
```

`completions` is a flat array of `YYYY-MM-DD` strings, one entry per completion (a date can repeat for target > 1) — no per-completion timestamp. `restDays` is the same shape, one entry per period a rest day was spent on; never overlaps `completions`.

**Date parsing gotcha**: any stored `YYYY-MM-DD` key must go through `parseDateKey()`, never `new Date(dateStr)` — the latter parses as UTC and silently shifts a day in timezones behind UTC. `new Date()` (today) and cloning an existing `Date` are both fine as-is.

### Period/cadence system

A habit's goal is "`target` times every `periodValue` `periodUnit`(s)" (day/week/month/custom). This is the trickiest part of the codebase: everything reduces to one abstraction, a rolling N-day window ending on a given date (`periodDays`, `countInWindow`, `calcStreak`). Day/week/month/custom are NOT special-cased — they all go through the same math with `UNIT_DAYS = { day: 1, week: 7, month: 30 }`. `getPeriod()` also back-compats an older `{ timeframe: "day" | "week" }` shape.

**Streak semantics**: a streak counts consecutive *completed* periods, but the current in-progress period doesn't break it just because it isn't finished — `calcStreak` falls back to the *previous* window if the current one hasn't met target yet. This "still alive until proven broken" leniency is intentional.

Because the rolling window has no calendar anchor, two features layer a creation-date-anchored period grid on top purely for UI purposes (not used by `calcStreak` itself): `periodDaysLeft()`/`previousPeriodWindow()`, consumed by the at-risk flip and rest-day offer below.

### Rest days

Each habit gets 3 rest days per calendar month (`restDaysLeft`, `restDaysUsedThisMonth`), spendable to credit a missed period without it counting as a real completion. `calcStreak`/`longestStreak` add `restDaysInWindow(...)` on top of `countInWindow(...)`; `totalCompletions`/`completionRate` deliberately don't. `pickRestOfferHabit()` picks which habit (if any) shows the offer card in place of its normal card; declining is tracked only in the in-memory `dismissedRestOffers` set — no persisted field for it.

### Rendering

`render()` fully re-renders `#habit-list` from `habitsCache` on every mutation — clones `#habit-card-template` per habit, except the one habit `pickRestOfferHabit()` selects (if any), which clones `#habit-offer-card-template` instead. Also calls `updateHero()` (hero band stats) and `pickAtRiskHabit()` (flips at most one non-offer card to the ink "at risk" polarity via `.habit-card.at-risk`). Each card shows a 12-week map (`renderCardMap()`, reusing `buildHeatmap`/`heatmapLevel`) instead of a progress bar — `.map-cell.level-1..4` filled, `.rested` grey, `.today` ringed. The same `buildHeatmap`/`heatmapLevel` pair drives the larger heatmap in the history modal (`renderHeatmap()`). The complete-button is `disabled` once `goalMet`.

### Weekly review

`#weekly-review-view`, opened via `openWeeklyReview()`/`renderWeeklyReview()`, toggles in place of `#main-view` — a show/hide swap, not a route (no router). Recaps the most recently completed Monday–Sunday week (a display-only convention on top of the rolling-window math, not a change to it) and surfaces at most one "drifting" habit via `computeDrift()` (median completion gap vs. cadence). Accepting a drift suggestion and the edit-habit modal's submit both funnel through the shared `saveHabitEdits()`.

### Onboarding

First-time users (`getDisplayName()` empty) see `#welcome-modal` via `initName()`, not `#name-modal` directly — choose Google, email signup, or stay logged out (`onboardingNameTarget` tracks which follow-up the name prompt is for). The typed/chosen name is always `saveName()`d locally first, which matters because it has to survive a page reload if Supabase requires email confirmation before the account goes live. `onAuthStateChange` promotes that pending name (or the Google profile's `full_name`/`name`) onto `user_metadata.display_name` the first time `currentUser` has none — deliberately **outside** the `justSignedIn` check, since a real OAuth redirect reloads the whole page and resets `authBootstrapped`, making `justSignedIn` false even on a first sign-in.

### Theming

All colors are CSS custom properties on `:root` in `style.css`, overridden under both `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]` so the in-app toggle (`applyTheme`/`initTheme`) can override system preference. Use existing `var(--...)` tokens for new UI. Exception: the ink surfaces (hero band, at-risk card, rest-day offer card, weekly review's drifting tile) are hardcoded to literal hex (`#201515`, `#ff4f00`, etc.) — they're deliberately "always ink" regardless of the light/dark toggle, not a missed dark-mode case.

### Milestones

`markDone()` checks the new streak against `STREAK_MILESTONES = [7, 30, 100, 365]`, tracked per-habit in `milestonesHit` so each fires once — a `.milestone-toast` plus a `.habit-card.celebrate` pulse, no confetti and no emoji tier icons (the design system allows exactly one chromatic accent). First sign-in with existing local habits and an empty cloud account prompts (`confirm()`) to bulk-copy them in via `replaceCloudHabits()`.

## React rewrite (`web/`) — in progress

A social layer (friends, public/private accounts, an activity feed — inspired by Hevy) is being added on top of Daily Streak. That's a big enough UI/architecture jump that it comes with a full rewrite to **React + TypeScript + Vite**, living in `web/` alongside the three flat files above — the vanilla app stays live and untouched (still what's actually deployed) until the rewrite reaches full parity and a deliberate cutover happens. `web/` has its own `package.json`/npm deps/Vite build — the "no build tools" rule above applies only to the root three files, not to `web/`.

Both apps currently read/write the **same Supabase project** (`yyeexumwqboxfpbssoqj`). Any schema change made for the rewrite needs to stay backward-compatible with the vanilla app's `habitToRow`/`rowToHabit` until cutover — e.g. new columns must be nullable/defaulted so the vanilla app, which never reads/writes them, keeps working unmodified.

### Architecture summary

- `web/src/lib/habits.ts` — the vanilla app's streak/period/rest-day math ported near-verbatim (pure functions, framework-free), now with real unit tests in `habits.test.ts` (vitest) — the first test coverage this logic has ever had.
- `web/src/api/` — a `HabitsApi` interface with two implementations (`localHabitsApi.ts` for guest/localStorage, `supabaseHabitsApi.ts` for signed-in), selected by session state. Guest mode reuses the **same localStorage keys** as the vanilla app (`lib/storageKeys.ts`), so a guest's data carries over automatically once the new app replaces the old one at the same origin.
- `web/src/hooks/useHabits.ts` — the one hook owning all habit mutations (add/delete/undo/complete/archive/reorder/rest-days), following the same "mutate the cache optimistically, fire the persist call in the background, toast on failure" pattern as the vanilla app's `habitsCache`/`render()` loop, just via TanStack Query's cache instead of a module-level array. Supabase Realtime subscription invalidates/merges into that cache the same way the vanilla app's hand-rolled realtime merge did.
- State: TanStack Query for all server data (habits, profile), Zustand (`store/sessionStore.ts`) for exactly session + theme + the guest display name — deliberately not habit data, to avoid a dual-source-of-truth bug.
- Real React Router routes (`/`, `/review`, `/insights`, `/settings`, `/u/:username`, `/sign-in`, `/sign-up`) replace the vanilla app's in-page view-swap pattern (`#weekly-review-view` toggling in place of `#main-view`).
- `web/src/index.css` was copied byte-for-byte from `style.css` — components reuse the exact same class names in JSX, so the visual result is pixel-identical to the vanilla app. Any new UI (e.g. `Settings.tsx`, the first standalone non-modal form) needs its own explicit styling — the vanilla app's CSS only scopes inputs/buttons to `.modal` or specific component classes, nothing is styled by bare tag name.
- Onboarding is two sequential, App-level-gated modals (`OnboardingModal` for name, `ProfileSetupModal` for username/public-private), checked in `App.tsx`'s `OnboardingGates` regardless of which route a user lands on directly — real URLs mean users can land anywhere, not just `/`.

### Supabase gotcha found during the rewrite

A table created via `apply_migration` (raw SQL) does **not** automatically get the `anon`/`authenticated` role grants that Supabase's dashboard table editor sets up for you. RLS policies alone aren't sufficient — without an explicit `grant select, insert, update on <table> to authenticated;`, every request 403s before RLS is even evaluated. Hit this with the `profiles` table; check `information_schema.role_table_grants` if a new table's queries mysteriously 403 despite correct-looking RLS.

### Phase status

Per the social-overhaul plan (schema, RLS design, full rollout plan) that was worked out with the user:

- **Phase A — React/Vite rewrite, feature parity, no social features.** ✅ Done. Every vanilla-app feature ported and manually browser-tested.
- **Phase B — Profiles, usernames, public/private account setting.** ✅ Done. `profiles` table + RLS, mandatory username-claim gate, self-view-only `/u/:username`, Settings profile editing. No visibility into anyone else's data yet — that's intentional, not a gap.
- **Phase C — Follow / friend-request system.** ✅ Done. `follows` table (`follower_id`, `following_id`, `status: 'pending' | 'accepted'`, unique pair, no self-follow) with RLS restricted to the two parties of each row and only a `SELECT` grant to `authenticated` — all writes go through `request_follow`/`accept_follow`/`reject_follow`/`unfollow` SECURITY DEFINER RPCs (`request_follow` auto-accepts onto a public target, starts pending onto a private one). `web/src/hooks/useFollows.ts` wraps these with the same optimistic-cache-then-toast-on-failure pattern as `useHabits`. `/friends` route (requests inbox, following/followers lists, tabbed) and `FollowButton` (Follow / Requested / Following, click-to-unfollow-or-cancel) on other users' `/u/:username` profiles, which now fetch by username instead of self-only. Still no habit content visible anywhere — `habits_shared_read` RLS is not yet deployed, left for Phase D. Manually browser-tested end-to-end with two real Supabase accounts covering public auto-accept, private pending/accept/reject, unfollow, and re-request. Testing also surfaced and fixed a Phase B bug: `profiles.display_name` was only ever set at claim time and never kept in sync with later renames via Settings — `handleSaveName` now updates both.
- **Phase D — Per-habit sharing + activity feed + user search.** ✅ Done. `habits.shared` (boolean, default false — additive/nullable-safe for the vanilla app) plus a second permissive `habits_shared_read` RLS policy (OR'd with the existing owner-only one): visible when `shared = true` and the viewer has an accepted `follows` row onto the owner. `activity_events` (`user_id`, `habit_id`, `habit_name`, `milestone`, `occurred_at`) is written client-side in `useHabits.ts`'s `toggleCompletionOnDate` the same moment `STREAK_MILESTONES` detects a newly-crossed milestone — one implementation of "did a milestone happen," reused from the personal dashboard's own toast trigger, not recomputed for the feed. Its `activity_events_select` RLS policy is the load-bearing piece: visibility is `auth.uid() = user_id OR (EXISTS shared habit AND EXISTS accepted follow)`, both re-evaluated live on every query — no flag is ever cached on the event row, so un-sharing a habit or unfollowing someone immediately hides their past events too. `/feed` route (`useActivityFeed`) and shared-habit read-only cards (`SharedHabitCard`, via `useSharedHabits`) now render on other users' `/u/:username` pages. **User search**: username-prefix box on `/friends` (`searchProfilesByUsername`, reuses the existing `profiles_select_authenticated` policy — no new grants needed), each result showing `FollowButton` inline. Manually browser-tested end-to-end with two real Supabase accounts: backfilled a real 7-day streak through the actual UI (not synthetic SQL data) to confirm the milestone-detection code path fires for real, verified the event/habit appear on the follower's feed and profile, then flipped `shared` off and confirmed both disappeared immediately — the retroactive-hide guarantee holds.
- **Deploy migration** (any phase, not yet done): move off GitHub Pages to Vercel via the `web/vercel.json` SPA rewrite rule already in place — GitHub Pages has no native build step and fights React Router's client-side paths on direct load/refresh.
