import { useState, type DragEvent } from "react";
import {
  atRiskPillText,
  calcStreak,
  countInWindow,
  countOnDate,
  formatDate,
  getPeriod,
  getTarget,
  parseDateKey,
  periodDays,
  periodPhrase,
  previousPeriodWindow,
  todayKey,
  type AtRiskInfo,
  type Habit,
} from "../../lib/habits";
import { WeekMap } from "./WeekMap";

interface HabitCardProps {
  habit: Habit;
  atRisk: AtRiskInfo | null;
  onComplete: (id: string) => void;
  onUndo: (id: string) => void;
  onEdit: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleDate: (id: string, dateStr: string) => void;
  onViewHistory: (id: string) => void;
  draggable?: boolean;
  onDragStart?: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: DragEvent<HTMLDivElement>) => void;
  dragging?: boolean;
}

function restedPillText(habit: Habit, days: number): string | null {
  const prevWindowEnd = previousPeriodWindow(habit, days);
  const prevWindowStart = new Date(prevWindowEnd);
  prevWindowStart.setDate(prevWindowStart.getDate() - (days - 1));
  const prevStartStr = formatDate(prevWindowStart);
  const prevEndStr = formatDate(prevWindowEnd);
  const restedDate = (habit.restDays || [])
    .filter((d) => d >= prevStartStr && d <= prevEndStr)
    .sort()
    .pop();
  if (!restedDate) return null;
  const weekday = parseDateKey(restedDate).toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday} rested`;
}

export function HabitCard({
  habit,
  atRisk,
  onComplete,
  onUndo,
  onEdit,
  onArchive,
  onDelete,
  onToggleDate,
  onViewHistory,
  draggable,
  onDragStart,
  onDragOver,
  onDragEnd,
  dragging,
}: HabitCardProps) {
  const [celebrating, setCelebrating] = useState(false);

  const target = getTarget(habit);
  const period = getPeriod(habit);
  const days = periodDays(period);
  const isDaily = days === 1;
  const periodCount = isDaily
    ? countOnDate(habit.completions, todayKey())
    : countInWindow(habit.completions, new Date(), days);
  const streak = calcStreak(habit.completions, target, days, habit.restDays || []);
  const goalMet = periodCount >= target;
  const isAtRisk = atRisk?.habit.id === habit.id;
  const pillText = isAtRisk ? atRiskPillText(atRisk.remaining, atRisk.daysLeft) : restedPillText(habit, days);

  const metaText = isDaily
    ? `${target}× every ${periodPhrase(period)} · ${periodCount} of ${target} today`
    : `${target}× every ${periodPhrase(period)} · ${periodCount} of ${target} in the last ${periodPhrase(period)}`;

  const completeLabel =
    target === 1 && isDaily ? (goalMet ? "Done for today ✓" : "Mark today done") : goalMet ? "Mark done ✓" : "Mark done";

  return (
    <div
      className={`habit-card${isAtRisk ? " at-risk" : ""}${celebrating ? " celebrate" : ""}`}
      data-id={habit.id}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      style={dragging ? { opacity: 0.4 } : undefined}
    >
      <div className="habit-card-title-row">
        <button type="button" className="habit-name" title="View history" onClick={() => onViewHistory(habit.id)}>
          {habit.name}
        </button>
        <div className="habit-card-controls">
          <button className="edit-btn" title="Edit habit" aria-label="Edit habit" onClick={() => onEdit(habit.id)}>
            ✎
          </button>
          <button className="archive-btn" title="Archive habit" aria-label="Archive habit" onClick={() => onArchive(habit.id)}>
            ⏸
          </button>
          <button className="delete-btn" title="Delete habit" aria-label="Delete habit" onClick={() => onDelete(habit.id)}>
            ✕
          </button>
          <span className="habit-streak-numeral">{streak}</span>
        </div>
      </div>
      <div className="habit-meta">{metaText}</div>
      <WeekMap habit={habit} onToggleDate={(dateStr) => onToggleDate(habit.id, dateStr)} />
      {pillText && <div className={`habit-pill${isAtRisk ? " on-ink" : ""}`}>{pillText}</div>}
      <div className="habit-actions">
        <button
          className={`complete-btn${goalMet ? " done" : ""}`}
          disabled={goalMet}
          onClick={() => {
            onComplete(habit.id);
            setCelebrating(true);
            setTimeout(() => setCelebrating(false), 400);
          }}
        >
          {completeLabel}
        </button>
        <button
          className={`undo-btn${periodCount > 0 ? " visible" : ""}`}
          title="Undo last completion"
          onClick={() => onUndo(habit.id)}
        >
          Undo
        </button>
      </div>
    </div>
  );
}
