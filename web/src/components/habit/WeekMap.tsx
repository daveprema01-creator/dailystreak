import { buildHeatmap, getPeriod, getTarget, heatmapLevel, periodDays, todayKey, type Habit } from "../../lib/habits";

interface WeekMapProps {
  habit: Habit;
  /** Card-sized 9px cells (default) vs the larger 13px cells used in the history view. */
  size?: "card" | "large";
  /** Omit to render read-only (e.g. viewing someone else's shared habit later). */
  onToggleDate?: (dateStr: string) => void;
}

/**
 * The 12-week map — reused on the personal dashboard card and (larger) in the history view.
 * Blank/filled past cells are clickable to backfill or undo a completion for that specific
 * day, unless onToggleDate is omitted.
 */
export function WeekMap({ habit, size = "card", onToggleDate }: WeekMapProps) {
  const period = getPeriod(habit);
  const days = periodDays(period);
  const target = getTarget(habit);
  const fairShare = target / days;
  const restDays = habit.restDays || [];
  const weeksData = buildHeatmap(habit.completions, 12);
  const today = todayKey();
  const cellClass = size === "large" ? "heatmap-cell" : "map-cell";
  const containerClass = size === "large" ? "heatmap" : "habit-map";

  return (
    <div className={containerClass}>
      {weeksData.map((week, wi) =>
        week.map(({ date, count }) => {
          const isRested = restDays.includes(date);
          const beforeCreation = !!habit.createdAt && date < habit.createdAt;
          const level = heatmapLevel(count, fairShare);
          const classes = [
            cellClass,
            isRested ? "rested" : beforeCreation && size === "large" ? "before-creation" : `level-${level}`,
            date === today && size === "card" ? "today" : "",
            onToggleDate && !isRested && !beforeCreation ? "clickable" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const label = isRested
            ? `${date}: rested`
            : `${date}: ${count} completion${count === 1 ? "" : "s"}`;

          if (onToggleDate && !isRested && !beforeCreation) {
            return (
              <span
                key={`${wi}-${date}`}
                className={classes}
                role="button"
                tabIndex={0}
                title={label}
                aria-label={`${label}. ${count > 0 ? "Remove" : "Log"} a completion.`}
                onClick={() => onToggleDate(date)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggleDate(date);
                  }
                }}
              />
            );
          }

          return <span key={`${wi}-${date}`} className={classes} title={label} />;
        })
      )}
    </div>
  );
}
