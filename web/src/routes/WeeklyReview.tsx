import { useMemo, useState } from "react";
import { useHabits } from "../hooks/useHabits";
import { getPeriod, getTarget, periodPhrase } from "../lib/habits";
import {
  computeDrift,
  computeTiles,
  computeWeeklyReviewRows,
  formatReviewDateRange,
  getReviewWeekRange,
  isoWeekNumber,
  reviewHeadlineText,
  reviewLeadText,
} from "../lib/weeklyReview";
import { PageShell } from "../components/layout/PageShell";

export function WeeklyReview() {
  const { activeHabits, saveHabitEdits } = useHabits();
  const [weekOffset, setWeekOffset] = useState(0);
  const [keptDrift, setKeptDrift] = useState(false);

  const { weekStart, weekEnd } = getReviewWeekRange(weekOffset);
  const rows = useMemo(() => computeWeeklyReviewRows(activeHabits, weekStart, weekEnd), [activeHabits, weekStart, weekEnd]);
  const tiles = computeTiles(rows);
  // Drift detection is about current pacing, not a past week — only show it on the most recent week.
  const drift = weekOffset === 0 && !keptDrift ? computeDrift(activeHabits) : null;

  return (
    <PageShell>
      <div className="review-eyebrow-row">
        <div className="review-eyebrow">
          Week {isoWeekNumber(weekEnd)} · {formatReviewDateRange(weekStart, weekEnd)}
        </div>
        <div className="review-week-nav">
          <button type="button" className="review-nav-btn" aria-label="Previous week" onClick={() => setWeekOffset((o) => o + 1)}>
            ‹
          </button>
          <button
            type="button"
            className="review-nav-btn"
            aria-label="Next week"
            disabled={weekOffset === 0}
            onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
          >
            ›
          </button>
        </div>
      </div>
      <h2 className="review-headline">{reviewHeadlineText(rows)}</h2>
      <p className="review-lead">{reviewLeadText(rows)}</p>

      <div className="review-table-wrap">
        <div className="review-table">
          <div className="review-table-header">
            <div className="review-col-habit">Habit</div>
            <div className="review-col-week">Week</div>
            <div className="review-col-hit">Hit</div>
            <div className="review-col-delta">vs last week</div>
          </div>
          <div>
            {rows.map((row) => (
              <div className="review-row" key={row.habit.id}>
                <div className="review-col-habit">
                  <div className="review-row-name">{row.habit.name}</div>
                  <div className="review-row-cadence">
                    {getTarget(row.habit)}× every {periodPhrase(row.period)}
                  </div>
                </div>
                <div className="review-col-week">
                  <div className="review-row-week">
                    {row.cells.map((cell) => (
                      <div key={cell.date} className={cell.state === "blank" ? "review-day-cell" : `review-day-cell ${cell.state}`} title={cell.date} />
                    ))}
                  </div>
                </div>
                <div className="review-col-hit">
                  {row.weekCount} / {row.weekTarget}
                </div>
                <div className="review-col-delta">{row.deltaLabel}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="review-legend">
        <span className="review-legend-item">
          <span className="review-swatch review-swatch-done" />
          Done
        </span>
        <span className="review-legend-item">
          <span className="review-swatch review-swatch-rested" />
          Rested
        </span>
        <span className="review-legend-item">
          <span className="review-swatch review-swatch-blank" />
          Blank
        </span>
      </div>

      <div className="review-tiles">
        <div className="review-tile">
          <div className="review-tile-value">{tiles.tile1Value}</div>
          <div className="review-tile-label">{tiles.tile1Label}</div>
        </div>
        <div className="review-tile">
          <div className="review-tile-value">{tiles.tile2Value}</div>
          <div className="review-tile-label">{tiles.tile2Label}</div>
        </div>
      </div>

      {drift && (
        <div className="review-drift">
          <div className="review-drift-left">
            <div className="review-drift-eyebrow">Drifting</div>
            <div className="review-drift-headline">
              {drift.habit.name} is set to every {periodPhrase(getPeriod(drift.habit))} but runs every {drift.suggestedValue}{" "}
              {drift.suggestedValue === 1 ? drift.suggestedUnit : `${drift.suggestedUnit}s`}
            </div>
            <p className="review-drift-body">Its actual pace has drifted from the target — updating the cadence keeps the streak honest.</p>
          </div>
          <div className="review-drift-right">
            <button
              type="button"
              className="review-drift-accept"
              onClick={() => {
                saveHabitEdits(drift.habit.id, {
                  name: drift.habit.name,
                  target: getTarget(drift.habit),
                  periodValue: drift.suggestedValue,
                  periodUnit: drift.suggestedUnit,
                });
                setKeptDrift(true);
              }}
            >
              Change to every {drift.suggestedValue} {drift.suggestedValue === 1 ? drift.suggestedUnit : `${drift.suggestedUnit}s`}
            </button>
            <button type="button" className="review-drift-keep" onClick={() => setKeptDrift(true)}>
              Keep {getTarget(drift.habit)}× every {periodPhrase(getPeriod(drift.habit))}
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
