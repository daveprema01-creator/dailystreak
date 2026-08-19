import { supabase } from "./supabase";
import { NAME_KEY } from "./storageKeys";

export function loadLocalName(): string | null {
  return localStorage.getItem(NAME_KEY);
}

/** Persists the display name to the signed-in account so it follows across devices. */
export async function setAccountDisplayName(name: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ data: { display_name: name } });
  if (error) throw error;
}
