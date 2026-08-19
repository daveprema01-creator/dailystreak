import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../store/sessionStore";
import { showInfoToast } from "../store/toastStore";
import {
  acceptFollow as apiAcceptFollow,
  fetchFollowEdge,
  fetchFollowers,
  fetchFollowing,
  fetchIncomingRequests,
  rejectFollow as apiRejectFollow,
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

  const query = useQuery({
    queryKey: followersKey(userId),
    queryFn: () => fetchFollowers(userId as string),
    enabled: !!userId,
    staleTime: Infinity,
  });

  return { followers: query.data ?? [], isLoading: query.isLoading };
}
