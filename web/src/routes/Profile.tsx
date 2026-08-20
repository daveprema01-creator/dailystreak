import { Link, useParams } from "react-router-dom";
import { useSessionStore } from "../store/sessionStore";
import { useOwnProfile, useProfileByUsername } from "../hooks/useProfile";
import { useSharedHabits } from "../hooks/useSharedHabits";
import { useFollowersList, useFollowingList, useFollowCounts } from "../hooks/useFollows";
import { useHabits } from "../hooks/useHabits";
import { PageShell } from "../components/layout/PageShell";
import { FollowButton } from "../components/social/FollowButton";
import { SharedHabitCard } from "../components/social/SharedHabitCard";
import { Avatar } from "../components/ui/Avatar";
import type { Profile as ProfileData } from "../api/profilesApi";

interface ProfileStats {
  followers: number;
  following: number;
  habits: number;
}

function ProfileCard({
  profile,
  actions,
  stats,
}: {
  profile: ProfileData;
  actions?: React.ReactNode;
  stats: ProfileStats;
}) {
  return (
    <>
      <div className="review-eyebrow">Profile</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
        <Avatar avatarUrl={profile.avatarUrl} name={profile.displayName || profile.username} size={56} />
        <h2 className="review-headline" style={{ margin: 0 }}>
          @{profile.username}
        </h2>
      </div>
      <p className="review-lead">{profile.displayName || "No display name set."}</p>

      <div className="history-stats" style={{ maxWidth: 480 }}>
        <div className="history-stat">
          <span className="history-stat-value">{stats.followers}</span>
          <span className="history-stat-label">Followers</span>
        </div>
        <div className="history-stat">
          <span className="history-stat-value">{stats.following}</span>
          <span className="history-stat-label">Following</span>
        </div>
        <div className="history-stat">
          <span className="history-stat-value">{stats.habits}</span>
          <span className="history-stat-label">Habits</span>
        </div>
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

      {actions && <div style={{ marginTop: 16 }}>{actions}</div>}
    </>
  );
}

export function Profile() {
  const { username } = useParams<{ username: string }>();
  const user = useSessionStore((s) => s.user);
  const { profile: ownProfile, isLoading: ownLoading } = useOwnProfile();
  const isOwn = !!ownProfile && ownProfile.username === username;

  const { profile: otherProfile, isLoading: otherLoading } = useProfileByUsername(isOwn ? undefined : username);
  const { habits: sharedHabits } = useSharedHabits(isOwn ? undefined : otherProfile?.id);

  const { followers: ownFollowers } = useFollowersList();
  const { following: ownFollowing } = useFollowingList();
  const { activeHabits: ownActiveHabits } = useHabits();
  const { counts: otherCounts } = useFollowCounts(isOwn ? undefined : otherProfile?.id);

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

  if (ownLoading || (!isOwn && otherLoading)) {
    return (
      <PageShell>
        <div className="review-eyebrow">Profile</div>
        <h2 className="review-headline">Loading…</h2>
      </PageShell>
    );
  }

  if (isOwn) {
    return (
      <PageShell>
        <ProfileCard
          profile={ownProfile}
          stats={{ followers: ownFollowers.length, following: ownFollowing.length, habits: ownActiveHabits.length }}
          actions={
            <Link to="/settings" className="review-set-targets" style={{ textDecoration: "none", display: "inline-block" }}>
              Edit profile
            </Link>
          }
        />
      </PageShell>
    );
  }

  if (!otherProfile) {
    return (
      <PageShell>
        <div className="review-eyebrow">Profile</div>
        <h2 className="review-headline">@{username}</h2>
        <p className="review-lead">No account with this username.</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ProfileCard
        profile={otherProfile}
        stats={{ followers: otherCounts.followers, following: otherCounts.following, habits: sharedHabits.length }}
        actions={<FollowButton targetId={otherProfile.id} />}
      />
      {sharedHabits.length > 0 && (
        <div className="habit-list" style={{ marginTop: 24 }}>
          {sharedHabits.map((habit) => (
            <SharedHabitCard key={habit.id} habit={habit} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
