import { useEffect } from "react";
import { useSessionStore } from "../../store/sessionStore";

// Simple line-icon SVGs instead of emoji — currentColor picks up the button's own color,
// which stays white regardless of theme since the hero band is always-ink.
const MOON_ICON = (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M8.5 1.5a6.5 6.5 0 1 0 6 9.02A5.5 5.5 0 0 1 8.5 1.5z" />
  </svg>
);
const SUN_ICON = (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden="true">
    <circle cx="8" cy="8" r="3.2" />
    <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1M12.6 12.6l-1.1-1.1M4.5 4.5l-1.1-1.1" />
  </svg>
);

export function ThemeToggle() {
  const theme = useSessionStore((s) => s.theme);
  const setTheme = useSessionStore((s) => s.setTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <button
      type="button"
      id="theme-toggle"
      className="theme-toggle"
      aria-label="Toggle dark mode"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? SUN_ICON : MOON_ICON}
    </button>
  );
}
