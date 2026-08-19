import { useQuery } from "@tanstack/react-query";
import { useSessionStore } from "../store/sessionStore";
import { fetchFriendsFeed } from "../api/activityApi";

export function useActivityFeed() {
  const user = useSessionStore((s) => s.user);
  const userId = user?.id;

  const query = useQuery({
    queryKey: ["activity-feed", userId ?? "none"],
    queryFn: () => fetchFriendsFeed(userId as string),
    enabled: !!userId,
    staleTime: Infinity,
  });

  return { events: query.data ?? [], isLoading: query.isLoading };
}
