const STORAGE_KEY = "daily-streak-habits";
const NAME_KEY = "daily-streak-username";
const THEME_KEY = "daily-streak-theme";
const LAST_PERFECT_DAY_KEY = "daily-streak-last-perfect-day";

const SUPABASE_URL = "https://yyeexumwqboxfpbssoqj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Xha7Zhl44-L9zmU_YjWZJg_6uHxwR5Y";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

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

const heroLongestLabel = document.getElementById("hero-longest-label");
const heroLongestNumeral = document.getElementById("hero-longest-numeral");
const heroLongestUnit = document.getElementById("hero-longest-unit");
const heroStatDone = document.getElementById("hero-stat-done");
const heroStatRate = document.getElementById("hero-stat-rate");
const heroStatRest = document.getElementById("hero-stat-rest");

const mainView = document.getElementById("main-view");
const reviewBtn = document.getElementById("review-btn");
const weeklyReviewView = document.getElementById("weekly-review-view");
const reviewBackBtn = document.getElementById("review-back-btn");
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
const reviewSetTargets = document.getElementById("review-set-targets");
const reviewDone = document.getElementById("review-done");
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
const editCancelBtn = document.getElementById("edit-cancel-btn");

const historyModal = document.getElementById("history-modal");
const historyCloseBtn = document.getElementById("history-close-btn");
const historyHabitName = document.getElementById("history-habit-name");
const historyCurrentStreak = document.getElementById("history-current-streak");
const historyLongestStreak = document.getElementById("history-longest-streak");
const historyTotal = document.getElementById("history-total");
const historyRate = document.getElementById("history-rate");
const historyHeatmap = document.getElementById("history-heatmap");

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
// 3 rest days per calendar month, per habit, derived — no stored counter.

function currentYearMonth() {
  return todayKey().slice(0, 7);
}

function restDaysUsedThisMonth(habit) {
  return (habit.restDays || []).filter((d) => d.startsWith(currentYearMonth())).length;
}

function restDaysLeft(habit) {
  return Math.max(0, 3 - restDaysUsedThisMonth(habit));
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
// grid of 9x9 cells, oldest first, with rest days grey and today ringed.
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
      cell.className = isRested ? "map-cell rested" : `map-cell level-${heatmapLevel(count, fairShare)}`;
      if (date === today) cell.classList.add("today");
      cell.title = isRested ? `${date}: rested` : `${date}: ${count} completion${count === 1 ? "" : "s"}`;
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

function pickRestOfferHabit(habits) {
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

    if (
      deficit === 1 &&
      !alreadyRested &&
      restDaysLeft(habit) > 0 &&
      !dismissedRestOffers.has(key)
    ) {
      const windowStart = new Date(prevWindowEnd);
      windowStart.setDate(windowStart.getDate() - (days - 1));
      let blankDate = null;
      for (let d = new Date(prevWindowEnd); d >= windowStart; d.setDate(d.getDate() - 1)) {
        const dateStr = formatDate(d);
        if (countOnDate(habit.completions, dateStr) === 0) {
          blankDate = dateStr;
          break;
        }
      }
      if (blankDate) {
        return { habit, days, target, blankDate, windowStart, windowEnd: prevWindowEnd, key };
      }
    }
  }
  return null;
}

// Whether every habit's current period goal is already met today.
function allHabitsMetToday(habits) {
  if (habits.length === 0) return false;
  return habits.every((habit) => {
    const period = getPeriod(habit);
    const days = periodDays(period);
    const target = getTarget(habit);
    const count =
      days === 1
        ? countOnDate(habit.completions, todayKey())
        : countInWindow(habit.completions, new Date(), days);
    return count >= target;
  });
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
  heroStatRest.textContent = restDaysLeft(longestHabit);
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

function initName() {
  if (getDisplayName()) return;
  nameModal.classList.add("visible");
  nameInput.focus();
}

// --- Theme ---

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
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
  const { habit, days, target, blankDate, windowStart, windowEnd } = offer;
  const node = offerCardTemplate.content.cloneNode(true);
  const card = node.querySelector(".habit-card");
  card.dataset.id = habit.id;

  node.querySelector(".offer-habit-name").textContent = habit.name;
  // The streak at stake — what spending the rest day would preserve, not the already-broken value.
  const previewRestDays = [...(habit.restDays || []), blankDate];
  const streak = calcStreak(habit.completions, target, days, previewRestDays);
  node.querySelector(".offer-streak-numeral").textContent = streak;
  node.querySelector(".offer-streak-label").textContent = streak === 1 ? "day" : "days";

  const blankWeekday = parseDateKey(blankDate).toLocaleDateString("en-US", { weekday: "long" });
  node.querySelector(".offer-meta").textContent =
    `${target}× every ${periodPhrase(getPeriod(habit))} · ${blankWeekday} is blank`;

  const rail = node.querySelector(".offer-week-rail");
  for (let d = new Date(windowStart); d <= windowEnd; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    const col = document.createElement("div");
    col.className = "offer-week-day";
    const block = document.createElement("div");
    const isDone = countOnDate(habit.completions, dateStr) > 0;
    block.className = "offer-week-block" + (isDone ? " done" : "") + (dateStr === blankDate ? " repairable" : "");
    const label = document.createElement("div");
    label.className = "offer-week-label";
    label.textContent = WEEKDAY_ABBR[d.getDay()];
    col.appendChild(block);
    col.appendChild(label);
    rail.appendChild(col);
  }

  node.querySelector(".offer-use-btn").addEventListener("click", () => useRestDay(habit.id, offer));
  node.querySelector(".offer-reset-btn").addEventListener("click", () => {
    dismissedRestOffers.add(offer.key);
    render();
  });

  return node;
}

function render() {
  const habits = loadHabits();
  list.innerHTML = "";

  emptyState.style.display = habits.length === 0 ? "block" : "none";

  updateHero(habits);

  const restOffer = pickRestOfferHabit(habits);
  const atRiskCandidates = restOffer ? habits.filter((h) => h.id !== restOffer.habit.id) : habits;
  const atRisk = pickAtRiskHabit(atRiskCandidates);

  habits.forEach((habit) => {
    if (restOffer && restOffer.habit.id === habit.id) {
      list.appendChild(renderOfferCard(restOffer));
      return;
    }

    const node = cardTemplate.content.cloneNode(true);
    const card = node.querySelector(".habit-card");
    card.dataset.id = habit.id;

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
    node.querySelector(".delete-btn").addEventListener("click", () => deleteHabit(habit.id));

    list.appendChild(node);
  });
}

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

  toast.appendChild(label);
  toast.appendChild(undoBtn);
  toastStack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));

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
    if (error) showSyncError(`Couldn't restore "${pending.habit.name}" — ${error.message}`);
  } else {
    saveLocalHabits(habitsCache);
  }
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

// Spends one of the habit's monthly rest days to fill the blank period identified by
// pickRestOfferHabit, keeping the streak alive without counting as a real completion.
async function useRestDay(id, offer) {
  const habit = habitsCache.find((h) => h.id === id);
  if (!habit) return;

  if (!habit.restDays) habit.restDays = [];
  habit.restDays.push(offer.blankDate);
  dismissedRestOffers.add(offer.key);

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
  editModal.classList.add("visible");
  editNameInput.focus();
}

function closeEditModal() {
  editModal.classList.remove("visible");
  editingId = null;
}

// Shared by the edit-habit modal and the weekly review's drifting-cadence accept action.
async function saveHabitEdits(habit, { name, target, periodValue, periodUnit }) {
  habit.name = name;
  habit.target = target;
  habit.periodValue = periodValue;
  habit.periodUnit = periodUnit;
  render();

  if (currentUser) {
    const { error } = await supabaseClient
      .from("habits")
      .update({ name, target, period_value: periodValue, period_unit: periodUnit })
      .eq("id", habit.id);
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

  const habit = habitsCache.find((h) => h.id === editingId);
  closeEditModal();
  if (!habit) return;

  await saveHabitEdits(habit, { name, target, periodValue, periodUnit });
});

editCancelBtn.addEventListener("click", closeEditModal);
editModal.addEventListener("click", (e) => {
  if (e.target === editModal) closeEditModal();
});

// --- Habit history ---

function openHistoryModal(id) {
  const habit = loadHabits().find((h) => h.id === id);
  if (!habit) return;

  const period = getPeriod(habit);
  const days = periodDays(period);
  const target = getTarget(habit);

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

function celebrateMilestone(habitName, days) {
  const toast = document.createElement("div");
  toast.className = "milestone-toast";
  toast.textContent = `${days}-day streak on "${habitName}"!`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

function celebratePerfectDay(habitCount) {
  const toast = document.createElement("div");
  toast.className = "milestone-toast";
  toast.textContent = `Perfect day! All ${habitCount} habit${habitCount === 1 ? "" : "s"} complete`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 3200);
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

function importData(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.habits)) throw new Error("Invalid backup file");
      const ok = confirm(
        `This will replace your current ${habitsCache.length} habit(s) with ` +
          `${data.habits.length} habit(s) from the backup. Continue?`
      );
      if (!ok) return;

      habitsCache = data.habits;
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

function getReviewWeekRange() {
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() - today.getDay());
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

function renderWeeklyReview() {
  const habits = loadHabits();
  const { weekStart, weekEnd } = getReviewWeekRange();
  const rows = computeWeeklyReviewRows(habits, weekStart, weekEnd);

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

  currentDrift = computeDrift(habits);
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

  if (currentUser) {
    await setDisplayName(name);
  } else {
    saveName(name);
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

function openAuthModal() {
  authMode = "sign-in";
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

// --- Bootstrap ---

initTheme();

let authBootstrapped = false;

supabaseClient.auth.onAuthStateChange(async (event, session) => {
  const wasSignedIn = !!currentUser;
  currentUser = session?.user ?? null;
  const justSignedIn = currentUser && !wasSignedIn && authBootstrapped;

  await refreshHabitsCache();

  if (justSignedIn) {
    closeAuthModal();
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

  if (!authBootstrapped) {
    authBootstrapped = true;
    initName();
  }
});
