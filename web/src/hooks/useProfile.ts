import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../store/sessionStore";
import { createProfile, fetchOwnProfile, updateProfile, type Profile } from "../api/profilesApi";

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
    async (fields: Partial<{ displayName: string; isPublic: boolean; bio: string }>) => {
      if (!userId) throw new Error("Must be signed in to edit a profile");
      const current = queryClient.getQueryData<Profile>(key);
      await updateProfile(userId, fields);
      if (current) {
        queryClient.setQueryData<Profile>(key, {
          ...current,
          ...(fields.displayName !== undefined ? { displayName: fields.displayName } : {}),
          ...(fields.isPublic !== undefined ? { isPublic: fields.isPublic } : {}),
          ...(fields.bio !== undefined ? { bio: fields.bio } : {}),
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
