import { Link } from "react-router-dom";
import { currentPerfectDayStreak, last12WeeksRate, longestStreak, restDaysLeft, getPeriod, getTarget, countOnDate, countInWindow, periodDays, todayKey, type Habit } from "../../lib/habits";
import { useSessionStore } from "../../store/sessionStore";
import { useDisplayName } from "../../hooks/useSession";
import { useOwnProfile } from "../../hooks/useProfile";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar } from "../ui/Avatar";

function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

interface HeroBandProps {
  habits: Habit[]; // active (non-archived) habits only
}

export function HeroBand({ habits }: HeroBandProps) {
  const user = useSessionStore((s) => s.user);
  const name = useDisplayName();
  const { profile: ownProfile } = useOwnProfile();

  let longestHabit: Habit | null = null;
  let longestValue = -1;
  habits.forEach((habit) => {
    const value = longestStreak(habit);
    if (value > longestValue) {
      longestValue = value;
      longestHabit = habit;
    }
  });
  const longestPeriod = longestHabit ? getPeriod(longestHabit) : null;
  const unitWord = longestPeriod ? (longestPeriod.unit === "day" ? "days" : longestPeriod.unit === "week" ? "weeks" : "months") : "days";

  const doneToday = habits.filter((habit) => {
    const period = getPeriod(habit);
    const days = periodDays(period);
    const target = getTarget(habit);
    const count = days === 1 ? countOnDate(habit.completions, todayKey()) : countInWindow(habit.completions, new Date(), days);
    return count >= target;
  }).length;

  const restTotal = habits.reduce((sum, h) => sum + restDaysLeft(h), 0);
  const perfectDays = currentPerfectDayStreak(habits);
  const rate = last12WeeksRate(habits);

  return (
    <header className="hero-band">
      {name && <p className="greeting visible">{`${getTimeOfDayGreeting()}, ${name}!`}</p>}
      <div className="hero-top">
        <span className="hero-brand">Daily Streak</span>
        <nav className="hero-top-right" aria-label="Account and view controls">
          <Link to="/insights" className="hero-text-btn">
            Insights
          </Link>
          <Link to="/review" className="hero-text-btn">
            Weekly review
          </Link>
          {user && (
            <Link to="/friends" className="hero-text-btn">
              Friends
            </Link>
          )}
          <Link
            to={user ? "/settings" : "/sign-in"}
            className={`account-btn${user ? " signed-in" : ""}`}
            style={user ? { display: "inline-flex", alignItems: "center", gap: 8 } : undefined}
          >
            {user && <Avatar avatarUrl={ownProfile?.avatarUrl} name={name || user.email || "?"} size={22} />}
            {user ? name || user.email : "Sign in to sync"}
          </Link>
          <ThemeToggle />
        </nav>
      </div>
      <div className="hero-main">
        <div className="hero-longest">
          <div className="hero-eyebrow">{longestHabit ? `Longest run · ${(longestHabit as Habit).name}` : "Longest run"}</div>
          <div className="hero-longest-value">
            <span className="hero-numeral">{habits.length === 0 ? 0 : longestValue}</span>
            <span className="hero-longest-unit">{unitWord} unbroken</span>
          </div>
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-value">{`${doneToday}/${habits.length}`}</span>
            <span className="hero-stat-label">done today</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-value">{`${habits.length === 0 ? 0 : rate}%`}</span>
            <span className="hero-stat-label">last 12 weeks</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-value">{habits.length === 0 ? 0 : restTotal}</span>
            <span className="hero-stat-label">rest days left</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-value">{habits.length === 0 ? 0 : perfectDays}</span>
            <span className="hero-stat-label">perfect days</span>
          </div>
        </div>
      </div>
    </header>
  );
}
