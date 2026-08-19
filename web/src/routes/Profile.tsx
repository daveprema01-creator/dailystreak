import { Link, useParams } from "react-router-dom";
import { useSessionStore } from "../store/sessionStore";
import { useOwnProfile } from "../hooks/useProfile";
import { PageShell } from "../components/layout/PageShell";

/**
 * Phase B scope: self-view only. Viewing anyone else's profile (with real shared-habit
 * content) is Phase C/D — visiting someone else's username here just explains that, rather
 * than crashing or silently showing nothing.
 */
export function Profile() {
  const { username } = useParams<{ username: string }>();
  const user = useSessionStore((s) => s.user);
  const { profile, isLoading } = useOwnProfile();

  if (!user) {
    return (
      <PageShell>
        <div className="review-eyebrow">Profile</div>
        <h2 className="review-headline">Sign in required</h2>
        <p className="review-lead">
          Profiles are only for signed-in accounts.{" "}
          <Link to="/sign-in" className="link-btn" style={{ textDecoration: "none" }}>
            Sign in
          </Link>{" "}
          to set one up.
        </p>
      </PageShell>
    );
  }

  if (isLoading) {
    return (
      <PageShell>
        <div className="review-eyebrow">Profile</div>
        <h2 className="review-headline">Loading…</h2>
      </PageShell>
    );
  }

  const isOwn = !!profile && profile.username === username;

  if (!isOwn) {
    return (
      <PageShell>
        <div className="review-eyebrow">Profile</div>
        <h2 className="review-headline">@{username}</h2>
        <p className="review-lead">
          Viewing other people's profiles isn't available yet — that's coming with the follow system.
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="review-eyebrow">Profile</div>
      <h2 className="review-headline">@{profile.username}</h2>
      <p className="review-lead">{profile.displayName || "No display name set."}</p>

      <div className="history-stats" style={{ maxWidth: 480 }}>
        <div className="history-stat">
          <span className="history-stat-value" style={{ fontSize: "1rem" }}>
            {profile.isPublic ? "Public" : "Private"}
          </span>
          <span className="history-stat-label">Account</span>
        </div>
      </div>

      {profile.bio && (
        <p className="review-lead" style={{ fontSize: "1rem", marginTop: 8 }}>
          {profile.bio}
        </p>
      )}

      <Link to="/settings" className="review-set-targets" style={{ textDecoration: "none", display: "inline-block", marginTop: 16 }}>
        Edit profile
      </Link>
    </PageShell>
  );
}
