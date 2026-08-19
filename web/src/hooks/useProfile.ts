import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../store/sessionStore";
import {
  createProfile,
  fetchOwnProfile,
  fetchProfileByUsername,
  fetchProfilesByIds,
  updateProfile,
  type Profile,
} from "../api/profilesApi";

function ownProfileKey(userId: string | undefined) {
  return ["profile", userId ?? "none"] as const;
}

/** The signed-in user's own profile — null means bootstrapped, signed in, but hasn't claimed a username yet. */
export function useOwnProfile() {
  const user = useSessionStore((s) => s.user);
  const bootstrapped = useSessionStore((s) => s.bootstrapped);
  const userId = user?.id;
  const queryClient = useQueryClient();
  const key = ownProfileKey(userId);

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchOwnProfile(userId as string),
    enabled: bootstrapped && !!userId,
    staleTime: Infinity,
  });

  const claimProfile = useCallback(
    async (fields: { username: string; displayName: string; isPublic: boolean }) => {
      if (!userId) throw new Error("Must be signed in to claim a profile");
      const profile = await createProfile(userId, fields);
      queryClient.setQueryData<Profile>(key, profile);
      return profile;
    },
    [userId, queryClient, key]
  );

  const saveProfile = useCallback(
    async (fields: Partial<{ displayName: string; isPublic: boolean; bio: string; avatarUrl: string | null }>) => {
      if (!userId) throw new Error("Must be signed in to edit a profile");
      const current = queryClient.getQueryData<Profile>(key);
      await updateProfile(userId, fields);
      if (current) {
        queryClient.setQueryData<Profile>(key, {
          ...current,
          ...(fields.displayName !== undefined ? { displayName: fields.displayName } : {}),
          ...(fields.isPublic !== undefined ? { isPublic: fields.isPublic } : {}),
          ...(fields.bio !== undefined ? { bio: fields.bio } : {}),
          ...(fields.avatarUrl !== undefined ? { avatarUrl: fields.avatarUrl } : {}),
        });
      }
    },
    [userId, queryClient, key]
  );

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    /** True once we know for certain there's no profile row yet (as opposed to still loading). */
    needsProfileSetup: bootstrapped && !!userId && !query.isLoading && query.data === null,
    claimProfile,
    saveProfile,
  };
}

/** Any user's profile by username — for viewing someone else's `/u/:username` page. */
export function useProfileByUsername(username: string | undefined) {
  const query = useQuery({
    queryKey: ["profile-by-username", username ?? "none"],
    queryFn: () => fetchProfileByUsername(username as string),
    enabled: !!username,
    staleTime: Infinity,
  });
  return { profile: query.data ?? null, isLoading: query.isLoading };
}

/** Batch profile lookup, used to resolve names/avatars for a list of follow edges. */
export function useProfilesByIds(ids: string[]) {
  const key = useMemo(() => [...new Set(ids)].sort(), [ids]);
  const query = useQuery({
    queryKey: ["profiles-by-ids", key],
    queryFn: () => fetchProfilesByIds(key),
    enabled: key.length > 0,
    staleTime: Infinity,
  });
  const profiles = useMemo(() => {
    const map = new Map<string, Profile>();
    (query.data ?? []).forEach((p) => map.set(p.id, p));
    return map;
  }, [query.data]);
  return { profiles, isLoading: query.isLoading };
}
