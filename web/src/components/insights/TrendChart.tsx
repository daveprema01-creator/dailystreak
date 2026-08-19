import { computeWeeklyTrend, formatWeekTitle } from "../../lib/insights";
import type { Habit } from "../../lib/habits";

interface TrendChartProps {
  habits: Habit[];
}

export function TrendChart({ habits }: TrendChartProps) {
  const buckets = computeWeeklyTrend(habits, 12);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const w = 600;
  const h = 160;
  const gap = 4;
  const barWidth = (w - gap * (buckets.length - 1)) / buckets.length;

  return (
    <div className="analytics-trend-chart">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="trend-chart-svg"
        role="img"
        aria-label={`Completions per week over the last ${buckets.length} weeks`}
      >
        {buckets.map((b, i) => {
          const barH = Math.max((b.count / max) * (h - 24), b.count > 0 ? 2 : 0);
          const x = i * (barWidth + gap);
          const y = h - barH - 20;
          return (
            <rect key={i} x={x} y={y} width={barWidth} height={barH} rx={2} className="trend-bar">
              <title>{formatWeekTitle(b)}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}
