// Ported from the vanilla app's weekly-review section. A Sunday-evening recap of the most
// recently completed Monday–Sunday week. The underlying streak math has no calendar anchor
// (see periodDaysLeft in habits.ts), so the review's week boundary is a display-only
// convention layered on top, not a change to that math.

import {
  countInWindow,
  countOnDate,
  formatDate,
  getPeriod,
  getTarget,
  numberWord,
  parseDateKey,
  periodDays,
  periodPhrase,
  type Habit,
  type Period,
} from "./habits";

export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** offset 0 = the most recently completed week, 1 = the week before that, etc. */
export function getReviewWeekRange(offset = 0): { weekStart: Date; weekEnd: Date } {
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() - today.getDay() - offset * 7);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekStart.getDate() - 6);
  return { weekStart, weekEnd };
}

export function formatReviewDateRange(weekStart: Date, weekEnd: Date): string {
  const startMonth = weekStart.toLocaleDateString("en-US", { month: "long" });
  const endMonth = weekEnd.toLocaleDateString("en-US", { month: "long" });
  if (startMonth === endMonth) {
    return `${weekStart.getDate()}–${weekEnd.getDate()} ${endMonth}`;
  }
  return `${weekStart.getDate()} ${startMonth} – ${weekEnd.getDate()} ${endMonth}`;
}

export interface ReviewCell {
  date: string;
  state: "done" | "rested" | "blank";
}

export interface ReviewRow {
  habit: Habit;
  period: Period;
  cells: ReviewCell[];
  weekCount: number;
  weekTarget: number;
  held: boolean;
  deltaLabel: string;
}

export function computeWeeklyReviewRows(habits: Habit[], weekStart: Date, weekEnd: Date): ReviewRow[] {
  const prevWeekEnd = new Date(weekStart);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);

  return habits.map((habit) => {
    const period = getPeriod(habit);
    const days = periodDays(period);
    const target = getTarget(habit);
    const restDays = habit.restDays || [];

    const cells: ReviewCell[] = [];
    for (const d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
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

export function reviewHeadlineText(rows: ReviewRow[]): string {
  const held = rows.filter((r) => r.held).length;
  const slipped = rows.length - held;
  if (rows.length === 0) return "Nothing to review yet.";
  if (slipped === 0) return "All held.";
  if (held === 0) return "All slipped.";
  return `${numberWord(held)} held. ${numberWord(slipped)} slipped.`;
}

export function reviewLeadText(rows: ReviewRow[]): string {
  if (rows.length === 0) return "Add a habit to start building your weekly recap.";
  const held = rows.filter((r) => r.held).length;
  return `You kept ${held} of ${rows.length} habit${rows.length === 1 ? "" : "s"} on pace this week.`;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface ReviewTiles {
  tile1Value: string;
  tile1Label: string;
  tile2Value: string;
  tile2Label: string;
}

export function computeTiles(rows: ReviewRow[]): ReviewTiles {
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

export interface DriftInfo {
  habit: Habit;
  medianGap: number;
  ratio: number;
  suggestedValue: number;
  suggestedUnit: "day" | "week";
}

/** Median gap between completions in the trailing 12 weeks, compared against the habit's own cadence. */
export function computeDrift(habits: Habit[]): DriftInfo | null {
  let best: DriftInfo | null = null;
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 83);
  const startStr = formatDate(windowStart);

  habits.forEach((habit) => {
    const period = getPeriod(habit);
    const days = periodDays(period);
    const dates = [...new Set(habit.completions.filter((d) => d >= startStr))].sort();
    if (dates.length < 6) return;

    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push(Math.round((parseDateKey(dates[i]).getTime() - parseDateKey(dates[i - 1]).getTime()) / 86400000));
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

export { periodPhrase };
