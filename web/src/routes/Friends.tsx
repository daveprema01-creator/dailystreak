import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { Avatar } from "../components/ui/Avatar";
import { Modal } from "../components/ui/Modal";
import { useSessionStore } from "../store/sessionStore";
import { useFriendRequests, useFollowersList, useFollowingList } from "../hooks/useFollows";
import { useProfilesByIds } from "../hooks/useProfile";
import { useSharedHabits } from "../hooks/useSharedHabits";
import { useActivityFeed } from "../hooks/useActivityFeed";
import { FollowButton } from "../components/social/FollowButton";
import { SharedHabitCard } from "../components/social/SharedHabitCard";
import { searchProfilesByUsername, type Profile } from "../api/profilesApi";
import { parseDateKey } from "../lib/habits";

type Panel = "search" | "requests" | "followers" | null;

function FriendRow({
  userId,
  profile,
  actions,
}: {
  userId: string;
  profile: Profile | undefined;
  actions: React.ReactNode;
}) {
  return (
    <div className="friend-row" key={userId}>
      <div className="feed-row-content">
        <Avatar avatarUrl={profile?.avatarUrl} name={profile?.displayName || profile?.username || "?"} size={36} />
        <div className="friend-row-identity">
          {profile ? (
            <>
              <Link to={`/u/${profile.username}`} className="friend-row-name">
                {profile.displayName || profile.username}
              </Link>
              <span className="friend-row-username">@{profile.username}</span>
            </>
          ) : (
            <span className="friend-row-name">Unknown user</span>
          )}
        </div>
      </div>
      <div className="friend-row-actions">{actions}</div>
    </div>
  );
}

function UserSearch({ userId }: { userId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchProfilesByUsername(trimmed, userId);
        if (!cancelled) setResults(found);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, userId]);

  return (
    <div>
      <input
        type="text"
        placeholder="Find people by username…"
        autoComplete="off"
        className="friend-search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {searching && <p className="friend-empty">Searching…</p>}
      {!searching && query.trim().length >= 2 && results.length === 0 && (
        <p className="friend-empty">No one found.</p>
      )}
      {results.length > 0 && (
        <div className="friend-list" style={{ marginTop: 10 }}>
          {results.map((p) => (
            <FriendRow
              key={p.id}
              userId={p.id}
              profile={p}
              actions={<FollowButton targetId={p.id} />}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FriendStoryModal({
  profile,
  onClose,
  onUnfollow,
}: {
  profile: Profile | null;
  onClose: () => void;
  onUnfollow: (targetId: string) => void;
}) {
  const { habits, isLoading } = useSharedHabits(profile?.id);

  return (
    <Modal open={!!profile} onClose={onClose} wide>
      <button className="modal-close-btn" aria-label="Close" onClick={onClose}>
        ✕
      </button>
      {profile && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
            <Avatar avatarUrl={profile.avatarUrl} name={profile.displayName || profile.username} size={56} />
            <div>
              <h2 style={{ margin: 0 }}>{profile.displayName || profile.username}</h2>
              <span className="friend-row-username">@{profile.username}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <Link to={`/u/${profile.username}`} className="settings-link">
              View full profile
            </Link>
            <button
              type="button"
              className="friend-reject-btn"
              onClick={() => {
                onUnfollow(profile.id);
                onClose();
              }}
            >
              Unfollow
            </button>
          </div>

          {isLoading && <p className="friend-empty">Loading…</p>}
          {!isLoading && habits.length === 0 && (
            <p className="friend-empty">No shared habits yet.</p>
          )}
          {habits.length > 0 && (
            <div className="habit-list">
              {habits.map((habit) => (
                <SharedHabitCard key={habit.id} habit={habit} />
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

export function Friends() {
  const user = useSessionStore((s) => s.user);
  const [panel, setPanel] = useState<Panel>(null);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);

  const { requests, accept, reject } = useFriendRequests();
  const { following, unfollow } = useFollowingList();
  const { followers, remove: removeFollower } = useFollowersList();
  const { events, isLoading: feedLoading } = useActivityFeed();

  const allIds = [
    ...requests.map((r) => r.followerId),
    ...following.map((f) => f.followingId),
    ...followers.map((f) => f.followerId),
    ...events.map((e) => e.userId),
  ];
  const { profiles } = useProfilesByIds(allIds);

  const selectedProfile = selectedFriendId ? profiles.get(selectedFriendId) ?? null : null;

  if (!user) {
    return (
      <PageShell>
        <div className="review-eyebrow">Friends</div>
        <h2 className="review-headline">Sign in required</h2>
        <p className="review-lead">
          Following people is only for signed-in accounts.{" "}
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
      <div className="review-eyebrow">Friends</div>
      <h2 className="review-headline">Friends &amp; activity</h2>

      {following.length > 0 ? (
        <div className="friend-stories-row">
          {following.map((f) => {
            const p = profiles.get(f.followingId);
            return (
              <button
                key={f.id}
                type="button"
                className="friend-story-item"
                onClick={() => setSelectedFriendId(f.followingId)}
              >
                <Avatar avatarUrl={p?.avatarUrl} name={p?.displayName || p?.username || "?"} size={56} />
                <span className="friend-story-name">{p?.displayName || p?.username || "…"}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="friend-empty">
          Follow people to see their habits here.{" "}
          <button type="button" className="settings-link" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }} onClick={() => setPanel("search")}>
            Find people
          </button>
        </p>
      )}

      <div className="friend-utility-bar">
        <button
          type="button"
          className={`friend-tab${panel === "search" ? " active" : ""}`}
          onClick={() => setPanel(panel === "search" ? null : "search")}
        >
          Find people
        </button>
        <button
          type="button"
          className={`friend-tab${panel === "requests" ? " active" : ""}`}
          onClick={() => setPanel(panel === "requests" ? null : "requests")}
        >
          Requests{requests.length > 0 ? ` (${requests.length})` : ""}
        </button>
        <button
          type="button"
          className={`friend-tab${panel === "followers" ? " active" : ""}`}
          onClick={() => setPanel(panel === "followers" ? null : "followers")}
        >
          Followers ({followers.length})
        </button>
      </div>

      {panel === "search" && <UserSearch userId={user.id} />}

      {panel === "requests" && (
        <div className="friend-list">
          {requests.length === 0 && <p className="friend-empty">No pending follow requests.</p>}
          {requests.map((r) => (
            <FriendRow
              key={r.id}
              userId={r.followerId}
              profile={profiles.get(r.followerId)}
              actions={
                <>
                  <button type="button" className="friend-accept-btn" onClick={() => accept(r.followerId)}>
                    Accept
                  </button>
                  <button type="button" className="friend-reject-btn" onClick={() => reject(r.followerId)}>
                    Decline
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}

      {panel === "followers" && (
        <div className="friend-list">
          {followers.length === 0 && <p className="friend-empty">No followers yet.</p>}
          {followers.map((f) => (
            <FriendRow
              key={f.id}
              userId={f.followerId}
              profile={profiles.get(f.followerId)}
              actions={
                <button type="button" className="friend-reject-btn" onClick={() => removeFollower(f.followerId)}>
                  Remove
                </button>
              }
            />
          ))}
        </div>
      )}

      <h3 className="review-eyebrow" style={{ marginTop: 32 }}>
        Milestones
      </h3>

      {feedLoading && <p className="review-lead">Loading…</p>}

      {!feedLoading && events.length === 0 && (
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
              <div className="feed-row-content">
                <Avatar avatarUrl={profile?.avatarUrl} name={profile?.displayName || profile?.username || "?"} size={36} />
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
            </div>
          );
        })}
      </div>

      <FriendStoryModal
        profile={selectedProfile}
        onClose={() => setSelectedFriendId(null)}
        onUnfollow={unfollow}
      />
    </PageShell>
  );
}
