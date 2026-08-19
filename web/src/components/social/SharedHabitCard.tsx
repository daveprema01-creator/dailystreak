import {
  calcStreak,
  countInWindow,
  countOnDate,
  getPeriod,
  getTarget,
  periodDays,
  periodPhrase,
  todayKey,
  type Habit,
} from "../../lib/habits";
import { WeekMap } from "../habit/WeekMap";

/** Read-only — someone else's shared habit, shown on their /u/:username profile. */
export function SharedHabitCard({ habit }: { habit: Habit }) {
  const target = getTarget(habit);
  const period = getPeriod(habit);
  const days = periodDays(period);
  const isDaily = days === 1;
  const periodCount = isDaily
    ? countOnDate(habit.completions, todayKey())
    : countInWindow(habit.completions, new Date(), days);
  const streak = calcStreak(habit.completions, target, days, habit.restDays || []);

  const metaText = isDaily
    ? `${target}× every ${periodPhrase(period)} · ${periodCount} of ${target} today`
    : `${target}× every ${periodPhrase(period)} · ${periodCount} of ${target} in the last ${periodPhrase(period)}`;

  return (
    <div className="habit-card">
      <div className="habit-card-title-row">
        <span className="habit-name" style={{ cursor: "default" }}>
          {habit.name}
        </span>
        <div className="habit-card-controls">
          <span className="habit-streak-numeral">{streak}</span>
        </div>
      </div>
      <div className="habit-meta">{metaText}</div>
      <WeekMap habit={habit} />
    </div>
  );
}
