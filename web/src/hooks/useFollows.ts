import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../store/sessionStore";
import { showInfoToast } from "../store/toastStore";
import {
  acceptFollow as apiAcceptFollow,
  fetchFollowCounts,
  fetchFollowEdge,
  fetchFollowers,
  fetchFollowing,
  fetchIncomingRequests,
  rejectFollow as apiRejectFollow,
  removeFollower as apiRemoveFollower,
  requestFollow as apiRequestFollow,
  unfollow as apiUnfollow,
  type FollowEdge,
} from "../api/followsApi";

function edgeKey(userId: string | undefined, targetId: string | undefined) {
  return ["follow-edge", userId ?? "none", targetId ?? "none"] as const;
}
function requestsKey(userId: string | undefined) {
  return ["follow-requests", userId ?? "none"] as const;
}
function followingKey(userId: string | undefined) {
  return ["following", userId ?? "none"] as const;
}
function followersKey(userId: string | undefined) {
  return ["followers", userId ?? "none"] as const;
}
function followCountsKey(userId: string | undefined) {
  return ["follow-counts", userId ?? "none"] as const;
}

/** Follow relationship from the signed-in user to `targetId` — drives FollowButton. */
export function useFollowStatus(targetId: string | undefined) {
  const user = useSessionStore((s) => s.user);
  const userId = user?.id;
  const queryClient = useQueryClient();
  const key = edgeKey(userId, targetId);
  const isSelf = !!userId && userId === targetId;

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchFollowEdge(userId as string, targetId as string),
    enabled: !!userId && !!targetId && !isSelf,
    staleTime: Infinity,
  });

  const follow = useCallback(async () => {
    if (!userId || !targetId) return;
    try {
      const edge = await apiRequestFollow(targetId);
      queryClient.setQueryData<FollowEdge | null>(key, edge);
      queryClient.invalidateQueries({ queryKey: followingKey(userId) });
      queryClient.invalidateQueries({ queryKey: followCountsKey(userId) });
      queryClient.invalidateQueries({ queryKey: followCountsKey(targetId) });
    } catch (err) {
      showInfoToast(`Couldn't follow — ${(err as Error).message}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, targetId, queryClient]);

  const unfollow = useCallback(async () => {
    if (!userId || !targetId) return;
    const previous = queryClient.getQueryData<FollowEdge | null>(key);
    queryClient.setQueryData<FollowEdge | null>(key, null);
    try {
      await apiUnfollow(targetId);
      queryClient.invalidateQueries({ queryKey: followingKey(userId) });
      queryClient.invalidateQueries({ queryKey: followCountsKey(userId) });
      queryClient.invalidateQueries({ queryKey: followCountsKey(targetId) });
    } catch (err) {
      queryClient.setQueryData<FollowEdge | null>(key, previous ?? null);
      showInfoToast(`Couldn't update follow — ${(err as Error).message}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, targetId, queryClient]);

  return {
    edge: query.data ?? null,
    isLoading: query.isLoading,
    isSelf,
    follow,
    unfollow,
  };
}

/** Incoming pending requests to the signed-in user's own account. */
export function useFriendRequests() {
  const user = useSessionStore((s) => s.user);
  const userId = user?.id;
  const queryClient = useQueryClient();
  const key = requestsKey(userId);

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchIncomingRequests(userId as string),
    enabled: !!userId,
    staleTime: Infinity,
  });

  const accept = useCallback(
    async (requesterId: string) => {
      const current = query.data ?? [];
      queryClient.setQueryData<FollowEdge[]>(
        key,
        current.filter((r) => r.followerId !== requesterId)
      );
      try {
        await apiAcceptFollow(requesterId);
        queryClient.invalidateQueries({ queryKey: followersKey(userId) });
        queryClient.invalidateQueries({ queryKey: followCountsKey(userId) });
        queryClient.invalidateQueries({ queryKey: followCountsKey(requesterId) });
      } catch (err) {
        queryClient.setQueryData<FollowEdge[]>(key, current);
        showInfoToast(`Couldn't accept request — ${(err as Error).message}`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, queryClient, userId]
  );

  const reject = useCallback(
    async (requesterId: string) => {
      const current = query.data ?? [];
      queryClient.setQueryData<FollowEdge[]>(
        key,
        current.filter((r) => r.followerId !== requesterId)
      );
      try {
        await apiRejectFollow(requesterId);
      } catch (err) {
        queryClient.setQueryData<FollowEdge[]>(key, current);
        showInfoToast(`Couldn't decline request — ${(err as Error).message}`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, queryClient]
  );

  return { requests: query.data ?? [], isLoading: query.isLoading, accept, reject };
}

/** Accounts the signed-in user follows (accepted only). */
export function useFollowingList() {
  const user = useSessionStore((s) => s.user);
  const userId = user?.id;
  const queryClient = useQueryClient();
  const key = followingKey(userId);

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchFollowing(userId as string),
    enabled: !!userId,
    staleTime: Infinity,
  });

  const remove = useCallback(
    async (targetId: string) => {
      const current = query.data ?? [];
      queryClient.setQueryData<FollowEdge[]>(
        key,
        current.filter((f) => f.followingId !== targetId)
      );
      queryClient.setQueryData<FollowEdge | null>(edgeKey(userId, targetId), null);
      try {
        await apiUnfollow(targetId);
      } catch (err) {
        queryClient.setQueryData<FollowEdge[]>(key, current);
        showInfoToast(`Couldn't unfollow — ${(err as Error).message}`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, queryClient, userId]
  );

  return { following: query.data ?? [], isLoading: query.isLoading, unfollow: remove };
}

/** Accounts following the signed-in user (accepted only). */
export function useFollowersList() {
  const user = useSessionStore((s) => s.user);
  const userId = user?.id;
  const queryClient = useQueryClient();
  const key = followersKey(userId);

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchFollowers(userId as string),
    enabled: !!userId,
    staleTime: Infinity,
  });

  const remove = useCallback(
    async (followerId: string) => {
      const current = query.data ?? [];
      queryClient.setQueryData<FollowEdge[]>(
        key,
        current.filter((f) => f.followerId !== followerId)
      );
      try {
        await apiRemoveFollower(followerId);
        queryClient.invalidateQueries({ queryKey: followCountsKey(userId) });
        queryClient.invalidateQueries({ queryKey: followCountsKey(followerId) });
      } catch (err) {
        queryClient.setQueryData<FollowEdge[]>(key, current);
        showInfoToast(`Couldn't remove follower — ${(err as Error).message}`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, queryClient, userId]
  );

  return { followers: query.data ?? [], isLoading: query.isLoading, remove };
}

/** Follower/following counts for any user — safe across the RLS boundary since it's aggregate-only. */
export function useFollowCounts(userId: string | undefined) {
  const query = useQuery({
    queryKey: followCountsKey(userId),
    queryFn: () => fetchFollowCounts(userId as string),
    enabled: !!userId,
    staleTime: Infinity,
  });

  return { counts: query.data ?? { followers: 0, following: 0 }, isLoading: query.isLoading };
}
