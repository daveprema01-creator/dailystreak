import { supabase } from "../lib/supabase";

export interface ActivityEvent {
  id: string;
  userId: string;
  habitId: string;
  habitName: string;
  milestone: number;
  occurredAt: string; // "YYYY-MM-DD"
  createdAt: string;
}

interface ActivityEventRow {
  id: string;
  user_id: string;
  habit_id: string;
  habit_name: string;
  milestone: number;
  occurred_at: string;
  created_at: string;
}

function rowToEvent(row: ActivityEventRow): ActivityEvent {
  return {
    id: row.id,
    userId: row.user_id,
    habitId: row.habit_id,
    habitName: row.habit_name,
    milestone: row.milestone,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

export async function insertActivityEvent(
  userId: string,
  habitId: string,
  habitName: string,
  milestone: number,
  occurredAt: string
): Promise<void> {
  const { error } = await supabase
    .from("activity_events")
    .insert({ user_id: userId, habit_id: habitId, habit_name: habitName, milestone, occurred_at: occurredAt });
  if (error) throw error;
}

/**
 * Events from people the signed-in user follows — RLS already restricts this to habits
 * currently marked shared() by an accepted-follow target, so no extra filtering needed here
 * beyond excluding the caller's own events (those show up as toasts, not in their own feed).
 */
export async function fetchFriendsFeed(userId: string): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("activity_events")
    .select("*")
    .neq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as ActivityEventRow[]).map(rowToEvent);
}
