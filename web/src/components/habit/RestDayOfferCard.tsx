import {
  calcStreak,
  countOnDate,
  formatDate,
  getPeriod,
  parseDateKey,
  periodPhrase,
  type RestOfferInfo,
} from "../../lib/habits";

const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface RestDayOfferCardProps {
  offer: RestOfferInfo;
  onUse: () => void;
  onDismiss: () => void;
}

export function RestDayOfferCard({ offer, onUse, onDismiss }: RestDayOfferCardProps) {
  const { habit, days, target, blankDates, windowStart, windowEnd } = offer;

  const previewRestDays = [...(habit.restDays || []), ...blankDates];
  const streak = calcStreak(habit.completions, target, days, previewRestDays);

  const blankText =
    blankDates.length === 1
      ? `${parseDateKey(blankDates[0]).toLocaleDateString("en-US", { weekday: "long" })} is blank`
      : `${blankDates.length} days blank`;

  const railDays: { date: string; isDone: boolean; isRepairable: boolean; weekday: string }[] = [];
  for (const d = new Date(windowStart); d <= windowEnd; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    railDays.push({
      date: dateStr,
      isDone: countOnDate(habit.completions, dateStr) > 0,
      isRepairable: blankDates.includes(dateStr),
      weekday: WEEKDAY_ABBR[d.getDay()],
    });
  }

  return (
    <div className="habit-card habit-offer-card" data-id={habit.id}>
      <div className="offer-title-row">
        <span className="offer-habit-name">{habit.name}</span>
        <div className="offer-streak">
          <span className="offer-streak-numeral">{streak}</span>
          <span className="offer-streak-label">{streak === 1 ? "day" : "days"}</span>
        </div>
      </div>
      <div className="offer-meta">
        {target}× every {periodPhrase(getPeriod(habit))} · {blankText}
      </div>
      <div className="offer-week-rail">
        {railDays.map((d) => (
          <div className="offer-week-day" key={d.date}>
            <div className={`offer-week-block${d.isDone ? " done" : ""}${d.isRepairable ? " repairable" : ""}`} />
            <div className="offer-week-label">{d.weekday}</div>
          </div>
        ))}
      </div>
      <p className="offer-copy">Spend a rest day to keep the streak going, or let the count start again from today.</p>
      <div className="offer-actions">
        <button type="button" className="offer-use-btn" onClick={onUse}>
          {blankDates.length === 1 ? "Use a rest day" : `Use ${blankDates.length} rest days`}
        </button>
        <button type="button" className="offer-reset-btn" onClick={onDismiss}>
          Let it reset
        </button>
      </div>
    </div>
  );
}
