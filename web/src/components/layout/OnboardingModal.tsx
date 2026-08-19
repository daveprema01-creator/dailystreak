import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSessionStore } from "../../store/sessionStore";
import { setAccountDisplayName } from "../../lib/displayName";
import { Modal } from "../ui/Modal";

const GOOGLE_ICON = (
  <svg className="oauth-icon" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
    <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.348 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" />
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
  </svg>
);

/**
 * First-time onboarding: welcome choice (Google / email account / stay logged out), then a
 * name prompt. The typed name is always saved locally first — that's what lets it survive a
 * page reload if Supabase requires email confirmation before the account goes live.
 */
export function OnboardingModal() {
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const setLocalName = useSessionStore((s) => s.setLocalName);
  const [step, setStep] = useState<"welcome" | "name">(user ? "name" : "welcome");
  const [target, setTarget] = useState<"account" | "local" | null>(null);
  const [name, setName] = useState("");

  async function handleNameSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setLocalName(trimmed);

    if (target === "account") {
      navigate("/sign-up");
      return;
    }
    if (user) {
      await setAccountDisplayName(trimmed);
    }
    // else: guest mode, name is saved locally — nothing further to do, modal will stop
    // rendering once the parent re-checks getDisplayName() and finds it set.
  }

  if (step === "welcome") {
    return (
      <Modal open onClose={null}>
        <h2>Welcome to Daily Streak!</h2>
        <p>Sync your habits across devices, or keep everything on this one.</p>

        <div className="oauth-buttons">
          <button
            type="button"
            className="oauth-btn"
            onClick={() =>
              supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } })
            }
          >
            {GOOGLE_ICON}
            Continue with Google
          </button>
        </div>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="modal-btn-secondary welcome-email-btn"
          onClick={() => {
            setTarget("account");
            setStep("name");
          }}
        >
          Create an account with email
        </button>
        <button
          type="button"
          className="link-btn welcome-skip-btn"
          onClick={() => {
            setTarget("local");
            setStep("name");
          }}
        >
          Stay logged out
        </button>
      </Modal>
    );
  }

  return (
    <Modal open onClose={null}>
      <h2>Welcome to Daily Streak!</h2>
      <p>What should we call you?</p>
      <form onSubmit={handleNameSubmit}>
        <input
          type="text"
          placeholder="Your name"
          autoComplete="off"
          maxLength={30}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <button type="submit">Continue</button>
      </form>
    </Modal>
  );
}
