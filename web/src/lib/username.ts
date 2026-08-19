// Lowercase, [a-z0-9_], 3–20 chars — matches the DB CHECK constraint on profiles.username.
// Keeping the rule in one place and enforcing it both client-side (fast feedback) and in the
// DB (source of truth) means the client check can never silently drift from what the DB
// actually accepts.
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

export function usernameError(username: string): string | null {
  if (username.length === 0) return null;
  if (username.length < 3) return "At least 3 characters.";
  if (username.length > 20) return "20 characters or fewer.";
  if (!/^[a-z0-9_]+$/.test(username)) return "Only lowercase letters, numbers, and underscores.";
  return null;
}
