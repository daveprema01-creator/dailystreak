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
const greeting = document.getElementById("greeting");
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
  };
}

// Persists a habit's completions/milestonesHit after markDone/undoLast — the only
// fields those two actions ever change.
async function persistHabitFields(habit) {
  if (currentUser) {
    const { error } = await supabaseClient
      .from("habits")
      .update({ completions: habit.completions, milestones_hit: habit.milestonesHit })
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

function calcStreak(completions, target, days) {
  let streak = 0;
  const cursor = new Date();

  // If the current window's goal isn't met yet, the streak is still "alive" based on the prior window.
  if (countInWindow(completions, cursor, days) < target) {
    cursor.setDate(cursor.getDate() - days);
  }

  while (countInWindow(completions, cursor, days) >= target) {
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
  const firstDate = new Date([...completions].sort()[0]);

  let longest = 0;
  let current = 0;
  const cursor = new Date();
  while (cursor >= firstDate) {
    if (countInWindow(completions, cursor, days) >= target) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
    cursor.setDate(cursor.getDate() - days);
  }
  return longest;
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
  const firstDate = new Date([...completions].sort()[0]);
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

const TIER_ICONS = ["🔥", "🔥🔥", "🌟", "💎"];
const previousStreakTiers = new Map();
const previousGoalMet = new Map();
const previousFillPct = new Map();

function tierIndex(streak) {
  if (streak >= 100) return 3;
  if (streak >= 30) return 2;
  if (streak >= 7) return 1;
  return 0;
}

function flameForStreak(streak) {
  return TIER_ICONS[tierIndex(streak)];
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

function render() {
  const habits = loadHabits();
  list.innerHTML = "";

  emptyState.style.display = habits.length === 0 ? "block" : "none";

  const pendingFillUpdates = [];

  habits.forEach((habit) => {
    const node = cardTemplate.content.cloneNode(true);
    const card = node.querySelector(".habit-card");
    card.dataset.id = habit.id;

    const nameBtn = node.querySelector(".habit-name");
    nameBtn.textContent = habit.name;
    nameBtn.addEventListener("click", () => openHistoryModal(habit.id));

    const target = getTarget(habit);
    const period = getPeriod(habit);
    const days = periodDays(period);
    const isDaily = days === 1;

    node.querySelector(".habit-goal-text").textContent =
      `${target}× every ${periodPhrase(period)}`;

    const periodCount = isDaily
      ? countOnDate(habit.completions, todayKey())
      : countInWindow(habit.completions, new Date(), days);
    const streak = calcStreak(habit.completions, target, days);
    const goalMet = periodCount >= target;

    const flameEl = node.querySelector(".streak-flame");
    flameEl.textContent = flameForStreak(streak);
    const tier = tierIndex(streak);
    const prevTier = previousStreakTiers.get(habit.id);
    if (prevTier !== undefined && tier > prevTier) {
      flameEl.classList.add("tier-up");
      flameEl.addEventListener("animationend", () => flameEl.classList.remove("tier-up"), { once: true });
    }
    previousStreakTiers.set(habit.id, tier);

    node.querySelector(".streak-text").textContent = `${streak} streak`;
    node.querySelector(".period-text").textContent = isDaily
      ? `${periodCount} / ${target} today`
      : `${periodCount} / ${target} in the last ${periodPhrase(period)}`;

    const visual = node.querySelector(".progress-visual");
    const track = document.createElement("div");
    track.className = "progress-bar-track";
    const fill = document.createElement("div");
    fill.className = "progress-bar-fill";

    // Freshly-created elements have no prior on-screen width to transition from, so start
    // each fill at its last known % and let the post-render frame animate it to the new one.
    const fillPct = Math.min(100, (periodCount / target) * 100);
    const prevFillPct = previousFillPct.has(habit.id) ? previousFillPct.get(habit.id) : fillPct;
    fill.style.width = `${prevFillPct}%`;
    previousFillPct.set(habit.id, fillPct);
    pendingFillUpdates.push({ fill, fillPct });

    const wasGoalMet = previousGoalMet.get(habit.id);
    if (goalMet && wasGoalMet === false) {
      fill.classList.add("goal-met");
      fill.addEventListener("animationend", () => fill.classList.remove("goal-met"), { once: true });
    }
    previousGoalMet.set(habit.id, goalMet);

    track.appendChild(fill);
    visual.appendChild(track);

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

  // Force layout so the browser commits each fill's starting width before we change it,
  // otherwise the two writes collapse into one and the transition never plays.
  list.offsetHeight;
  requestAnimationFrame(() => {
    pendingFillUpdates.forEach(({ fill, fillPct }) => {
      fill.style.width = `${fillPct}%`;
    });
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
  const newStreak = calcStreak(habit.completions, getTarget(habit), days);

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
  historyCurrentStreak.textContent = calcStreak(habit.completions, target, days);
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

const PARTICLE_EMOJI = ["🎉", "✨", "🔥", "⭐"];

function celebrate(id) {
  const card = list.querySelector(`.habit-card[data-id="${id}"]`);
  if (!card) return;

  card.classList.add("celebrate");
  card.addEventListener("animationend", () => card.classList.remove("celebrate"), { once: true });

  const btn = card.querySelector(".complete-btn");
  const burst = document.createElement("div");
  burst.className = "particle-burst";

  for (let i = 0; i < 8; i++) {
    const particle = document.createElement("span");
    particle.className = "particle";
    particle.textContent = PARTICLE_EMOJI[Math.floor(Math.random() * PARTICLE_EMOJI.length)];

    const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
    const distance = 50 + Math.random() * 30;
    particle.style.setProperty("--tx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--ty", `${Math.sin(angle) * distance - 20}px`);
    particle.style.left = "50%";
    particle.style.top = "50%";

    burst.appendChild(particle);
  }

  btn.appendChild(burst);
  setTimeout(() => burst.remove(), 700);
}

function celebrateMilestone(habitName, days) {
  const toast = document.createElement("div");
  toast.className = "milestone-toast";
  toast.textContent = `🔥 ${days}-day streak on "${habitName}"!`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 2600);

  const burst = document.createElement("div");
  burst.className = "particle-burst milestone-burst";
  for (let i = 0; i < 24; i++) {
    const particle = document.createElement("span");
    particle.className = "particle";
    particle.textContent = PARTICLE_EMOJI[Math.floor(Math.random() * PARTICLE_EMOJI.length)];
    const angle = Math.random() * Math.PI * 2;
    const distance = 120 + Math.random() * 180;
    particle.style.setProperty("--tx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--ty", `${Math.sin(angle) * distance}px`);
    particle.style.left = "50%";
    particle.style.top = "40%";
    burst.appendChild(particle);
  }
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 1000);
}

function celebratePerfectDay(habitCount) {
  const toast = document.createElement("div");
  toast.className = "milestone-toast perfect-day-toast";
  toast.textContent = `🎊 Perfect day! All ${habitCount} habit${habitCount === 1 ? "" : "s"} complete`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 3200);

  const burstPositions = [
    { left: "20%", top: "30%" },
    { left: "50%", top: "25%" },
    { left: "80%", top: "30%" },
    { left: "50%", top: "55%" },
  ];
  burstPositions.forEach((pos, idx) => {
    setTimeout(() => {
      const burst = document.createElement("div");
      burst.className = "particle-burst milestone-burst";
      for (let i = 0; i < 14; i++) {
        const particle = document.createElement("span");
        particle.className = "particle";
        particle.textContent = PARTICLE_EMOJI[Math.floor(Math.random() * PARTICLE_EMOJI.length)];
        const angle = Math.random() * Math.PI * 2;
        const distance = 90 + Math.random() * 140;
        particle.style.setProperty("--tx", `${Math.cos(angle) * distance}px`);
        particle.style.setProperty("--ty", `${Math.sin(angle) * distance}px`);
        particle.style.left = pos.left;
        particle.style.top = pos.top;
        burst.appendChild(particle);
      }
      document.body.appendChild(burst);
      setTimeout(() => burst.remove(), 1000);
    }, idx * 120);
  });
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

// --- Events ---

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
  input.focus();
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
