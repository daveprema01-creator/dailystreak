import { useHabits } from "../hooks/useHabits";
import { calcStreak, completionRate, getPeriod, getTarget, longestStreak, periodDays, totalCompletions } from "../lib/habits";
import { PageShell } from "../components/layout/PageShell";
import { TrendChart } from "../components/insights/TrendChart";

export function Insights() {
  const { activeHabits } = useHabits();

  if (activeHabits.length === 0) {
    return (
      <PageShell>
        <div className="review-eyebrow">Insights</div>
        <h2 className="review-headline">Trends across all habits</h2>
        <p className="review-lead">See how your completions and streaks have moved over time.</p>
        <p className="empty-state" style={{ display: "block" }}>
          Add a habit to start building your insights.
        </p>
      </PageShell>
    );
  }

  const sorted = [...activeHabits].sort((a, b) => longestStreak(b) - longestStreak(a));

  return (
    <PageShell>
      <div className="review-eyebrow">Insights</div>
      <h2 className="review-headline">Trends across all habits</h2>
      <p className="review-lead">See how your completions and streaks have moved over time.</p>

      <div className="analytics-section">
        <h3 className="analytics-section-title">Completions per week · last 12 weeks</h3>
        <TrendChart habits={activeHabits} />
      </div>

      <div className="analytics-section">
        <h3 className="analytics-section-title">Completion rate by habit</h3>
        <div className="analytics-rate-bars">
          {activeHabits.map((habit) => {
            const rate = completionRate(habit);
            return (
              <div className="analytics-rate-row" key={habit.id}>
                <div className="analytics-rate-label">{habit.name}</div>
                <div className="analytics-rate-track">
                  <div className="analytics-rate-fill" style={{ width: `${rate}%` }} />
                </div>
                <div className="analytics-rate-value">{rate}%</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="analytics-section">
        <h3 className="analytics-section-title">Streaks</h3>
        <div className="analytics-streak-table">
          {sorted.map((habit) => {
            const period = getPeriod(habit);
            const days = periodDays(period);
            return (
              <div className="analytics-streak-row" key={habit.id}>
                <span className="analytics-streak-name">{habit.name}</span>
                <span className="analytics-streak-figure">
                  {calcStreak(habit.completions, getTarget(habit), days, habit.restDays || [])} current
                </span>
                <span className="analytics-streak-figure">{longestStreak(habit)} longest</span>
                <span className="analytics-streak-figure">{totalCompletions(habit)} total</span>
              </div>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
