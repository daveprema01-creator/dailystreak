const STORAGE_KEY = "daily-streak-habits";
const NAME_KEY = "daily-streak-username";
const THEME_KEY = "daily-streak-theme";
const LAST_PERFECT_DAY_KEY = "daily-streak-last-perfect-day";

const SUPABASE_URL = "https://yyeexumwqboxfpbssoqj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Xha7Zhl44-L9zmU_YjWZJg_6uHxwR5Y";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

// In-memory source of truth for the currently-rendered habits — populated from either
// localStorage (signed out) or Supabase (signed in) by refreshHabitsCache().
let habitsCache = [];
let currentUser = null;

const form = document.getElementById("add-habit-form");
const input = document.getElementById("habit-input");
const targetInput = document.getElementById("target-input");
const periodValueInput = document.getElementById("period-value-input");
const periodUnitInput = document.getElementById("period-unit-input");
const list = document.getElementById("habit-list");
const emptyState = document.getElementById("empty-state");
const cardTemplate = document.getElementById("habit-card-template");
const offerCardTemplate = document.getElementById("habit-offer-card-template");
const addHabitToggle = document.getElementById("add-habit-toggle");
const greeting = document.getElementById("greeting");
const archivedSection = document.getElementById("archived-section");
const archivedToggle = document.getElementById("archived-toggle");
const archivedCount = document.getElementById("archived-count");
const archivedList = document.getElementById("archived-list");
const archivedRowTemplate = document.getElementById("archived-row-template");

const heroLongestLabel = document.getElementById("hero-longest-label");
const heroLongestNumeral = document.getElementById("hero-longest-numeral");
const heroLongestUnit = document.getElementById("hero-longest-unit");
const heroStatDone = document.getElementById("hero-stat-done");
const heroStatRate = document.getElementById("hero-stat-rate");
const heroStatRest = document.getElementById("hero-stat-rest");
const heroStatPerfect = document.getElementById("hero-stat-perfect");

const mainView = document.getElementById("main-view");
const reviewBtn = document.getElementById("review-btn");
const weeklyReviewView = document.getElementById("weekly-review-view");
const reviewBackBtn = document.getElementById("review-back-btn");
const reviewPrevBtn = document.getElementById("review-prev-btn");
const reviewNextBtn = document.getElementById("review-next-btn");
const reviewEyebrow = document.getElementById("review-eyebrow");
const reviewHeadline = document.getElementById("review-headline");
const reviewLead = document.getElementById("review-lead");
const reviewTableBody = document.getElementById("review-table-body");
const reviewRowTemplate = document.getElementById("review-row-template");
const reviewTile1Value = document.getElementById("review-tile1-value");
const reviewTile1Label = document.getElementById("review-tile1-label");
const reviewTile2Value = document.getElementById("review-tile2-value");
const reviewTile2Label = document.getElementById("review-tile2-label");
const reviewDrift = document.getElementById("review-drift");
const reviewDriftHeadline = document.getElementById("review-drift-headline");
const reviewDriftBody = document.getElementById("review-drift-body");
const reviewDriftAccept = document.getElementById("review-drift-accept");
const reviewDriftKeep = document.getElementById("review-drift-keep");
const analyticsBtn = document.getElementById("analytics-btn");
const analyticsView = document.getElementById("analytics-view");
const analyticsBackBtn = document.getElementById("analytics-back-btn");
const analyticsEmpty = document.getElementById("analytics-empty");
const analyticsContent = document.getElementById("analytics-content");
const analyticsTrendChart = document.getElementById("analytics-trend-chart");
const analyticsRateBars = document.getElementById("analytics-rate-bars");
const analyticsStreakTable = document.getElementById("analytics-streak-table");
const reviewSetTargets = document.getElementById("review-set-targets");
const reviewDone = document.getElementById("review-done");
const welcomeModal = document.getElementById("welcome-modal");
const welcomeGoogleBtn = document.getElementById("welcome-google-btn");
const welcomeEmailBtn = document.getElementById("welcome-email-btn");
const welcomeSkipBtn = document.getElementById("welcome-skip-btn");
const nameModal = document.getElementById("name-modal");
const nameForm = document.getElementById("name-form");
const nameInput = document.getElementById("name-input");
const themeToggle = document.getElementById("theme-toggle");
const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const importFile = document.getElementById("import-file");
const toastStack = document.getElementById("toast-stack");

const editModal = document.getElementById("edit-habit-modal");
const editForm = document.getElementById("edit-habit-form");
const editNameInput = document.getElementById("edit-habit-input");
const editTargetInput = document.getElementById("edit-target-input");
const editPeriodValueInput = document.getElementById("edit-period-value-input");
const editPeriodUnitInput = document.getElementById("edit-period-unit-input");
const editRestAllowanceInput = document.getElementById("edit-rest-allowance-input");
const editCancelBtn = document.getElementById("edit-cancel-btn");

const historyModal = document.getElementById("history-modal");
const historyCloseBtn = document.getElementById("history-close-btn");
const historyHabitName = document.getElementById("history-habit-name");
const historyCurrentStreak = document.getElementById("history-current-streak");
const historyLongestStreak = document.getElementById("history-longest-streak");
const historyTotal = document.getElementById("history-total");
const historyRate = document.getElementById("history-rate");
const historyHeatmap = document.getElementById("history-heatmap");
const historyShareBtn = document.getElementById("history-share-btn");

const accountBtn = document.getElementById("account-btn");
const authModal = document.getElementById("auth-modal");
const authModalTitle = document.getElementById("auth-modal-title");
const authForm = document.getElementById("auth-form");
const authEmailInput = document.getElementById("auth-email-input");
const authPasswordInput = document.getElementById("auth-password-input");
const authError = document.getElementById("auth-error");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authToggleText = document.getElementById("auth-toggle-text");
const authToggleBtn = document.getElementById("auth-toggle-btn");
const authCancelBtn = document.getElementById("auth-cancel-btn");
const googleAuthBtn = document.getElementById("google-auth-btn");

// --- Storage ---
//
// habitsCache is the single in-memory array every render/stat function reads via
// loadHabits(). Two backends keep it filled: localStorage when signed out, Supabase
// when signed in. Mutations update habitsCache directly (so the UI re-renders instantly)
// and fire off a targeted persist call in the background — see "--- Sync ---" below.

let corruptDataWarned = false;

function loadHabits() {
  return habitsCache;
}

function loadLocalHabits() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    if (!corruptDataWarned) {
      corruptDataWarned = true;
      console.warn("Daily Streak: saved habit data was corrupted and has been reset.");
      warnCorruptData();
    }
    return [];
  }
}

function saveLocalHabits(habits) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

async function refreshHabitsCache() {
  if (currentUser) {
    const { data, error } = await supabaseClient
      .from("habits")
      .select("*")
      .order("position", { ascending: true });
    if (error) {
      showSyncError(`Couldn't load your habits — ${error.message}`);
      habitsCache = [];
      return;
    }
    habitsCache = data.map(rowToHabit);
  } else {
    habitsCache = loadLocalHabits();
  }
  await backfillMissingCreatedAt();
}

// Legacy habits created before `createdAt` existed get "today" as a fallback every load,
// which resets the creation-anchored period grid (periodDaysLeft/previousPeriodWindow)
// on every visit. Backfill once from the earliest completion (or today, if none) and
// persist so it stabilizes.
function backfillCreatedAt(habit) {
  if (habit.createdAt) return false;
  const sorted = [...habit.completions].sort();
  habit.createdAt = sorted.length > 0 ? sorted[0] : todayKey();
  return true;
}

async function backfillMissingCreatedAt() {
  const needsSave = habitsCache.filter((h) => backfillCreatedAt(h));
  if (needsSave.length === 0) return;
  if (currentUser) {
    await Promise.all(
      needsSave.map((h) =>
        supabaseClient.from("habits").update({ created_at: h.createdAt }).eq("id", h.id)
      )
    );
  } else {
    saveLocalHabits(habitsCache);
  }
}

function loadName() {
  return localStorage.getItem(NAME_KEY);
}

function saveName(name) {
  localStorage.setItem(NAME_KEY, name);
}

function getDisplayName() {
  if (currentUser) return currentUser.user_metadata?.display_name || currentUser.email;
  return loadName();
}

// Persists the display name to the signed-in account (so it follows across devices)
// and updates the in-memory currentUser immediately so getDisplayName() reflects it
// before the network round-trip finishes.
async function setDisplayName(name) {
  currentUser.user_metadata = { ...currentUser.user_metadata, display_name: name };
  const { error } = await supabaseClient.auth.updateUser({ data: { display_name: name } });
  if (error) showSyncError(`Couldn't save your name — ${error.message}`);
}

// --- Sync ---
// Maps between the app's camelCase habit shape and the `habits` table's snake_case
// columns. `position` is DB-only (an identity column used purely for ORDER BY on
// fetch) — the in-memory array's own order already reflects it, so it never round-trips
// into the JS habit object.

function habitToRow(habit, userId) {
  return {
    id: habit.id,
    user_id: userId,
    name: habit.name,
    target: habit.target,
    period_value: habit.periodValue,
    period_unit: habit.periodUnit,
    created_at: habit.createdAt,
    completions: habit.completions,
    milestones_hit: habit.milestonesHit,
    rest_days: habit.restDays,
    archived_at: habit.archivedAt || null,
    rest_day_allowance: habit.restDayAllowance || 3,
  };
}

function rowToHabit(row) {
  return {
    id: row.id,
    name: row.name,
    target: row.target,
    periodValue: row.period_value,
    periodUnit: row.period_unit,
    createdAt: row.created_at,
    completions: row.completions || [],
    milestonesHit: row.milestones_hit || [],
    restDays: row.rest_days || [],
    archivedAt: row.archived_at || null,
    restDayAllowance: row.rest_day_allowance || 3,
  };
}

// Persists a habit's completions/milestonesHit/restDays after markDone/undoLast/useRestDay —
// the only fields those actions ever change.
async function persistHabitFields(habit) {
  if (currentUser) {
    const { error } = await supabaseClient
      .from("habits")
      .update({
        completions: habit.completions,
        milestones_hit: habit.milestonesHit,
        rest_days: habit.restDays,
      })
      .eq("id", habit.id);
    if (error) showSyncError(`Couldn't sync "${habit.name}" — ${error.message}`);
  } else {
    saveLocalHabits(habitsCache);
  }
}

// Wholesale replace of a signed-in user's cloud habits — used by backup import and by
// the "import my local habits" prompt on first sign-in.
async function replaceCloudHabits(habits) {
  const { error: deleteError } = await supabaseClient
    .from("habits")
    .delete()
    .eq("user_id", currentUser.id);
  if (deleteError) {
    showSyncError(`Import failed — ${deleteError.message}`);
    return;
  }
  if (habits.length === 0) return;
  const { error: insertError } = await supabaseClient
    .from("habits")
    .insert(habits.map((h) => habitToRow(h, currentUser.id)));
  if (insertError) showSyncError(`Import failed — ${insertError.message}`);
}

// --- Date helpers ---

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return formatDate(new Date());
}

// Parses a "YYYY-MM-DD" key as a local date at midnight. `new Date("YYYY-MM-DD")` parses
// as UTC, which shifts a day off in any timezone behind UTC — always use this instead
// for dates coming out of completions/restDays/createdAt.
function parseDateKey(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// --- Period helpers ---
// A habit's cadence is "target times every periodValue periodUnit(s)".
// Internally everything reduces to a rolling window of periodDays ending on a given date.

const UNIT_DAYS = { day: 1, week: 7, month: 30 };

function getTarget(habit) {
  return habit.target || 1;
}

function getPeriod(habit) {
  if (habit.periodUnit) {
    return { value: habit.periodValue || 1, unit: habit.periodUnit };
  }
  // Back-compat with the older day/week-only data shape.
  return { value: 1, unit: habit.timeframe === "week" ? "week" : "day" };
}

function periodDays(period) {
  return period.value * UNIT_DAYS[period.unit];
}

function periodPhrase(period) {
  const unitWord = period.value === 1 ? period.unit : `${period.value} ${period.unit}s`;
  return unitWord;
}

// --- Stats ---

function countOnDate(completions, dateStr) {
  return completions.filter((d) => d === dateStr).length;
}

// Count completions in the `days`-day window ending on `endDate` (inclusive).
function countInWindow(completions, endDate, days) {
  const start = new Date(endDate);
  start.setDate(start.getDate() - (days - 1));
  const startStr = formatDate(start);
  const endStr = formatDate(endDate);
  return completions.filter((d) => d >= startStr && d <= endStr).length;
}

// Same window math as countInWindow, for a habit's restDays.
function restDaysInWindow(restDays, endDate, days) {
  const start = new Date(endDate);
  start.setDate(start.getDate() - (days - 1));
  const startStr = formatDate(start);
  const endStr = formatDate(endDate);
  return restDays.filter((d) => d >= startStr && d <= endStr).length;
}

function calcStreak(completions, target, days, restDays = []) {
  let streak = 0;
  const cursor = new Date();
  const windowMet = (endDate) =>
    countInWindow(completions, endDate, days) + restDaysInWindow(restDays, endDate, days) >= target;

  // If the current window's goal isn't met yet, the streak is still "alive" based on the prior window.
  if (!windowMet(cursor)) {
    cursor.setDate(cursor.getDate() - days);
  }

  while (windowMet(cursor)) {
    streak++;
    cursor.setDate(cursor.getDate() - days);
  }

  return streak;
}

// Longest-ever run of consecutive met periods, scanning all the way back to the first completion.
function longestStreak(habit) {
  const completions = habit.completions;
  if (completions.length === 0) return 0;

  const period = getPeriod(habit);
  const days = periodDays(period);
  const target = getTarget(habit);
  const restDays = habit.restDays || [];
  const firstDate = parseDateKey([...completions].sort()[0]);

  let longest = 0;
  let current = 0;
  const cursor = new Date();
  while (cursor >= firstDate) {
    if (countInWindow(completions, cursor, days) + restDaysInWindow(restDays, cursor, days) >= target) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
    cursor.setDate(cursor.getDate() - days);
  }
  return longest;
}

// --- Rest days ---
// A configurable number of rest days per calendar month, per habit (default 3), derived
// from restDays — no stored counter.

function currentYearMonth() {
  return todayKey().slice(0, 7);
}

function getRestDayAllowance(habit) {
  return habit.restDayAllowance || 3;
}

function restDaysUsedThisMonth(habit) {
  return (habit.restDays || []).filter((d) => d.startsWith(currentYearMonth())).length;
}

function restDaysLeft(habit) {
  return Math.max(0, getRestDayAllowance(habit) - restDaysUsedThisMonth(habit));
}

// The current period-in-progress, anchored to the habit's creation date (since the
// underlying streak math is a pure rolling window with no calendar anchor of its own).
// Returns how many days remain before this period chunk ends.
function periodDaysLeft(habit, days) {
  const created = habit.createdAt ? parseDateKey(habit.createdAt) : new Date();
  const today = new Date();
  const daysSinceCreation = Math.floor((today - created) / 86400000);
  const daysIntoPeriod = ((daysSinceCreation % days) + days) % days;
  return days - 1 - daysIntoPeriod;
}

// The most recently-completed period chunk before the current one, using the same
// creation-anchored period grid as periodDaysLeft.
function previousPeriodWindow(habit, days) {
  const daysLeft = periodDaysLeft(habit, days);
  const currentWindowEnd = new Date();
  currentWindowEnd.setDate(currentWindowEnd.getDate() + daysLeft);
  const previousWindowEnd = new Date(currentWindowEnd);
  previousWindowEnd.setDate(previousWindowEnd.getDate() - days);
  return previousWindowEnd;
}

function totalCompletions(habit) {
  return habit.completions.length;
}

// Percentage of elapsed periods (since the first completion) where the target was met.
function completionRate(habit) {
  const completions = habit.completions;
  if (completions.length === 0) return 0;

  const period = getPeriod(habit);
  const days = periodDays(period);
  const target = getTarget(habit);
  const firstDate = parseDateKey([...completions].sort()[0]);
  const spanDays = Math.floor((new Date() - firstDate) / 86400000) + 1;
  const totalPeriods = Math.max(1, Math.ceil(spanDays / days));

  let metPeriods = 0;
  const cursor = new Date();
  for (let i = 0; i < totalPeriods; i++) {
    if (countInWindow(completions, cursor, days) >= target) metPeriods++;
    cursor.setDate(cursor.getDate() - days);
  }
  return Math.round((metPeriods / totalPeriods) * 100);
}

// Rolling `weeks * 7`-day window ending today, grouped into weeks of 7 (oldest first).
function buildHeatmap(completions, weeks = 12) {
  const totalDays = weeks * 7;
  const days = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d);
    days.push({ date: dateStr, count: countOnDate(completions, dateStr) });
  }
  const weeksArr = [];
  for (let i = 0; i < days.length; i += 7) {
    weeksArr.push(days.slice(i, i + 7));
  }
  return weeksArr;
}

function heatmapLevel(count, fairShare) {
  if (count <= 0) return 0;
  const ratio = count / fairShare;
  if (ratio >= 2) return 4;
  if (ratio >= 1) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

// Renders the 12-week map used on the main-list habit card into `container` — a CSS
// grid of 9x9 cells, oldest first, with rest days grey and today ringed. Blank/filled
// past cells (not rested, not before the habit existed, not in the future) are clickable
// to backfill or undo a completion for that specific day.
function renderCardMap(container, habit) {
  container.innerHTML = "";
  const period = getPeriod(habit);
  const days = periodDays(period);
  const target = getTarget(habit);
  const fairShare = target / days;
  const restDays = habit.restDays || [];
  const weeksData = buildHeatmap(habit.completions, 12);
  const today = todayKey();

  weeksData.forEach((week) => {
    week.forEach(({ date, count }) => {
      const cell = document.createElement("span");
      const isRested = restDays.includes(date);
      const beforeCreation = habit.createdAt && date < habit.createdAt;
      cell.className = isRested ? "map-cell rested" : `map-cell level-${heatmapLevel(count, fairShare)}`;
      if (date === today) cell.classList.add("today");
      cell.title = isRested ? `${date}: rested` : `${date}: ${count} completion${count === 1 ? "" : "s"}`;

      if (!isRested && !beforeCreation) {
        cell.classList.add("clickable");
        cell.tabIndex = 0;
        cell.setAttribute("role", "button");
        cell.setAttribute(
          "aria-label",
          `${date}: ${count} completion${count === 1 ? "" : "s"}. ${count > 0 ? "Remove" : "Log"} a completion.`
        );
        const activate = () => toggleCompletionOnDate(habit.id, date);
        cell.addEventListener("click", activate);
        cell.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activate();
          }
        });
      }

      container.appendChild(cell);
    });
  });
}

// Suggested rule from the design handoff: a habit is "at risk" when its current window
// can still be met but is behind pace. At most one card flips per screen — the longest
// current streak wins ties.
function pickAtRiskHabit(habits) {
  let best = null;
  habits.forEach((habit) => {
    const period = getPeriod(habit);
    const days = periodDays(period);
    const target = getTarget(habit);
    const remaining = target - countInWindow(habit.completions, new Date(), days);
    const daysLeft = periodDaysLeft(habit, days);
    if (remaining > 0 && remaining >= daysLeft) {
      const streak = calcStreak(habit.completions, target, days, habit.restDays || []);
      if (!best || streak > best.streak) {
        best = { habit, remaining, daysLeft, streak };
      }
    }
  });
  return best;
}

function numberWord(n) {
  const words = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  return n < words.length ? words[n] : String(n);
}

function atRiskPillText(remaining, daysLeft) {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + daysLeft);
  const weekday = deadline.toLocaleDateString("en-US", { weekday: "long" });
  return `${numberWord(remaining)} more by ${weekday}`;
}

// A habit offers a rest day when its most recently-completed period chunk failed its
// target, the streak would otherwise break there, and an unspent rest day is available
// this month. Dismissing ("Let it reset") is tracked in memory only — the data model
// doesn't add a persisted field for it.
const dismissedRestOffers = new Set();

function restOfferPeriodKey(habit, days) {
  return formatDate(previousPeriodWindow(habit, days));
}

// Picks the most-deserving candidate (largest current streak — same tie-break rule as
// pickAtRiskHabit) rather than the first qualifying habit in array order, so which habit
// gets the offer doesn't depend on add-order. A deficit of more than one day can be
// repaired too, spending up to as many rest days as are both needed and available.
function pickRestOfferHabit(habits) {
  let best = null;
  for (const habit of habits) {
    const period = getPeriod(habit);
    const days = periodDays(period);
    const target = getTarget(habit);
    const restDays = habit.restDays || [];
    const prevWindowEnd = previousPeriodWindow(habit, days);
    // Skip periods that ended before the habit even existed — nothing to have missed.
    if (habit.createdAt && formatDate(prevWindowEnd) < habit.createdAt) continue;
    const prevCount = countInWindow(habit.completions, prevWindowEnd, days);
    const alreadyRested = restDaysInWindow(restDays, prevWindowEnd, days) > 0;
    const deficit = target - prevCount;
    const key = `${habit.id}:${restOfferPeriodKey(habit, days)}`;
    const available = restDaysLeft(habit);

    if (deficit >= 1 && !alreadyRested && available > 0 && !dismissedRestOffers.has(key)) {
      const windowStart = new Date(prevWindowEnd);
      windowStart.setDate(windowStart.getDate() - (days - 1));
      const need = Math.min(deficit, available);
      const blankDates = [];
      for (let d = new Date(prevWindowEnd); d >= windowStart; d.setDate(d.getDate() - 1)) {
        const dateStr = formatDate(d);
        if (countOnDate(habit.completions, dateStr) === 0) blankDates.unshift(dateStr);
        if (blankDates.length >= need) break;
      }
      if (blankDates.length > 0) {
        const streak = calcStreak(habit.completions, target, days, restDays);
        if (!best || streak > best.streak) {
          best = { habit, days, target, blankDates, windowStart, windowEnd: prevWindowEnd, key, streak };
        }
      }
    }
  }
  return best;
}

// Whether every habit's current period goal was actually met on the given date (no rest
// days folded in — this is about what really happened that day, not streak leniency).
function allHabitsMetOnDate(habits, date) {
  if (habits.length === 0) return false;
  return habits.every((habit) => {
    const period = getPeriod(habit);
    const days = periodDays(period);
    const target = getTarget(habit);
    const count =
      days === 1 ? countOnDate(habit.completions, formatDate(date)) : countInWindow(habit.completions, date, days);
    return count >= target;
  });
}

function allHabitsMetToday(habits) {
  return allHabitsMetOnDate(habits, new Date());
}

// Consecutive days ending today where every habit's goal was actually met — derived
// retroactively from existing completions (no extra storage), analogous to
// longestStreak()'s backward scan but per-day instead of per-period.
function currentPerfectDayStreak(habits) {
  if (habits.length === 0) return 0;
  const earliestCreated = habits.reduce((min, h) => {
    if (!h.createdAt) return min;
    return !min || h.createdAt < min ? h.createdAt : min;
  }, null);

  let streak = 0;
  const cursor = new Date();
  while (!earliestCreated || formatDate(cursor) >= earliestCreated) {
    if (!allHabitsMetOnDate(habits, cursor)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Completion rate across all habits within the trailing 12-week (84-day) window, used
// for the hero band's "last 12 weeks" stat.
function last12WeeksRate(habits) {
  if (habits.length === 0) return 0;
  const windowDays = 84;
  const end = new Date();
  let totalPeriods = 0;
  let metPeriods = 0;
  habits.forEach((habit) => {
    const period = getPeriod(habit);
    const days = periodDays(period);
    const target = getTarget(habit);
    const restDays = habit.restDays || [];
    const periods = Math.max(1, Math.floor(windowDays / days));
    const cursor = new Date(end);
    for (let i = 0; i < periods; i++) {
      totalPeriods++;
      if (countInWindow(habit.completions, cursor, days) + restDaysInWindow(restDays, cursor, days) >= target) {
        metPeriods++;
      }
      cursor.setDate(cursor.getDate() - days);
    }
  });
  return totalPeriods === 0 ? 0 : Math.round((metPeriods / totalPeriods) * 100);
}

function updateHero(habits) {
  if (habits.length === 0) {
    heroLongestLabel.textContent = "Longest run";
    heroLongestNumeral.textContent = "0";
    heroLongestUnit.textContent = "days unbroken";
    heroStatDone.textContent = "0/0";
    heroStatRate.textContent = "0%";
    heroStatRest.textContent = "0";
    heroStatPerfect.textContent = "0";
    return;
  }

  let longestHabit = habits[0];
  let longestValue = -1;
  habits.forEach((habit) => {
    const value = longestStreak(habit);
    if (value > longestValue) {
      longestValue = value;
      longestHabit = habit;
    }
  });
  const longestPeriod = getPeriod(longestHabit);
  const unitWord = longestPeriod.unit === "day" ? "days" : longestPeriod.unit === "week" ? "weeks" : "months";

  heroLongestLabel.textContent = `Longest run · ${longestHabit.name}`;
  heroLongestNumeral.textContent = longestValue;
  heroLongestUnit.textContent = `${unitWord} unbroken`;

  const doneToday = habits.filter((habit) => {
    const period = getPeriod(habit);
    const days = periodDays(period);
    const target = getTarget(habit);
    const count =
      days === 1
        ? countOnDate(habit.completions, todayKey())
        : countInWindow(habit.completions, new Date(), days);
    return count >= target;
  }).length;
  heroStatDone.textContent = `${doneToday}/${habits.length}`;
  heroStatRate.textContent = `${last12WeeksRate(habits)}%`;
  // Total rest days left across all habits — each carries its own independent monthly
  // budget, so a single habit's figure would read as global but wouldn't be one.
  heroStatRest.textContent = habits.reduce((sum, h) => sum + restDaysLeft(h), 0);
  heroStatPerfect.textContent = currentPerfectDayStreak(habits);
}

// --- Greeting ---

function getTimeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function renderGreeting() {
  const name = getDisplayName();
  if (!name) {
    greeting.classList.remove("visible");
    return;
  }
  greeting.textContent = `${getTimeOfDayGreeting()}, ${name}!`;
  greeting.classList.add("visible");
}

// "local" while asking for a name to stay signed out, "account" while asking for a name
// ahead of an email/password sign-up. Read by the nameForm submit handler below.
let onboardingNameTarget = null;

function initName() {
  if (getDisplayName()) return;
  if (currentUser) {
    // Signed in (e.g. a Google account with no derivable name) but no display name yet —
    // skip the create-account/stay-logged-out choice, just ask for a name directly.
    onboardingNameTarget = null;
    nameModal.classList.add("visible");
    nameInput.focus();
    return;
  }
  welcomeModal.classList.add("visible");
}

welcomeGoogleBtn.addEventListener("click", () => {
  welcomeModal.classList.remove("visible");
  supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.href },
  });
});

welcomeEmailBtn.addEventListener("click", () => {
  welcomeModal.classList.remove("visible");
  onboardingNameTarget = "account";
  nameModal.classList.add("visible");
  nameInput.focus();
});

welcomeSkipBtn.addEventListener("click", () => {
  welcomeModal.classList.remove("visible");
  onboardingNameTarget = "local";
  nameModal.classList.add("visible");
  nameInput.focus();
});

// --- Theme ---
// Simple line-icon SVGs instead of emoji, in line with the design system's no-emoji
// treatment elsewhere (milestone toasts, etc.). currentColor picks up the button's own
// color, which stays white regardless of theme since the hero band is always-ink.

const MOON_ICON =
  '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8.5 1.5a6.5 6.5 0 1 0 6 9.02A5.5 5.5 0 0 1 8.5 1.5z"/></svg>';
const SUN_ICON =
  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="3.2"/><path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1M12.6 12.6l-1.1-1.1M4.5 4.5l-1.1-1.1"/></svg>';

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.innerHTML = theme === "dark" ? SUN_ICON : MOON_ICON;
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
}

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

// --- Rendering ---

const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function renderOfferCard(offer) {
  const { habit, days, target, blankDates, windowStart, windowEnd } = offer;
  const node = offerCardTemplate.content.cloneNode(true);
  const card = node.querySelector(".habit-card");
  card.dataset.id = habit.id;

  node.querySelector(".offer-habit-name").textContent = habit.name;
  // The streak at stake — what spending the rest day(s) would preserve, not the already-broken value.
  const previewRestDays = [...(habit.restDays || []), ...blankDates];
  const streak = calcStreak(habit.completions, target, days, previewRestDays);
  node.querySelector(".offer-streak-numeral").textContent = streak;
  node.querySelector(".offer-streak-label").textContent = streak === 1 ? "day" : "days";

  const blankText =
    blankDates.length === 1
      ? `${parseDateKey(blankDates[0]).toLocaleDateString("en-US", { weekday: "long" })} is blank`
      : `${blankDates.length} days blank`;
  node.querySelector(".offer-meta").textContent =
    `${target}× every ${periodPhrase(getPeriod(habit))} · ${blankText}`;

  const rail = node.querySelector(".offer-week-rail");
  for (let d = new Date(windowStart); d <= windowEnd; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    const col = document.createElement("div");
    col.className = "offer-week-day";
    const block = document.createElement("div");
    const isDone = countOnDate(habit.completions, dateStr) > 0;
    block.className = "offer-week-block" + (isDone ? " done" : "") + (blankDates.includes(dateStr) ? " repairable" : "");
    const label = document.createElement("div");
    label.className = "offer-week-label";
    label.textContent = WEEKDAY_ABBR[d.getDay()];
    col.appendChild(block);
    col.appendChild(label);
    rail.appendChild(col);
  }

  const useBtn = node.querySelector(".offer-use-btn");
  useBtn.textContent = blankDates.length === 1 ? "Use a rest day" : `Use ${blankDates.length} rest days`;
  useBtn.addEventListener("click", () => useRestDay(habit.id, offer));
  node.querySelector(".offer-reset-btn").addEventListener("click", () => {
    dismissedRestOffers.add(offer.key);
    render();
  });

  return node;
}

function render() {
  const allHabits = loadHabits();
  const habits = allHabits.filter((h) => !h.archivedAt);
  const archived = allHabits.filter((h) => h.archivedAt);
  list.innerHTML = "";

  emptyState.style.display = habits.length === 0 && archived.length === 0 ? "block" : "none";

  updateHero(habits);

  const restOffer = pickRestOfferHabit(habits);
  const atRiskCandidates = restOffer ? habits.filter((h) => h.id !== restOffer.habit.id) : habits;
  const atRisk = pickAtRiskHabit(atRiskCandidates);

  // Pin the offer/at-risk card to the front so the most actionable card isn't buried
  // below the fold — everything else keeps habitsCache's own order (drag-reorder controls
  // that; see reorderHabitsFromDOM).
  const ordered = [];
  if (restOffer) ordered.push(restOffer.habit);
  if (atRisk && (!restOffer || atRisk.habit.id !== restOffer.habit.id)) ordered.push(atRisk.habit);
  habits.forEach((h) => {
    if (!ordered.some((oh) => oh.id === h.id)) ordered.push(h);
  });

  ordered.forEach((habit) => {
    if (restOffer && restOffer.habit.id === habit.id) {
      list.appendChild(renderOfferCard(restOffer));
      return;
    }

    const node = cardTemplate.content.cloneNode(true);
    const card = node.querySelector(".habit-card");
    card.dataset.id = habit.id;
    card.draggable = true;
    card.addEventListener("dragstart", () => card.classList.add("dragging"));
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      reorderHabitsFromDOM();
    });

    const isAtRisk = atRisk && atRisk.habit.id === habit.id;
    card.classList.toggle("at-risk", !!isAtRisk);

    const nameBtn = node.querySelector(".habit-name");
    nameBtn.textContent = habit.name;
    nameBtn.addEventListener("click", () => openHistoryModal(habit.id));

    const target = getTarget(habit);
    const period = getPeriod(habit);
    const days = periodDays(period);
    const isDaily = days === 1;

    const periodCount = isDaily
      ? countOnDate(habit.completions, todayKey())
      : countInWindow(habit.completions, new Date(), days);
    const streak = calcStreak(habit.completions, target, days, habit.restDays || []);
    const goalMet = periodCount >= target;

    node.querySelector(".habit-streak-numeral").textContent = streak;
    node.querySelector(".habit-meta").textContent = isDaily
      ? `${target}× every ${periodPhrase(period)} · ${periodCount} of ${target} today`
      : `${target}× every ${periodPhrase(period)} · ${periodCount} of ${target} in the last ${periodPhrase(period)}`;

    renderCardMap(node.querySelector(".habit-map"), habit);

    const pill = node.querySelector(".habit-pill");
    if (isAtRisk) {
      pill.hidden = false;
      pill.classList.add("on-ink");
      pill.textContent = atRiskPillText(atRisk.remaining, atRisk.daysLeft);
    } else {
      // Show the rested acknowledgment as long as the most recently completed period
      // (the one a rest day would have applied to) contains one.
      const prevWindowEnd = previousPeriodWindow(habit, days);
      const prevWindowStart = new Date(prevWindowEnd);
      prevWindowStart.setDate(prevWindowStart.getDate() - (days - 1));
      const prevStartStr = formatDate(prevWindowStart);
      const prevEndStr = formatDate(prevWindowEnd);
      const restedDate = (habit.restDays || [])
        .filter((d) => d >= prevStartStr && d <= prevEndStr)
        .sort()
        .pop();
      if (restedDate) {
        pill.hidden = false;
        const weekday = parseDateKey(restedDate).toLocaleDateString("en-US", { weekday: "long" });
        pill.textContent = `${weekday} rested`;
      } else {
        pill.hidden = true;
      }
    }

    const completeBtn = node.querySelector(".complete-btn");
    if (target === 1 && isDaily) {
      completeBtn.textContent = goalMet ? "Done for today ✓" : "Mark today done";
    } else {
      completeBtn.textContent = goalMet ? "Mark done ✓" : "Mark done";
    }
    completeBtn.classList.toggle("done", goalMet);
    completeBtn.disabled = goalMet;
    completeBtn.addEventListener("click", () => {
      markDone(habit.id);
      celebrate(habit.id);
    });

    const undoBtn = node.querySelector(".undo-btn");
    undoBtn.classList.toggle("visible", periodCount > 0);
    undoBtn.addEventListener("click", () => undoLast(habit.id));

    node.querySelector(".edit-btn").addEventListener("click", () => openEditModal(habit.id));
    node.querySelector(".archive-btn").addEventListener("click", () => archiveHabit(habit.id));
    node.querySelector(".delete-btn").addEventListener("click", () => deleteHabit(habit.id));

    list.appendChild(node);
  });

  renderArchivedSection(archived);
}

// --- Drag-to-reorder ---
// Native HTML5 drag-and-drop. dragover live-reinserts the dragged card as the pointer
// moves; dragend reads the final DOM order back into habitsCache and persists it.

function getDragAfterElement(container, y) {
  const cards = [...container.querySelectorAll(".habit-card:not(.dragging)")];
  return cards.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    },
    { offset: -Infinity, element: null }
  ).element;
}

list.addEventListener("dragover", (e) => {
  e.preventDefault();
  const dragging = list.querySelector(".dragging");
  if (!dragging) return;
  const afterElement = getDragAfterElement(list, e.clientY);
  if (afterElement == null) list.appendChild(dragging);
  else list.insertBefore(dragging, afterElement);
});

async function reorderHabitsFromDOM() {
  const ids = [...list.querySelectorAll(".habit-card")].map((c) => c.dataset.id);
  const reordered = ids.map((id) => habitsCache.find((h) => h.id === id)).filter(Boolean);
  const missing = habitsCache.filter((h) => !ids.includes(h.id));
  const newOrder = [...reordered, ...missing];
  const changed = newOrder.some((h, i) => h.id !== habitsCache[i]?.id);
  habitsCache = newOrder;
  if (!changed) return;
  render();
  await persistPositions();
}

// --- Archive ---

async function archiveHabit(id) {
  const habit = habitsCache.find((h) => h.id === id);
  if (!habit) return;
  habit.archivedAt = new Date().toISOString();
  render();

  if (currentUser) {
    const { error } = await supabaseClient
      .from("habits")
      .update({ archived_at: habit.archivedAt })
      .eq("id", id);
    if (error) showSyncError(`Couldn't archive "${habit.name}" — ${error.message}`);
  } else {
    saveLocalHabits(habitsCache);
  }
}

async function unarchiveHabit(id) {
  const habit = habitsCache.find((h) => h.id === id);
  if (!habit) return;
  habit.archivedAt = null;
  render();

  if (currentUser) {
    const { error } = await supabaseClient.from("habits").update({ archived_at: null }).eq("id", id);
    if (error) showSyncError(`Couldn't unarchive "${habit.name}" — ${error.message}`);
  } else {
    saveLocalHabits(habitsCache);
  }
}

function renderArchivedSection(archived) {
  archivedSection.hidden = archived.length === 0;
  archivedCount.textContent = archived.length;
  archivedList.innerHTML = "";

  archived.forEach((habit) => {
    const node = archivedRowTemplate.content.cloneNode(true);
    node.querySelector(".archived-row-name").textContent = habit.name;
    node
      .querySelector(".archived-unarchive-btn")
      .addEventListener("click", () => unarchiveHabit(habit.id));
    node.querySelector(".archived-delete-btn").addEventListener("click", () => deleteHabit(habit.id));
    archivedList.appendChild(node);
  });
}

archivedToggle.addEventListener("click", () => {
  const expanded = archivedToggle.getAttribute("aria-expanded") === "true";
  archivedToggle.setAttribute("aria-expanded", String(!expanded));
  archivedList.hidden = expanded;
});

// --- Actions ---

async function addHabit(name, target, periodValue, periodUnit) {
  const habit = {
    id: crypto.randomUUID(),
    name,
    target,
    periodValue,
    periodUnit,
    createdAt: todayKey(),
    completions: [],
    milestonesHit: [],
    restDays: [],
    archivedAt: null,
    restDayAllowance: 3,
  };
  habitsCache.push(habit);
  render();

  if (currentUser) {
    const { error } = await supabaseClient.from("habits").insert(habitToRow(habit, currentUser.id));
    if (error) showSyncError(`Couldn't save "${name}" — ${error.message}`);
  } else {
    saveLocalHabits(habitsCache);
  }
}

// id -> { habit, index, timeoutId, toastEl }
const pendingDeletes = new Map();

async function deleteHabit(id) {
  const index = habitsCache.findIndex((h) => h.id === id);
  if (index === -1) return;
  const [habit] = habitsCache.splice(index, 1);
  render();
  showUndoToast(habit, index);

  if (currentUser) {
    const { error } = await supabaseClient.from("habits").delete().eq("id", id);
    if (error) showSyncError(`Couldn't delete "${habit.name}" — ${error.message}`);
  } else {
    saveLocalHabits(habitsCache);
  }
}

function showUndoToast(habit, index) {
  const toast = document.createElement("div");
  toast.className = "undo-toast";

  const label = document.createElement("span");
  label.textContent = `Deleted "${habit.name}"`;

  const undoBtn = document.createElement("button");
  undoBtn.type = "button";
  undoBtn.textContent = "Undo";
  undoBtn.addEventListener("click", () => restoreHabit(habit.id));

  const progress = document.createElement("div");
  progress.className = "undo-toast-progress";

  toast.appendChild(label);
  toast.appendChild(undoBtn);
  toast.appendChild(progress);
  toastStack.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add("visible");
    requestAnimationFrame(() => progress.classList.add("counting"));
  });

  const timeoutId = setTimeout(() => dismissUndoToast(habit.id), 5000);
  pendingDeletes.set(habit.id, { habit, index, timeoutId, toastEl: toast });
}

async function restoreHabit(id) {
  const pending = pendingDeletes.get(id);
  if (!pending) return;
  clearTimeout(pending.timeoutId);
  pendingDeletes.delete(id);
  removeToast(pending.toastEl);

  const insertAt = Math.min(pending.index, habitsCache.length);
  habitsCache.splice(insertAt, 0, pending.habit);
  render();

  if (currentUser) {
    const { error } = await supabaseClient.from("habits").insert(habitToRow(pending.habit, currentUser.id));
    if (error) {
      showSyncError(`Couldn't restore "${pending.habit.name}" — ${error.message}`);
      return;
    }
    // `position` is a DB identity column, so the insert above always appends the row at
    // the end regardless — realign every row's position to match the splice-back-into-place
    // order above.
    await persistPositions();
  } else {
    saveLocalHabits(habitsCache);
  }
}

// Shared by drag-reorder and restoreHabit: writes habitsCache's current array order back
// as each row's `position` (a DB-only identity column the app never reads).
async function persistPositions() {
  if (!currentUser) {
    saveLocalHabits(habitsCache);
    return;
  }
  const results = await Promise.all(
    habitsCache.map((h, i) => supabaseClient.from("habits").update({ position: i }).eq("id", h.id))
  );
  const failed = results.find((r) => r.error);
  if (failed) showSyncError(`Couldn't save the new order — ${failed.error.message}`);
}

function dismissUndoToast(id) {
  const pending = pendingDeletes.get(id);
  if (!pending) return;
  pendingDeletes.delete(id);
  removeToast(pending.toastEl);
}

function removeToast(toastEl) {
  toastEl.classList.remove("visible");
  setTimeout(() => toastEl.remove(), 250);
}

function showToast(message, duration = 5000) {
  const toast = document.createElement("div");
  toast.className = "undo-toast";
  const label = document.createElement("span");
  label.textContent = message;
  toast.appendChild(label);
  toastStack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => removeToast(toast), duration);
}

function warnCorruptData() {
  showToast("Your saved habits couldn't be read and were reset.", 6000);
}

function showSyncError(message) {
  showToast(message, 5000);
}

const STREAK_MILESTONES = [7, 30, 100, 365];

async function markDone(id) {
  const habits = loadHabits();
  const habit = habits.find((h) => h.id === id);
  if (!habit) return;

  habit.completions.push(todayKey());
  if (!habit.milestonesHit) habit.milestonesHit = [];

  const days = periodDays(getPeriod(habit));
  const newStreak = calcStreak(habit.completions, getTarget(habit), days, habit.restDays || []);

  let hitMilestone = null;
  for (const m of STREAK_MILESTONES) {
    if (newStreak >= m && !habit.milestonesHit.includes(m)) {
      habit.milestonesHit.push(m);
      hitMilestone = m;
    }
  }

  render();
  if (hitMilestone) celebrateMilestone(habit.name, hitMilestone);

  if (allHabitsMetToday(habits) && localStorage.getItem(LAST_PERFECT_DAY_KEY) !== todayKey()) {
    localStorage.setItem(LAST_PERFECT_DAY_KEY, todayKey());
    celebratePerfectDay(habits.length);
  }

  await persistHabitFields(habit);
}

async function undoLast(id) {
  const habits = loadHabits();
  const habit = habits.find((h) => h.id === id);
  if (!habit) return;

  const days = periodDays(getPeriod(habit));
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - (days - 1));
  const startStr = formatDate(windowStart);
  const endStr = todayKey();

  for (let i = habit.completions.length - 1; i >= 0; i--) {
    const d = habit.completions[i];
    if (d >= startStr && d <= endStr) {
      habit.completions.splice(i, 1);
      break;
    }
  }

  render();
  await persistHabitFields(habit);
}

// Spends one or more of the habit's monthly rest days to fill the blank day(s) identified
// by pickRestOfferHabit, keeping the streak alive without counting as a real completion.
async function useRestDay(id, offer) {
  const habit = habitsCache.find((h) => h.id === id);
  if (!habit) return;

  if (!habit.restDays) habit.restDays = [];
  habit.restDays.push(...offer.blankDates);
  dismissedRestOffers.add(offer.key);

  render();
  await persistHabitFields(habit);
}

// Click-to-backfill: toggles a single completion on a past (or today's) day directly from
// the card map — adds one if the day is blank, removes one if it already has any. Lets
// users log a missed day without waiting for "today" to roll around.
async function toggleCompletionOnDate(id, dateStr) {
  const habit = habitsCache.find((h) => h.id === id);
  if (!habit) return;
  if ((habit.restDays || []).includes(dateStr)) return;
  if (habit.createdAt && dateStr < habit.createdAt) return;
  if (dateStr > todayKey()) return;

  const count = countOnDate(habit.completions, dateStr);
  if (count > 0) {
    const idx = habit.completions.indexOf(dateStr);
    if (idx !== -1) habit.completions.splice(idx, 1);
  } else {
    habit.completions.push(dateStr);
    if (!habit.milestonesHit) habit.milestonesHit = [];
    const days = periodDays(getPeriod(habit));
    const newStreak = calcStreak(habit.completions, getTarget(habit), days, habit.restDays || []);
    for (const m of STREAK_MILESTONES) {
      if (newStreak >= m && !habit.milestonesHit.includes(m)) {
        habit.milestonesHit.push(m);
        celebrateMilestone(habit.name, m);
      }
    }
  }

  render();
  await persistHabitFields(habit);
}

// --- Edit habit ---

let editingId = null;

function openEditModal(id) {
  const habit = loadHabits().find((h) => h.id === id);
  if (!habit) return;

  const period = getPeriod(habit);
  editingId = id;
  editNameInput.value = habit.name;
  editTargetInput.value = getTarget(habit);
  editPeriodValueInput.value = period.value;
  editPeriodUnitInput.value = period.unit;
  editRestAllowanceInput.value = getRestDayAllowance(habit);
  editModal.classList.add("visible");
  editNameInput.focus();
}

function closeEditModal() {
  editModal.classList.remove("visible");
  editingId = null;
}

// Shared by the edit-habit modal and the weekly review's drifting-cadence accept action.
// restDayAllowance is optional — the drift-accept path only changes cadence and leaves it
// untouched.
async function saveHabitEdits(habit, { name, target, periodValue, periodUnit, restDayAllowance }) {
  habit.name = name;
  habit.target = target;
  habit.periodValue = periodValue;
  habit.periodUnit = periodUnit;
  if (restDayAllowance !== undefined) habit.restDayAllowance = restDayAllowance;
  render();

  const update = { name, target, period_value: periodValue, period_unit: periodUnit };
  if (restDayAllowance !== undefined) update.rest_day_allowance = restDayAllowance;

  if (currentUser) {
    const { error } = await supabaseClient.from("habits").update(update).eq("id", habit.id);
    if (error) showSyncError(`Couldn't save changes to "${name}" — ${error.message}`);
  } else {
    saveLocalHabits(habitsCache);
  }
}

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editingId) return;

  const name = editNameInput.value.trim();
  if (!name) return;
  const target = Math.max(1, parseInt(editTargetInput.value, 10) || 1);
  const periodValue = Math.max(1, parseInt(editPeriodValueInput.value, 10) || 1);
  const periodUnit = ["day", "week", "month"].includes(editPeriodUnitInput.value)
    ? editPeriodUnitInput.value
    : "day";
  const restDayAllowance = Math.max(0, parseInt(editRestAllowanceInput.value, 10) || 0);

  const habit = habitsCache.find((h) => h.id === editingId);
  closeEditModal();
  if (!habit) return;

  await saveHabitEdits(habit, { name, target, periodValue, periodUnit, restDayAllowance });
});

editCancelBtn.addEventListener("click", closeEditModal);
editModal.addEventListener("click", (e) => {
  if (e.target === editModal) closeEditModal();
});

// --- Habit history ---

let currentHistoryHabitId = null;

function openHistoryModal(id) {
  const habit = loadHabits().find((h) => h.id === id);
  if (!habit) return;

  const period = getPeriod(habit);
  const days = periodDays(period);
  const target = getTarget(habit);

  currentHistoryHabitId = id;
  historyHabitName.textContent = habit.name;
  historyCurrentStreak.textContent = calcStreak(habit.completions, target, days, habit.restDays || []);
  historyLongestStreak.textContent = longestStreak(habit);
  historyTotal.textContent = totalCompletions(habit);
  historyRate.textContent = `${completionRate(habit)}%`;

  renderHeatmap(habit);
  historyModal.classList.add("visible");
}

function closeHistoryModal() {
  historyModal.classList.remove("visible");
}

// Rasterizes a habit's 12-week map + streak numeral to a downloadable PNG for sharing.
// Mirrors the "always ink" at-risk card treatment (solid accent for any filled level,
// no per-level shading) since it's the same kind of standalone dark surface.
async function shareHabitImage(id) {
  const habit = habitsCache.find((h) => h.id === id);
  if (!habit) return;
  if (document.fonts?.ready) await document.fonts.ready;

  const period = getPeriod(habit);
  const days = periodDays(period);
  const target = getTarget(habit);
  const fairShare = target / days;
  const restDays = habit.restDays || [];
  const streak = calcStreak(habit.completions, target, days, restDays);
  const weeksData = buildHeatmap(habit.completions, 12);

  const W = 600;
  const H = 340;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  ctx.fillStyle = "#201515";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#fffefb";
  ctx.font = "600 26px Inter, sans-serif";
  ctx.fillText(habit.name, 32, 52);

  ctx.fillStyle = "#ff4f00";
  ctx.font = "500 56px Inter, sans-serif";
  const streakText = String(streak);
  ctx.fillText(streakText, 32, 118);
  const streakWidth = ctx.measureText(streakText).width;

  ctx.fillStyle = "#939084";
  ctx.font = "400 16px Inter, sans-serif";
  ctx.fillText(streak === 1 ? "day streak" : "days unbroken", 32 + streakWidth + 12, 118);
  ctx.font = "400 14px Inter, sans-serif";
  ctx.fillText(`${target}× every ${periodPhrase(period)}`, 32, 144);

  const cellSize = 12;
  const gap = 3;
  const startX = 32;
  const startY = 170;
  weeksData.forEach((week, wi) => {
    week.forEach(({ date, count }, di) => {
      const isRested = restDays.includes(date);
      const level = heatmapLevel(count, fairShare);
      let color = "rgba(255,255,255,0.1)";
      if (isRested) color = "#939084";
      else if (level > 0) color = "#ff6a24";
      ctx.fillStyle = color;
      const x = startX + wi * (cellSize + gap);
      const y = startY + di * (cellSize + gap);
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, cellSize, cellSize, 2);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    });
  });

  ctx.fillStyle = "#939084";
  ctx.font = "500 13px Inter, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("Daily Streak", W - 32, H - 24);
  ctx.textAlign = "left";

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = habit.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    a.download = `${slug || "habit"}-streak.png`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function renderHeatmap(habit) {
  historyHeatmap.innerHTML = "";
  const period = getPeriod(habit);
  const days = periodDays(period);
  const target = getTarget(habit);
  const fairShare = target / days;
  const weeksData = buildHeatmap(habit.completions, 12);

  weeksData.forEach((week) => {
    week.forEach(({ date, count }) => {
      const cell = document.createElement("div");
      const beforeCreation = habit.createdAt && date < habit.createdAt;
      cell.className = beforeCreation
        ? "heatmap-cell before-creation"
        : `heatmap-cell level-${heatmapLevel(count, fairShare)}`;
      cell.title = `${date}: ${count} completion${count === 1 ? "" : "s"}`;
      historyHeatmap.appendChild(cell);
    });
  });
}

historyShareBtn.addEventListener("click", () => {
  if (currentHistoryHabitId) shareHabitImage(currentHistoryHabitId);
});

historyCloseBtn.addEventListener("click", closeHistoryModal);
historyModal.addEventListener("click", (e) => {
  if (e.target === historyModal) closeHistoryModal();
});

// --- Celebration animation ---

function celebrate(id) {
  const card = list.querySelector(`.habit-card[data-id="${id}"]`);
  if (!card) return;

  card.classList.add("celebrate");
  card.addEventListener("animationend", () => card.classList.remove("celebrate"), { once: true });
}

// Both milestone and perfect-day toasts route through the shared toastStack (same queue
// undo/error toasts use) so two firing on the same markDone() call stack instead of
// rendering on top of each other.
function showMilestoneToast(message, duration) {
  const toast = document.createElement("div");
  toast.className = "milestone-toast";
  toast.textContent = message;
  toastStack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => removeToast(toast), duration);
}

function celebrateMilestone(habitName, days) {
  showMilestoneToast(`${days}-day streak on "${habitName}"!`, 2600);
}

function celebratePerfectDay(habitCount) {
  showMilestoneToast(`Perfect day! All ${habitCount} habit${habitCount === 1 ? "" : "s"} complete`, 3200);
}

// --- Backup & restore ---

function exportData() {
  const payload = {
    app: "daily-streak",
    exportedAt: new Date().toISOString(),
    name: getDisplayName(),
    habits: loadHabits(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `daily-streak-backup-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Coerces one imported habit into a valid shape, dropping/defaulting anything malformed
// instead of trusting the file wholesale — a hand-edited or corrupted backup shouldn't be
// able to crash render()/countInWindow or get pushed straight to Supabase. Returns null
// for anything unsalvageable (no usable name).
function sanitizeImportedHabit(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.name !== "string" || !raw.name.trim()) return null;

  const isDateArray = (v) =>
    Array.isArray(v) && v.every((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));
  const isDateStr = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
    name: raw.name.trim().slice(0, 60),
    target: Number.isInteger(raw.target) && raw.target > 0 ? raw.target : 1,
    periodValue: Number.isInteger(raw.periodValue) && raw.periodValue > 0 ? raw.periodValue : 1,
    periodUnit: ["day", "week", "month"].includes(raw.periodUnit) ? raw.periodUnit : "day",
    createdAt: isDateStr(raw.createdAt) ? raw.createdAt : null,
    completions: isDateArray(raw.completions) ? raw.completions : [],
    milestonesHit: Array.isArray(raw.milestonesHit) ? raw.milestonesHit.filter((n) => typeof n === "number") : [],
    restDays: isDateArray(raw.restDays) ? raw.restDays : [],
    archivedAt: isDateStr(raw.archivedAt) || typeof raw.archivedAt === "string" ? raw.archivedAt : null,
    restDayAllowance: Number.isInteger(raw.restDayAllowance) && raw.restDayAllowance >= 0 ? raw.restDayAllowance : 3,
  };
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.habits)) throw new Error("Invalid backup file");

      const sanitized = data.habits.map(sanitizeImportedHabit).filter(Boolean);
      const skipped = data.habits.length - sanitized.length;
      if (sanitized.length === 0 && data.habits.length > 0) {
        throw new Error("No valid habits found in that backup file");
      }

      const ok = confirm(
        `This will replace your current ${habitsCache.length} habit(s) with ` +
          `${sanitized.length} habit(s) from the backup` +
          `${skipped > 0 ? ` (${skipped} skipped — unreadable data)` : ""}. Continue?`
      );
      if (!ok) return;

      habitsCache = sanitized;
      await backfillMissingCreatedAt();
      render();

      if (currentUser) {
        if (data.name) await setDisplayName(data.name);
        renderGreeting();
        await replaceCloudHabits(habitsCache);
      } else {
        if (data.name) saveName(data.name);
        saveLocalHabits(habitsCache);
        renderGreeting();
      }
    } catch (err) {
      alert("Couldn't read that file — make sure it's a Daily Streak backup JSON.");
    } finally {
      importFile.value = "";
    }
  };
  reader.readAsText(file);
}

// --- Weekly review ---
// A Sunday-evening recap of the most recently completed Monday–Sunday week. The
// underlying streak math has no calendar anchor (see periodDaysLeft), so the review's
// week boundary is a display-only convention layered on top, not a change to calcStreak.

function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// offset 0 = the most recently completed week, 1 = the week before that, etc. Completions
// are retained indefinitely, so nothing about the underlying data limits this to "now."
function getReviewWeekRange(offset = 0) {
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() - today.getDay() - offset * 7);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekStart.getDate() - 6);
  return { weekStart, weekEnd };
}

function formatReviewDateRange(weekStart, weekEnd) {
  const startMonth = weekStart.toLocaleDateString("en-US", { month: "long" });
  const endMonth = weekEnd.toLocaleDateString("en-US", { month: "long" });
  if (startMonth === endMonth) {
    return `${weekStart.getDate()}–${weekEnd.getDate()} ${endMonth}`;
  }
  return `${weekStart.getDate()} ${startMonth} – ${weekEnd.getDate()} ${endMonth}`;
}

function computeWeeklyReviewRows(habits, weekStart, weekEnd) {
  const prevWeekEnd = new Date(weekStart);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);

  return habits.map((habit) => {
    const period = getPeriod(habit);
    const days = periodDays(period);
    const target = getTarget(habit);
    const restDays = habit.restDays || [];

    const cells = [];
    for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d);
      const isRested = restDays.includes(dateStr);
      const isDone = countOnDate(habit.completions, dateStr) > 0;
      cells.push({ date: dateStr, state: isRested ? "rested" : isDone ? "done" : "blank" });
    }

    const weekCount = countInWindow(habit.completions, weekEnd, 7);
    const lastWeekCount = countInWindow(habit.completions, prevWeekEnd, 7);
    const weekTarget = Math.max(1, Math.round((target * 7) / days));
    const held = weekCount >= weekTarget;
    const delta = weekCount - lastWeekCount;

    return {
      habit,
      period,
      cells,
      weekCount,
      weekTarget,
      held,
      deltaLabel: delta === 0 ? "even" : delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`,
    };
  });
}

function reviewHeadlineText(rows) {
  const held = rows.filter((r) => r.held).length;
  const slipped = rows.length - held;
  if (rows.length === 0) return "Nothing to review yet.";
  if (slipped === 0) return "All held.";
  if (held === 0) return "All slipped.";
  return `${numberWord(held)} held. ${numberWord(slipped)} slipped.`;
}

function reviewLeadText(rows) {
  if (rows.length === 0) return "Add a habit to start building your weekly recap.";
  const held = rows.filter((r) => r.held).length;
  return `You kept ${held} of ${rows.length} habit${rows.length === 1 ? "" : "s"} on pace this week.`;
}

function computeTiles(rows) {
  const dayTotals = [0, 0, 0, 0, 0, 0, 0];
  let total = 0;
  rows.forEach((row) => {
    row.cells.forEach((cell) => {
      if (cell.state === "done") {
        dayTotals[parseDateKey(cell.date).getDay()]++;
        total++;
      }
    });
  });
  let bestDay = 0;
  dayTotals.forEach((count, i) => {
    if (count > dayTotals[bestDay]) bestDay = i;
  });
  return {
    tile1Value: total === 0 ? "—" : WEEKDAY_NAMES[bestDay],
    tile1Label: "Most active day",
    tile2Value: String(total),
    tile2Label: `Completion${total === 1 ? "" : "s"} this week`,
  };
}

// Drift detection: median gap between completions in the trailing 12 weeks, compared
// against the habit's own cadence. Surfaces at most one habit — the largest ratio.
function computeDrift(habits) {
  let best = null;
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 83);
  const startStr = formatDate(windowStart);

  habits.forEach((habit) => {
    const period = getPeriod(habit);
    const days = periodDays(period);
    const dates = [...new Set(habit.completions.filter((d) => d >= startStr))].sort();
    if (dates.length < 6) return;

    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push(Math.round((parseDateKey(dates[i]) - parseDateKey(dates[i - 1])) / 86400000));
    }
    const sorted = [...gaps].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianGap = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const ratio = medianGap / days;

    if (ratio > 1.25 && (!best || ratio > best.ratio)) {
      const suggestedValue = medianGap <= 14 ? Math.max(1, Math.round(medianGap)) : Math.max(1, Math.round(medianGap / 7));
      const suggestedUnit = medianGap <= 14 ? "day" : "week";
      best = { habit, medianGap, ratio, suggestedValue, suggestedUnit };
    }
  });

  return best;
}

let currentDrift = null;
let reviewWeekOffset = 0;

function renderWeeklyReview() {
  const habits = loadHabits().filter((h) => !h.archivedAt);
  const { weekStart, weekEnd } = getReviewWeekRange(reviewWeekOffset);
  const rows = computeWeeklyReviewRows(habits, weekStart, weekEnd);

  reviewPrevBtn.disabled = false;
  reviewNextBtn.disabled = reviewWeekOffset === 0;

  reviewEyebrow.textContent = `Week ${isoWeekNumber(weekEnd)} · ${formatReviewDateRange(weekStart, weekEnd)}`;
  reviewHeadline.textContent = reviewHeadlineText(rows);
  reviewLead.textContent = reviewLeadText(rows);

  reviewTableBody.innerHTML = "";
  rows.forEach((row) => {
    const node = reviewRowTemplate.content.cloneNode(true);
    node.querySelector(".review-row-name").textContent = row.habit.name;
    node.querySelector(".review-row-cadence").textContent =
      `${getTarget(row.habit)}× every ${periodPhrase(row.period)}`;
    const weekEl = node.querySelector(".review-row-week");
    row.cells.forEach((cell) => {
      const cellEl = document.createElement("div");
      cellEl.className = cell.state === "blank" ? "review-day-cell" : `review-day-cell ${cell.state}`;
      cellEl.title = cell.date;
      weekEl.appendChild(cellEl);
    });
    node.querySelector(".review-col-hit").textContent = `${row.weekCount} / ${row.weekTarget}`;
    node.querySelector(".review-col-delta").textContent = row.deltaLabel;
    reviewTableBody.appendChild(node);
  });

  const tiles = computeTiles(rows);
  reviewTile1Value.textContent = tiles.tile1Value;
  reviewTile1Label.textContent = tiles.tile1Label;
  reviewTile2Value.textContent = tiles.tile2Value;
  reviewTile2Label.textContent = tiles.tile2Label;

  // Drift detection is about current pacing, not a past week's data — only show it on
  // the most recently completed week.
  currentDrift = reviewWeekOffset === 0 ? computeDrift(habits) : null;
  if (currentDrift) {
    const { habit, suggestedValue, suggestedUnit } = currentDrift;
    const suggestedUnitWord = suggestedValue === 1 ? suggestedUnit : `${suggestedUnit}s`;
    reviewDrift.hidden = false;
    reviewDriftHeadline.textContent =
      `${habit.name} is set to every ${periodPhrase(getPeriod(habit))} but runs every ${suggestedValue} ${suggestedUnitWord}`;
    reviewDriftBody.textContent =
      "Its actual pace has drifted from the target — updating the cadence keeps the streak honest.";
    reviewDriftAccept.textContent = `Change to every ${suggestedValue} ${suggestedUnitWord}`;
    reviewDriftKeep.textContent = `Keep ${getTarget(habit)}× every ${periodPhrase(getPeriod(habit))}`;
  } else {
    reviewDrift.hidden = true;
  }
}

function openWeeklyReview() {
  reviewWeekOffset = 0;
  renderWeeklyReview();
  mainView.style.display = "none";
  weeklyReviewView.classList.add("visible");
  window.scrollTo(0, 0);
}

function closeWeeklyReview() {
  weeklyReviewView.classList.remove("visible");
  mainView.style.display = "";
}

reviewBtn.addEventListener("click", openWeeklyReview);
reviewBackBtn.addEventListener("click", closeWeeklyReview);
reviewDone.addEventListener("click", closeWeeklyReview);
reviewSetTargets.addEventListener("click", closeWeeklyReview);

reviewPrevBtn.addEventListener("click", () => {
  reviewWeekOffset += 1;
  renderWeeklyReview();
});

reviewNextBtn.addEventListener("click", () => {
  if (reviewWeekOffset === 0) return;
  reviewWeekOffset -= 1;
  renderWeeklyReview();
});

reviewDriftAccept.addEventListener("click", async () => {
  if (!currentDrift) return;
  const { habit, suggestedValue, suggestedUnit } = currentDrift;
  await saveHabitEdits(habit, {
    name: habit.name,
    target: getTarget(habit),
    periodValue: suggestedValue,
    periodUnit: suggestedUnit,
  });
  renderWeeklyReview();
});

reviewDriftKeep.addEventListener("click", () => {
  reviewDrift.hidden = true;
  currentDrift = null;
});

// --- Events ---

function openAddHabitForm() {
  addHabitToggle.classList.add("hidden");
  form.classList.add("visible");
  input.focus();
}

function closeAddHabitForm() {
  form.classList.remove("visible");
  addHabitToggle.classList.remove("hidden");
}

addHabitToggle.addEventListener("click", openAddHabitForm);

document.querySelectorAll(".habit-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    input.value = chip.dataset.name;
    input.focus();
  });
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = input.value.trim();
  if (!name) return;

  const target = Math.max(1, parseInt(targetInput.value, 10) || 1);
  const periodValue = Math.max(1, parseInt(periodValueInput.value, 10) || 1);
  const periodUnit = ["day", "week", "month"].includes(periodUnitInput.value)
    ? periodUnitInput.value
    : "day";

  addHabit(name, target, periodValue, periodUnit);
  input.value = "";
  closeAddHabitForm();
});

nameForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  nameModal.classList.remove("visible");

  // Save locally first regardless of path — for the "account" path this is what lets the
  // typed name survive a page reload if Supabase requires email confirmation before the
  // account actually signs in (see the display-name promotion in onAuthStateChange).
  // renderGreeting() right away too: getDisplayName() already falls back to this local
  // name while signed out, so the greeting can show before the account exists.
  saveName(name);
  renderGreeting();

  if (onboardingNameTarget === "account") {
    onboardingNameTarget = null;
    openAuthModal("sign-up");
    return;
  }
  onboardingNameTarget = null;

  if (currentUser) {
    await setDisplayName(name);
  }
  renderGreeting();
});

exportBtn.addEventListener("click", exportData);
importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", () => {
  const file = importFile.files[0];
  if (file) importData(file);
});

// --- Account & auth ---

function updateAccountButton() {
  if (currentUser) {
    accountBtn.textContent = currentUser.user_metadata?.display_name || currentUser.email;
    accountBtn.classList.add("signed-in");
  } else {
    accountBtn.textContent = "Sign in to sync";
    accountBtn.classList.remove("signed-in");
  }
}

let authMode = "sign-in";

function updateAuthModeUI() {
  if (authMode === "sign-in") {
    authModalTitle.textContent = "Sign in";
    authSubmitBtn.textContent = "Sign in";
    authToggleText.textContent = "Don't have an account?";
    authToggleBtn.textContent = "Sign up";
  } else {
    authModalTitle.textContent = "Sign up";
    authSubmitBtn.textContent = "Create account";
    authToggleText.textContent = "Already have an account?";
    authToggleBtn.textContent = "Sign in";
  }
}

function openAuthModal(mode = "sign-in") {
  authMode = mode;
  updateAuthModeUI();
  authError.classList.remove("visible", "success");
  authForm.reset();
  authModal.classList.add("visible");
  authEmailInput.focus();
}

function closeAuthModal() {
  authModal.classList.remove("visible");
}

accountBtn.addEventListener("click", () => {
  if (currentUser) {
    if (confirm("Sign out? Your habits stay saved in your account.")) {
      supabaseClient.auth.signOut();
    }
  } else {
    openAuthModal();
  }
});

authToggleBtn.addEventListener("click", () => {
  authMode = authMode === "sign-in" ? "sign-up" : "sign-in";
  authError.classList.remove("visible", "success");
  updateAuthModeUI();
});

authCancelBtn.addEventListener("click", closeAuthModal);
authModal.addEventListener("click", (e) => {
  if (e.target === authModal) closeAuthModal();
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;
  if (!email || !password) return;

  authSubmitBtn.disabled = true;
  authError.classList.remove("visible", "success");

  const { error } =
    authMode === "sign-in"
      ? await supabaseClient.auth.signInWithPassword({ email, password })
      : await supabaseClient.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.href },
        });

  authSubmitBtn.disabled = false;

  if (error) {
    authError.textContent = error.message;
    authError.classList.add("visible");
    return;
  }

  if (authMode === "sign-up") {
    authError.textContent = "Check your email to confirm your account, then sign in.";
    authError.classList.add("visible", "success");
  }
  // A successful sign-in fires onAuthStateChange, which closes the modal and switches
  // the app into cloud mode — nothing further to do here.
});

googleAuthBtn.addEventListener("click", () => {
  supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.href },
  });
});

// --- Realtime sync ---
// Keeps two tabs/devices signed into the same account from silently diverging: subscribes
// to this user's rows on the habits table and merges inbound changes into habitsCache.
// A write this tab made will also round-trip back here — that just reapplies data we
// already have, an acceptable no-op rather than tracking in-flight writes to suppress it.

let realtimeChannel = null;

function subscribeRealtime() {
  unsubscribeRealtime();
  if (!currentUser) return;
  realtimeChannel = supabaseClient
    .channel(`habits-${currentUser.id}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "habits", filter: `user_id=eq.${currentUser.id}` },
      handleRealtimeChange
    )
    .subscribe();
}

function unsubscribeRealtime() {
  if (realtimeChannel) {
    supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

function handleRealtimeChange(payload) {
  if (payload.eventType === "INSERT") {
    if (!habitsCache.some((h) => h.id === payload.new.id)) {
      habitsCache.push(rowToHabit(payload.new));
      render();
    }
  } else if (payload.eventType === "UPDATE") {
    const idx = habitsCache.findIndex((h) => h.id === payload.new.id);
    if (idx !== -1) {
      habitsCache[idx] = rowToHabit(payload.new);
      render();
    }
  } else if (payload.eventType === "DELETE") {
    const idx = habitsCache.findIndex((h) => h.id === payload.old.id);
    if (idx !== -1) {
      habitsCache.splice(idx, 1);
      render();
    }
  }
}

// --- Analytics / insights ---
// A trends screen over the full retained history — completions retained indefinitely, so
// this reads existing data rather than needing new storage. Charts are hand-drawn SVG/DOM
// (no charting library — no bundler to load one with) and stick to the single-accent,
// sequential-shading palette used everywhere else.

function computeWeeklyTrend(habits, weeks = 12) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const buckets = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const weekEnd = new Date(end);
    weekEnd.setDate(weekEnd.getDate() - w * 7);
    let count = 0;
    habits.forEach((h) => {
      count += countInWindow(h.completions, weekEnd, 7);
    });
    buckets.push({ weekEnd, count });
  }
  return buckets;
}

function renderTrendChart(container, buckets) {
  container.innerHTML = "";
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const w = 600;
  const h = 160;
  const gap = 4;
  const barWidth = (w - gap * (buckets.length - 1)) / buckets.length;
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("class", "trend-chart-svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Completions per week over the last ${buckets.length} weeks`);

  buckets.forEach((b, i) => {
    const barH = Math.max((b.count / max) * (h - 24), b.count > 0 ? 2 : 0);
    const x = i * (barWidth + gap);
    const y = h - barH - 20;
    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);
    rect.setAttribute("width", barWidth);
    rect.setAttribute("height", barH);
    rect.setAttribute("rx", 2);
    rect.setAttribute("class", "trend-bar");
    const title = document.createElementNS(svgNS, "title");
    title.textContent = `Week of ${formatDate(b.weekEnd)}: ${b.count} completion${b.count === 1 ? "" : "s"}`;
    rect.appendChild(title);
    svg.appendChild(rect);
  });

  container.appendChild(svg);
}

function renderRateBars(container, habits) {
  container.innerHTML = "";
  habits.forEach((habit) => {
    const row = document.createElement("div");
    row.className = "analytics-rate-row";

    const label = document.createElement("div");
    label.className = "analytics-rate-label";
    label.textContent = habit.name;

    const track = document.createElement("div");
    track.className = "analytics-rate-track";
    const fill = document.createElement("div");
    fill.className = "analytics-rate-fill";
    const rate = completionRate(habit);
    fill.style.width = `${rate}%`;
    track.appendChild(fill);

    const value = document.createElement("div");
    value.className = "analytics-rate-value";
    value.textContent = `${rate}%`;

    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(value);
    container.appendChild(row);
  });
}

function renderStreakTable(container, habits) {
  container.innerHTML = "";
  const sorted = [...habits].sort((a, b) => longestStreak(b) - longestStreak(a));

  sorted.forEach((habit) => {
    const period = getPeriod(habit);
    const days = periodDays(period);
    const row = document.createElement("div");
    row.className = "analytics-streak-row";

    const name = document.createElement("span");
    name.className = "analytics-streak-name";
    name.textContent = habit.name;

    const current = document.createElement("span");
    current.className = "analytics-streak-figure";
    current.textContent = `${calcStreak(habit.completions, getTarget(habit), days, habit.restDays || [])} current`;

    const longest = document.createElement("span");
    longest.className = "analytics-streak-figure";
    longest.textContent = `${longestStreak(habit)} longest`;

    const total = document.createElement("span");
    total.className = "analytics-streak-figure";
    total.textContent = `${totalCompletions(habit)} total`;

    row.appendChild(name);
    row.appendChild(current);
    row.appendChild(longest);
    row.appendChild(total);
    container.appendChild(row);
  });
}

function renderAnalytics() {
  const habits = loadHabits().filter((h) => !h.archivedAt);
  // .empty-state sets display:none unconditionally (matching the main empty-state's own
  // pattern) — an inline style, not the hidden attribute, is what has to override it.
  analyticsEmpty.style.display = habits.length > 0 ? "none" : "block";
  analyticsContent.hidden = habits.length === 0;
  if (habits.length === 0) return;

  renderTrendChart(analyticsTrendChart, computeWeeklyTrend(habits, 12));
  renderRateBars(analyticsRateBars, habits);
  renderStreakTable(analyticsStreakTable, habits);
}

function openAnalytics() {
  renderAnalytics();
  mainView.style.display = "none";
  analyticsView.classList.add("visible");
  window.scrollTo(0, 0);
}

function closeAnalytics() {
  analyticsView.classList.remove("visible");
  mainView.style.display = "";
}

analyticsBtn.addEventListener("click", openAnalytics);
analyticsBackBtn.addEventListener("click", closeAnalytics);

// --- Modal accessibility ---
// Escape closes the topmost visible modal (only for the ones with a genuine cancel
// action — welcome/name are mandatory onboarding steps with no neutral "just close").
// Tab is trapped inside whichever modal is visible, matching standard dialog behavior.

const ALL_MODALS = [welcomeModal, nameModal, editModal, historyModal, authModal];
const MODAL_CLOSERS = new Map([
  [editModal, closeEditModal],
  [historyModal, closeHistoryModal],
  [authModal, closeAuthModal],
]);

function getVisibleModal() {
  return ALL_MODALS.find((m) => m.classList.contains("visible")) || null;
}

function trapFocus(modal, e) {
  const focusable = modal.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

document.addEventListener("keydown", (e) => {
  const modal = getVisibleModal();
  if (!modal) return;
  if (e.key === "Escape") {
    const closeFn = MODAL_CLOSERS.get(modal);
    if (closeFn) closeFn();
  } else if (e.key === "Tab") {
    trapFocus(modal, e);
  }
});

// --- Bootstrap ---

initTheme();

let authBootstrapped = false;

supabaseClient.auth.onAuthStateChange(async (event, session) => {
  const wasSignedIn = !!currentUser;
  currentUser = session?.user ?? null;
  const justSignedIn = currentUser && !wasSignedIn && authBootstrapped;

  await refreshHabitsCache();

  // Promote a name onto the account the first time it has none — from the Google profile
  // for an OAuth sign-in, or from the name typed into the onboarding flow for an
  // email/password sign-up. Deliberately outside the `justSignedIn` check: a real Google
  // OAuth redirect reloads the whole page, so `authBootstrapped` is false and
  // `justSignedIn` is false even on a first sign-in. Safe to run on every auth event —
  // it's a no-op once `display_name` is set.
  if (currentUser && !currentUser.user_metadata?.display_name) {
    const googleName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name;
    const nameToUse = googleName || loadName();
    if (nameToUse) await setDisplayName(nameToUse);
  }

  if (justSignedIn) {
    closeAuthModal();
    welcomeModal.classList.remove("visible");
    const localHabits = loadLocalHabits();
    if (localHabits.length > 0 && habitsCache.length === 0) {
      if (confirm(`Import your ${localHabits.length} local habit(s) into this account?`)) {
        habitsCache = localHabits;
        await replaceCloudHabits(habitsCache);
      }
    }
  }

  updateAccountButton();
  renderGreeting();
  render();
  subscribeRealtime();

  if (!authBootstrapped) {
    authBootstrapped = true;
    initName();
  }
});
