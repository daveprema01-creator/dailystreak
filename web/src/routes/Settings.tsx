import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSessionStore } from "../store/sessionStore";
import { useDisplayName } from "../hooks/useSession";
import { setAccountDisplayName } from "../lib/displayName";
import { PageShell } from "../components/layout/PageShell";

export function Settings() {
  const user = useSessionStore((s) => s.user);
  const setLocalName = useSessionStore((s) => s.setLocalName);
  const name = useDisplayName();
  const navigate = useNavigate();
  const [nameInput, setNameInput] = useState(name ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSaveName(e: FormEvent) {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      if (user) {
        await setAccountDisplayName(trimmed);
      } else {
        setLocalName(trimmed);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    if (!confirm("Sign out? Your habits stay saved in your account.")) return;
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <PageShell>
      <div className="review-eyebrow">Settings</div>
      <h2 className="review-headline">{user ? "Your account" : "Local mode"}</h2>
      <p className="review-lead">
        {user ? `Signed in as ${user.email}` : "You're not signed in — habits are saved on this device only."}
      </p>

      <form onSubmit={handleSaveName} style={{ maxWidth: 360, display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
        <input
          type="text"
          placeholder="Your name"
          maxLength={30}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
        />
        <button type="submit" disabled={saving}>
          Save name
        </button>
      </form>

      {user ? (
        <button type="button" className="review-set-targets" onClick={handleSignOut}>
          Sign out
        </button>
      ) : (
        <Link to="/sign-in" className="review-set-targets" style={{ textDecoration: "none", display: "inline-block" }}>
          Sign in to sync
        </Link>
      )}
    </PageShell>
  );
}
