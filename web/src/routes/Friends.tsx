import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { useSessionStore } from "../store/sessionStore";
import { useFriendRequests, useFollowersList, useFollowingList } from "../hooks/useFollows";
import { useProfilesByIds } from "../hooks/useProfile";
import { FollowButton } from "../components/social/FollowButton";
import { searchProfilesByUsername, type Profile } from "../api/profilesApi";

type Tab = "requests" | "following" | "followers";

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
    <div style={{ marginBottom: 28 }}>
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

export function Friends() {
  const user = useSessionStore((s) => s.user);
  const [tab, setTab] = useState<Tab>("requests");

  const { requests, accept, reject } = useFriendRequests();
  const { following, unfollow } = useFollowingList();
  const { followers } = useFollowersList();

  const allIds = [
    ...requests.map((r) => r.followerId),
    ...following.map((f) => f.followingId),
    ...followers.map((f) => f.followerId),
  ];
  const { profiles } = useProfilesByIds(allIds);

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
      <h2 className="review-headline">Requests &amp; connections</h2>

      <UserSearch userId={user.id} />

      <div className="friend-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`friend-tab${tab === "requests" ? " active" : ""}`}
          onClick={() => setTab("requests")}
        >
          Requests{requests.length > 0 ? ` (${requests.length})` : ""}
        </button>
        <button
          type="button"
          role="tab"
          className={`friend-tab${tab === "following" ? " active" : ""}`}
          onClick={() => setTab("following")}
        >
          Following ({following.length})
        </button>
        <button
          type="button"
          role="tab"
          className={`friend-tab${tab === "followers" ? " active" : ""}`}
          onClick={() => setTab("followers")}
        >
          Followers ({followers.length})
        </button>
      </div>

      {tab === "requests" && (
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

      {tab === "following" && (
        <div className="friend-list">
          {following.length === 0 && <p className="friend-empty">You're not following anyone yet.</p>}
          {following.map((f) => (
            <FriendRow
              key={f.id}
              userId={f.followingId}
              profile={profiles.get(f.followingId)}
              actions={
                <button type="button" className="friend-reject-btn" onClick={() => unfollow(f.followingId)}>
                  Unfollow
                </button>
              }
            />
          ))}
        </div>
      )}

      {tab === "followers" && (
        <div className="friend-list">
          {followers.length === 0 && <p className="friend-empty">No followers yet.</p>}
          {followers.map((f) => (
            <FriendRow key={f.id} userId={f.followerId} profile={profiles.get(f.followerId)} actions={null} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
