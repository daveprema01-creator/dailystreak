import { useFollowStatus } from "../../hooks/useFollows";

interface FollowButtonProps {
  targetId: string;
}

export function FollowButton({ targetId }: FollowButtonProps) {
  const { edge, isLoading, isSelf, follow, unfollow } = useFollowStatus(targetId);

  if (isSelf) return null;

  if (isLoading) {
    return (
      <button type="button" className="follow-btn" disabled>
        &nbsp;
      </button>
    );
  }

  if (!edge) {
    return (
      <button type="button" className="follow-btn" onClick={follow}>
        Follow
      </button>
    );
  }

  if (edge.status === "pending") {
    return (
      <button
        type="button"
        className="follow-btn follow-btn-pending"
        onClick={unfollow}
        title="Cancel follow request"
      >
        Requested
      </button>
    );
  }

  return (
    <button type="button" className="follow-btn follow-btn-following" onClick={unfollow} title="Unfollow">
      Following
    </button>
  );
}
