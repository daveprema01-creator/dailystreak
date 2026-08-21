// Ported near-verbatim from the vanilla app's app.js. This module is the single source of
// truth for the period/streak math — both the personal dashboard and (later) milestone-event
// detection for the activity feed depend on it, so it stays framework-free and pure.

export type PeriodUnit = "day" | "week" | "month";

export interface Habit {
  id: string;
  name: string;
  target: number;
  periodValue: number;
  periodUnit: PeriodUnit;
  createdAt: string | null; // "YYYY-MM-DD"
  completions: string[]; // "YYYY-MM-DD", one entry per completion (repeats allowed)
  milestonesHit: number[];
  restDays: string[]; // "YYYY-MM-DD", one entry per period a rest day was spent on
  archivedAt: string | null; // ISO timestamp, or null if active
  restDayAllowance: number;
  /** Signed-in only — visible to accepted followers on /u/:username. No-op for guests. */
  shared: boolean;
  /** @deprecated back-compat only, read via getPeriod() */
  timeframe?: "day" | "week";
}

export interface Period {
  value: number;
  unit: PeriodUnit;
}

export const STREAK_MILESTONES = [7, 30, 100, 365] as const;

// --- Date helpers ---

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayKey(): string {
  return formatDate(new Date());
}

/**
 * Parses a "YYYY-MM-DD" key as a local date at midnight. `new Date("YYYY-MM-DD")` parses as
 * UTC, which shifts a day off in any timezone behind UTC — always use this instead for dates
 * coming out of completions/restDays/createdAt.
 */
export function parseDateKey(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// --- Period helpers ---
// A habit's cadence is "target times every periodValue periodUnit(s)". Everything reduces to
// a rolling window of periodDays ending on a given date.

const UNIT_DAYS: Record<PeriodUnit, number> = { day: 1, week: 7, month: 30 };

export function getTarget(habit: Habit): number {
  return habit.target || 1;
}

export function getPeriod(habit: Habit): Period {
  if (habit.periodUnit) {
    return { value: habit.periodValue || 1, unit: habit.periodUnit };
  }
  // Back-compat with the older day/week-only data shape.
  return { value: 1, unit: habit.timeframe === "week" ? "week" : "day" };
}

export function periodDays(period: Period): number {
  return period.value * UNIT_DAYS[period.unit];
}

export function periodPhrase(period: Period): string {
  return period.value === 1 ? period.unit : `${period.value} ${period.unit}s`;
}

// --- Stats ---

export function countOnDate(completions: string[], dateStr: string): number {
  return completions.filter((d) => d === dateStr).length;
}

/** Count completions in the `days`-day window ending on `endDate` (inclusive). */
export function countInWindow(completions: string[], endDate: Date, days: number): number {
  const start = new Date(endDate);
  start.setDate(start.getDate() - (days - 1));
  const startStr = formatDate(start);
  const endStr = formatDate(endDate);
  return completions.filter((d) => d >= startStr && d <= endStr).length;
}

/** Same window math as countInWindow, for a habit's restDays. */
export function restDaysInWindow(restDays: string[], endDate: Date, days: number): number {
  return countInWindow(restDays, endDate, days);
}

export function calcStreak(
  completions: string[],
  target: number,
  days: number,
  restDays: string[] = []
): number {
  let streak = 0;
  const cursor = new Date();
  const windowMet = (endDate: Date) =>
    countInWindow(completions, endDate, days) + restDaysInWindow(restDays, endDate, days) >= target;

  // If the current window's goal isn't met yet, the streak is still "alive" based on the
  // prior window — this "still alive until proven broken" leniency is intentional.
  if (!windowMet(cursor)) {
    cursor.setDate(cursor.getDate() - days);
  }

  while (windowMet(cursor)) {
    streak++;
    cursor.setDate(cursor.getDate() - days);
  }

  return streak;
}

/** Longest-ever run of consecutive met periods, scanning all the way back to the first completion. */
export function longestStreak(habit: Habit): number {
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
// A configurable number of rest days per calendar month, per habit (default 3), derived from
// restDays — no stored counter.

export function currentYearMonth(): string {
  return todayKey().slice(0, 7);
}

export function getRestDayAllowance(habit: Habit): number {
  return habit.restDayAllowance || 3;
}

export function restDaysUsedThisMonth(habit: Habit): number {
  return (habit.restDays || []).filter((d) => d.startsWith(currentYearMonth())).length;
}

export function restDaysLeft(habit: Habit): number {
  return Math.max(0, getRestDayAllowance(habit) - restDaysUsedThisMonth(habit));
}

/**
 * The current period-in-progress, anchored to the habit's creation date (since the underlying
 * streak math is a pure rolling window with no calendar anchor of its own). Returns how many
 * days remain before this period chunk ends.
 */
export function periodDaysLeft(habit: Habit, days: number): number {
  const created = habit.createdAt ? parseDateKey(habit.createdAt) : new Date();
  const today = new Date();
  const daysSinceCreation = Math.floor((today.getTime() - created.getTime()) / 86400000);
  const daysIntoPeriod = ((daysSinceCreation % days) + days) % days;
  return days - 1 - daysIntoPeriod;
}

/**
 * The most recently-completed period chunk before the current one, using the same
 * creation-anchored period grid as periodDaysLeft.
 */
export function previousPeriodWindow(habit: Habit, days: number): Date {
  const daysLeft = periodDaysLeft(habit, days);
  const currentWindowEnd = new Date();
  currentWindowEnd.setDate(currentWindowEnd.getDate() + daysLeft);
  const previousWindowEnd = new Date(currentWindowEnd);
  previousWindowEnd.setDate(previousWindowEnd.getDate() - days);
  return previousWindowEnd;
}

export function totalCompletions(habit: Habit): number {
  return habit.completions.length;
}

/** Percentage of elapsed periods (since the first completion) where the target was met. */
export function completionRate(habit: Habit): number {
  const completions = habit.completions;
  if (completions.length === 0) return 0;

  const period = getPeriod(habit);
  const days = periodDays(period);
  const target = getTarget(habit);
  const firstDate = parseDateKey([...completions].sort()[0]);
  const spanDays = Math.floor((new Date().getTime() - firstDate.getTime()) / 86400000) + 1;
  const totalPeriods = Math.max(1, Math.ceil(spanDays / days));

  let metPeriods = 0;
  const cursor = new Date();
  for (let i = 0; i < totalPeriods; i++) {
    if (countInWindow(completions, cursor, days) >= target) metPeriods++;
    cursor.setDate(cursor.getDate() - days);
  }
  return Math.round((metPeriods / totalPeriods) * 100);
}

export interface HeatmapDay {
  date: string;
  count: number;
}

/** Rolling `weeks * 7`-day window ending today, grouped into weeks of 7 (oldest first). */
export function buildHeatmap(completions: string[], weeks = 12): HeatmapDay[][] {
  const totalDays = weeks * 7;
  const days: HeatmapDay[] = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d);
    days.push({ date: dateStr, count: countOnDate(completions, dateStr) });
  }
  const weeksArr: HeatmapDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeksArr.push(days.slice(i, i + 7));
  }
  return weeksArr;
}

export function heatmapLevel(count: number, fairShare: number): number {
  if (count <= 0) return 0;
  const ratio = count / fairShare;
  if (ratio >= 2) return 4;
  if (ratio >= 1) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

export interface AtRiskInfo {
  habit: Habit;
  remaining: number;
  daysLeft: number;
  streak: number;
}

/**
 * A habit is "at risk" when its current window can still be met but is behind pace. At most
 * one candidate is returned — the longest current streak wins ties.
 */
export function pickAtRiskHabit(habits: Habit[]): AtRiskInfo | null {
  let best: AtRiskInfo | null = null;
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

export function numberWord(n: number): string {
  const words = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  return n < words.length ? words[n] : String(n);
}

export function atRiskPillText(remaining: number, daysLeft: number): string {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + daysLeft);
  const weekday = deadline.toLocaleDateString("en-US", { weekday: "long" });
  return `${numberWord(remaining)} more by ${weekday}`;
}

export function restOfferPeriodKey(habit: Habit, days: number): string {
  return formatDate(previousPeriodWindow(habit, days));
}

export interface RestOfferInfo {
  habit: Habit;
  days: number;
  target: number;
  blankDates: string[];
  windowStart: Date;
  windowEnd: Date;
  key: string;
  streak: number;
}

/**
 * Picks the most-deserving candidate (largest current streak) rather than the first
 * qualifying habit in array order. A deficit of more than one day can be repaired too,
 * spending up to as many rest days as are both needed and available.
 */
export function pickRestOfferHabit(habits: Habit[], dismissedKeys: Set<string>): RestOfferInfo | null {
  let best: RestOfferInfo | null = null;
  for (const habit of habits) {
    const period = getPeriod(habit);
    const days = periodDays(period);
    const target = getTarget(habit);
    const restDays = habit.restDays || [];
    const prevWindowEnd = previousPeriodWindow(habit, days);
    if (habit.createdAt && formatDate(prevWindowEnd) < habit.createdAt) continue;
    const prevCount = countInWindow(habit.completions, prevWindowEnd, days);
    const alreadyRested = restDaysInWindow(restDays, prevWindowEnd, days) > 0;
    const deficit = target - prevCount;
    const key = `${habit.id}:${restOfferPeriodKey(habit, days)}`;
    const available = restDaysLeft(habit);

    if (deficit >= 1 && !alreadyRested && available > 0 && !dismissedKeys.has(key)) {
      const windowStart = new Date(prevWindowEnd);
      windowStart.setDate(windowStart.getDate() - (days - 1));
      const need = Math.min(deficit, available);
      const blankDates: string[] = [];
      for (const d = new Date(prevWindowEnd); d >= windowStart; d.setDate(d.getDate() - 1)) {
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

/** Whether every habit's current period goal was actually met on the given date (no rest days folded in). */
export function allHabitsMetOnDate(habits: Habit[], date: Date): boolean {
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

export function allHabitsMetToday(habits: Habit[]): boolean {
  return allHabitsMetOnDate(habits, new Date());
}

/** Consecutive days ending today where every habit's goal was actually met. */
export function currentPerfectDayStreak(habits: Habit[]): number {
  if (habits.length === 0) return 0;
  const earliestCreated = habits.reduce<string | null>((min, h) => {
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

/** Completion rate across all habits within the trailing 12-week (84-day) window. */
export function last12WeeksRate(habits: Habit[]): number {
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

/** Legacy habits with no createdAt get "today" as a fallback every load unless backfilled. */
export function backfillCreatedAt(habit: Habit): boolean {
  if (habit.createdAt) return false;
  const sorted = [...habit.completions].sort();
  habit.createdAt = sorted.length > 0 ? sorted[0] : todayKey();
  return true;
}

// --- Row <-> Habit conversion (DB shape uses snake_case) ---

export interface HabitRow {
  id: string;
  user_id?: string;
  name: string;
  target: number;
  period_value: number;
  period_unit: PeriodUnit;
  created_at: string | null;
  completions: string[];
  milestones_hit: number[];
  rest_days: string[];
  archived_at: string | null;
  rest_day_allowance: number;
  shared?: boolean;
  position?: number;
}

export function habitToRow(habit: Habit, userId: string): Omit<HabitRow, "position"> {
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
    shared: habit.shared || false,
  };
}

export function rowToHabit(row: HabitRow): Habit {
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
    shared: row.shared || false,
  };
}

export function newHabit(
  name: string,
  target: number,
  periodValue: number,
  periodUnit: PeriodUnit,
  shared = false
): Habit {
  return {
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
    shared,
  };
}
