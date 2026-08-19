import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { NAME_KEY, THEME_KEY } from "../lib/storageKeys";
import { loadLocalName } from "../lib/displayName";

export type Theme = "light" | "dark";

interface SessionState {
  session: Session | null;
  user: User | null;
  /** True once the first onAuthStateChange has fired — avoids flashing "signed out" UI before we know. */
  bootstrapped: boolean;
  setSession: (session: Session | null) => void;
  setBootstrapped: () => void;

  theme: Theme;
  setTheme: (theme: Theme) => void;

  /**
   * Mirrors localStorage's guest-mode display name in reactive state — writing straight to
   * localStorage doesn't trigger a re-render, which left the onboarding modal stuck open
   * after "Continue" until something else happened to re-render the tree.
   */
  localName: string | null;
  setLocalName: (name: string) => void;
}

function initialTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY) as Theme | null;
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  user: null,
  bootstrapped: false,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setBootstrapped: () => set({ bootstrapped: true }),

  theme: initialTheme(),
  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    set({ theme });
  },

  localName: loadLocalName(),
  setLocalName: (name) => {
    localStorage.setItem(NAME_KEY, name);
    set({ localName: name });
  },
}));
