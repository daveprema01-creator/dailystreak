import { supabase } from "../lib/supabase";

export type FollowStatus = "pending" | "accepted";

export interface FollowEdge {
  id: string;
  followerId: string;
  followingId: string;
  status: FollowStatus;
  createdAt: string;
}

interface FollowRow {
  id: string;
  follower_id: string;
  following_id: string;
  status: FollowStatus;
  created_at: string;
}

function rowToEdge(row: FollowRow): FollowEdge {
  return {
    id: row.id,
    followerId: row.follower_id,
    followingId: row.following_id,
    status: row.status,
    createdAt: row.created_at,
  };
}

/** The edge from `userId` to `targetId`, if any — null means "not following, no pending request." */
export async function fetchFollowEdge(userId: string, targetId: string): Promise<FollowEdge | null> {
  const { data, error } = await supabase
    .from("follows")
    .select("*")
    .eq("follower_id", userId)
    .eq("following_id", targetId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToEdge(data as FollowRow) : null;
}

/** Incoming pending requests — other users who want to follow `userId`. */
export async function fetchIncomingRequests(userId: string): Promise<FollowEdge[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("*")
    .eq("following_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as FollowRow[]).map(rowToEdge);
}

/** Accounts `userId` follows (accepted only). */
export async function fetchFollowing(userId: string): Promise<FollowEdge[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("*")
    .eq("follower_id", userId)
    .eq("status", "accepted")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as FollowRow[]).map(rowToEdge);
}

/** Accounts following `userId` (accepted only). */
export async function fetchFollowers(userId: string): Promise<FollowEdge[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("*")
    .eq("following_id", userId)
    .eq("status", "accepted")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as FollowRow[]).map(rowToEdge);
}

export async function requestFollow(targetId: string): Promise<FollowEdge> {
  const { data, error } = await supabase.rpc("request_follow", { target_id: targetId });
  if (error) throw error;
  return rowToEdge(data as FollowRow);
}

export async function acceptFollow(requesterId: string): Promise<FollowEdge> {
  const { data, error } = await supabase.rpc("accept_follow", { requester_id: requesterId });
  if (error) throw error;
  return rowToEdge(data as FollowRow);
}

export async function rejectFollow(requesterId: string): Promise<void> {
  const { error } = await supabase.rpc("reject_follow", { requester_id: requesterId });
  if (error) throw error;
}

export async function unfollow(targetId: string): Promise<void> {
  const { error } = await supabase.rpc("unfollow", { target_id: targetId });
  if (error) throw error;
}
