import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useSessionStore } from "../store/sessionStore";
import { loadLocalName, setAccountDisplayName } from "../lib/displayName";

/**
 * Mounted once at the app root. Subscribes to Supabase auth state, mirrors it into
 * sessionStore, and promotes a name onto the account the first time it has none — from the
 * Google profile for an OAuth sign-in, or from the name typed into onboarding for an
 * email/password sign-up. Safe to run on every auth event; it's a no-op once display_name
 * is set.
 */
export function useSession() {
  const setSession = useSessionStore((s) => s.setSession);
  const setBootstrapped = useSessionStore((s) => s.setBootstrapped);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);

      const user = session?.user ?? null;
      if (user && !user.user_metadata?.display_name) {
        const googleName = (user.user_metadata?.full_name || user.user_metadata?.name) as string | undefined;
        const nameToUse = googleName || loadLocalName();
        if (nameToUse) {
          try {
            await setAccountDisplayName(nameToUse);
          } catch (err) {
            console.warn("Couldn't promote display name onto account", err);
          }
        }
      }

      setBootstrapped();
    });

    return () => subscription.subscription.unsubscribe();
  }, [setSession, setBootstrapped]);
}

export function useDisplayName(): string | null {
  const user = useSessionStore((s) => s.user);
  const localName = useSessionStore((s) => s.localName);
  if (user) return (user.user_metadata?.display_name as string | undefined) || user.email || null;
  return localName;
}
