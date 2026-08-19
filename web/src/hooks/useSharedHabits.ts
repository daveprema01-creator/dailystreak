import { useQuery } from "@tanstack/react-query";
import { fetchSharedHabits } from "../api/supabaseHabitsApi";

/** Another user's shared habits, for viewing on their /u/:username page. */
export function useSharedHabits(targetId: string | undefined) {
  const query = useQuery({
    queryKey: ["shared-habits", targetId ?? "none"],
    queryFn: () => fetchSharedHabits(targetId as string),
    enabled: !!targetId,
    staleTime: Infinity,
  });

  return { habits: query.data ?? [], isLoading: query.isLoading };
}
