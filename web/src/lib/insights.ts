import { countInWindow, formatDate, type Habit } from "./habits";

export interface WeeklyBucket {
  weekEnd: Date;
  count: number;
}

export function computeWeeklyTrend(habits: Habit[], weeks = 12): WeeklyBucket[] {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const buckets: WeeklyBucket[] = [];
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

export function formatWeekTitle(b: WeeklyBucket): string {
  return `Week of ${formatDate(b.weekEnd)}: ${b.count} completion${b.count === 1 ? "" : "s"}`;
}
