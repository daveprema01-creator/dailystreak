import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { useSessionStore } from "../store/sessionStore";
import { useActivityFeed } from "../hooks/useActivityFeed";
import { useProfilesByIds } from "../hooks/useProfile";
import { parseDateKey } from "../lib/habits";

export function Feed() {
  const user = useSessionStore((s) => s.user);
  const { events, isLoading } = useActivityFeed();
  const { profiles } = useProfilesByIds(events.map((e) => e.userId));

  if (!user) {
    return (
      <PageShell>
        <div className="review-eyebrow">Feed</div>
        <h2 className="review-headline">Sign in required</h2>
        <p className="review-lead">
          The activity feed is only for signed-in accounts.{" "}
          <Link to="/sign-in" className="link-btn" style={{ textDecoration: "none" }}>
            Sign in
          </Link>
          .
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="review-eyebrow">Feed</div>
      <h2 className="review-headline">Friend activity</h2>

      {isLoading && <p className="review-lead">Loading…</p>}

      {!isLoading && events.length === 0 && (
        <p className="review-lead">
          Nothing yet — milestones from people you follow who share their habits will show up here.
        </p>
      )}

      <div className="friend-list">
        {events.map((event) => {
          const profile = profiles.get(event.userId);
          const dateLabel = parseDateKey(event.occurredAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          return (
            <div className="friend-row" key={event.id}>
              <div className="friend-row-identity">
                <span style={{ fontSize: "0.9rem", color: "var(--text)" }}>
                  {profile ? (
                    <Link to={`/u/${profile.username}`} className="friend-row-name" style={{ display: "inline" }}>
                      {profile.displayName || profile.username}
                    </Link>
                  ) : (
                    "Someone you follow"
                  )}{" "}
                  hit a {event.milestone}-day streak on "{event.habitName}"
                </span>
                <span className="friend-row-username">{dateLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
