import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const GOOGLE_ICON = (
  <svg className="oauth-icon" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
    <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.348 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" />
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
  </svg>
);

interface AuthPageProps {
  mode: "sign-in" | "sign-up";
}

export function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    setError("");
    setSuccess("");

    const { error: authError } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });

    setSubmitting(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (mode === "sign-up") {
      setSuccess("Check your email to confirm your account, then sign in.");
      return;
    }

    navigate("/");
  }

  return (
    <div className="modal-overlay visible" style={{ position: "static", minHeight: "100vh" }}>
      <div className="modal">
        <h2>{mode === "sign-in" ? "Sign in" : "Sign up"}</h2>
        <p>Sign in to sync your habits across devices.</p>

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

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="auth-error visible">{error}</p>}
          {success && <p className="auth-error visible success">{success}</p>}
          <button type="submit" disabled={submitting}>
            {mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="auth-toggle-row">
          {mode === "sign-in" ? (
            <>
              <span>Don't have an account?</span>
              <Link to="/sign-up" className="link-btn">
                Sign up
              </Link>
            </>
          ) : (
            <>
              <span>Already have an account?</span>
              <Link to="/sign-in" className="link-btn">
                Sign in
              </Link>
            </>
          )}
        </p>

        <Link to="/" className="modal-btn-secondary auth-cancel-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
          Close
        </Link>
      </div>
    </div>
  );
}
