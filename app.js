const STORAGE_KEY = "daily-streak-habits";
const NAME_KEY = "daily-streak-username";
const THEME_KEY = "daily-streak-theme";
const LAST_PERFECT_DAY_KEY = "daily-streak-last-perfect-day";

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

// --- Storage ---

let corruptDataWarned = false;

function loadHabits() {
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

function saveHabits(habits) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

function loadName() {
  return localStorage.getItem(NAME_KEY);
}

function saveName(name) {
  localStorage.setItem(NAME_KEY, name);
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

// Last 7 days including today, oldest first.
function lastSevenDays() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(formatDate(d));
  }
  return days;
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
  const name = loadName();
  if (!name) return;
  greeting.textContent = `${getTimeOfDayGreeting()}, ${name}!`;
  greeting.classList.add("visible");
}

function initName() {
  const name = loadName();
  if (name) {
    renderGreeting();
    return;
  }
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
    if (isDaily) {
      const dotsContainer = document.createElement("div");
      dotsContainer.className = "week-dots";
      const today = todayKey();
      lastSevenDays().forEach((day) => {
        const dot = document.createElement("div");
        dot.className = "week-dot";
        if (countOnDate(habit.completions, day) >= target) dot.classList.add("filled");
        if (day === today) dot.classList.add("today");
        dotsContainer.appendChild(dot);
      });
      visual.appendChild(dotsContainer);
    } else {
      const track = document.createElement("div");
      track.className = "progress-bar-track";
      const fill = document.createElement("div");
      fill.className = "progress-bar-fill";
      fill.style.width = `${Math.min(100, (periodCount / target) * 100)}%`;
      track.appendChild(fill);
      visual.appendChild(track);
    }

    const completeBtn = node.querySelector(".complete-btn");
    if (target === 1 && isDaily) {
      completeBtn.textContent = goalMet ? "Done for today ✓" : "Mark today done";
    } else {
      completeBtn.textContent = goalMet ? "Mark done ✓" : "Mark done";
    }
    completeBtn.classList.toggle("done", goalMet);
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

function addHabit(name, target, periodValue, periodUnit) {
  const habits = loadHabits();
  habits.push({
    id: crypto.randomUUID(),
    name,
    target,
    periodValue,
    periodUnit,
    createdAt: todayKey(),
    completions: [],
    milestonesHit: [],
  });
  saveHabits(habits);
  render();
}

// id -> { habit, index, timeoutId, toastEl }
const pendingDeletes = new Map();

function deleteHabit(id) {
  const habits = loadHabits();
  const index = habits.findIndex((h) => h.id === id);
  if (index === -1) return;
  const [habit] = habits.splice(index, 1);
  saveHabits(habits);
  render();
  showUndoToast(habit, index);
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

function restoreHabit(id) {
  const pending = pendingDeletes.get(id);
  if (!pending) return;
  clearTimeout(pending.timeoutId);
  pendingDeletes.delete(id);
  removeToast(pending.toastEl);

  const habits = loadHabits();
  const insertAt = Math.min(pending.index, habits.length);
  habits.splice(insertAt, 0, pending.habit);
  saveHabits(habits);
  render();
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

function warnCorruptData() {
  const toast = document.createElement("div");
  toast.className = "undo-toast";
  const label = document.createElement("span");
  label.textContent = "Your saved habits couldn't be read and were reset.";
  toast.appendChild(label);
  toastStack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => removeToast(toast), 6000);
}

const STREAK_MILESTONES = [7, 30, 100, 365];

function markDone(id) {
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

  saveHabits(habits);
  render();
  if (hitMilestone) celebrateMilestone(habit.name, hitMilestone);

  if (allHabitsMetToday(habits) && localStorage.getItem(LAST_PERFECT_DAY_KEY) !== todayKey()) {
    localStorage.setItem(LAST_PERFECT_DAY_KEY, todayKey());
    celebratePerfectDay(habits.length);
  }
}

function undoLast(id) {
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

  saveHabits(habits);
  render();
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

editForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!editingId) return;

  const name = editNameInput.value.trim();
  if (!name) return;
  const target = Math.max(1, parseInt(editTargetInput.value, 10) || 1);
  const periodValue = Math.max(1, parseInt(editPeriodValueInput.value, 10) || 1);
  const periodUnit = ["day", "week", "month"].includes(editPeriodUnitInput.value)
    ? editPeriodUnitInput.value
    : "day";

  const habits = loadHabits();
  const habit = habits.find((h) => h.id === editingId);
  if (habit) {
    habit.name = name;
    habit.target = target;
    habit.periodValue = periodValue;
    habit.periodUnit = periodUnit;
    saveHabits(habits);
    render();
  }
  closeEditModal();
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
    name: loadName(),
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
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.habits)) throw new Error("Invalid backup file");
      const ok = confirm(
        `This will replace your current ${loadHabits().length} habit(s) with ` +
          `${data.habits.length} habit(s) from the backup. Continue?`
      );
      if (!ok) return;
      saveHabits(data.habits);
      if (data.name) saveName(data.name);
      render();
      renderGreeting();
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

nameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  saveName(name);
  nameModal.classList.remove("visible");
  renderGreeting();
});

exportBtn.addEventListener("click", exportData);
importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", () => {
  const file = importFile.files[0];
  if (file) importData(file);
});

initTheme();
initName();
render();
