import { supabase } from "../lib/supabase";

export interface Profile {
  id: string;
  username: string;
  displayName: string;
  isPublic: boolean;
  bio: string;
  avatarUrl: string | null;
  createdAt: string;
}

interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  is_public: boolean;
  bio: string;
  avatar_url: string | null;
  created_at: string;
}

function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    isPublic: row.is_public,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
  };
}

export async function fetchOwnProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data as ProfileRow) : null;
}

export async function fetchProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data as ProfileRow) : null;
}

export async function fetchProfilesByIds(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("profiles").select("*").in("id", ids);
  if (error) throw error;
  return (data as ProfileRow[]).map(rowToProfile);
}

/** Username-prefix search, for finding people to follow — excludes the caller's own row. */
export async function searchProfilesByUsername(query: string, excludeUserId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("username", `${query}%`)
    .neq("id", excludeUserId)
    .order("username", { ascending: true })
    .limit(20);
  if (error) throw error;
  return (data as ProfileRow[]).map(rowToProfile);
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
  if (error) throw error;
  return !data;
}

export async function createProfile(
  userId: string,
  fields: { username: string; displayName: string; isPublic: boolean }
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      username: fields.username,
      display_name: fields.displayName,
      is_public: fields.isPublic,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToProfile(data as ProfileRow);
}

export async function updateProfile(
  userId: string,
  fields: Partial<{ displayName: string; isPublic: boolean; bio: string; avatarUrl: string | null }>
): Promise<void> {
  const patch: Partial<ProfileRow> = {};
  if (fields.displayName !== undefined) patch.display_name = fields.displayName;
  if (fields.isPublic !== undefined) patch.is_public = fields.isPublic;
  if (fields.bio !== undefined) patch.bio = fields.bio;
  if (fields.avatarUrl !== undefined) patch.avatar_url = fields.avatarUrl;
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}

/** Uploads a resized avatar image to the user's storage folder and returns its public URL. */
export async function uploadAvatar(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/avatar-${Date.now()}.webp`;
  const { error } = await supabase.storage.from("avatars").upload(path, blob, {
    contentType: "image/webp",
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
