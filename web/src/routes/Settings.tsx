import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSessionStore } from "../store/sessionStore";
import { useDisplayName } from "../hooks/useSession";
import { useOwnProfile } from "../hooks/useProfile";
import { setAccountDisplayName } from "../lib/displayName";
import { uploadAvatar } from "../api/profilesApi";
import { resizeImageToSquareWebp } from "../lib/image";
import { showInfoToast } from "../store/toastStore";
import { PageShell } from "../components/layout/PageShell";
import { Avatar } from "../components/ui/Avatar";

export function Settings() {
  const user = useSessionStore((s) => s.user);
  const setLocalName = useSessionStore((s) => s.setLocalName);
  const name = useDisplayName();
  const navigate = useNavigate();
  const [nameInput, setNameInput] = useState(name ?? "");
  const [saving, setSaving] = useState(false);

  const { profile, saveProfile } = useOwnProfile();
  const [bioInput, setBioInput] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // profile loads asynchronously — useState's initializer only runs once at mount, so a
  // direct page load (profile still null then) would otherwise leave these permanently
  // out of sync with the real saved values once the fetch resolves.
  useEffect(() => {
    if (!profile) return;
    setBioInput(profile.bio);
    setVisibility(profile.isPublic ? "public" : "private");
  }, [profile?.id]);

  useEffect(() => {
    if (name) setNameInput(name);
  }, [name]);

  async function handleSaveName(e: FormEvent) {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      if (user) {
        await setAccountDisplayName(trimmed);
        // profiles.display_name is a separate snapshot taken at claim time (Phase B) — keep
        // it in sync here too, since Phase C's follow lists/profile pages read it directly
        // and would otherwise show a name the user renamed away from months ago.
        if (profile) await saveProfile({ displayName: trimmed });
      } else {
        setLocalName(trimmed);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSaved(false);
    try {
      await saveProfile({ bio: bioInput.trim(), isPublic: visibility === "public" });
      setProfileSaved(true);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarChange(e: FormEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      showInfoToast("Please choose an image file.");
      return;
    }
    setUploadingAvatar(true);
    try {
      const resized = await resizeImageToSquareWebp(file);
      const url = await uploadAvatar(user.id, resized);
      await saveProfile({ avatarUrl: url });
    } catch (err) {
      showInfoToast(`Couldn't update photo — ${(err as Error).message}`);
    } finally {
      setUploadingAvatar(false);
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

      <form
        className="settings-form"
        onSubmit={handleSaveName}
        style={{ maxWidth: 360, display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}
      >
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

      {profile && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <Avatar avatarUrl={profile.avatarUrl} name={profile.displayName || profile.username} size={64} />
            <div>
              <button
                type="button"
                className="settings-link"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                {uploadingAvatar ? "Uploading…" : "Change photo"}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: "none" }}
              />
            </div>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>@{profile.username}</h3>
          <form
            className="settings-form"
            onSubmit={handleSaveProfile}
            style={{ maxWidth: 360, display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}
          >
            <textarea
              placeholder="A short bio (optional)"
              maxLength={160}
              rows={3}
              value={bioInput}
              onChange={(e) => setBioInput(e.target.value)}
              style={{ resize: "vertical" }}
            />
            <div className="modal-goal-row" style={{ gap: 10 }}>
              {(["private", "public"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: visibility === option ? "var(--accent)" : "transparent",
                    color: visibility === option ? "var(--on-accent)" : "var(--text-muted)",
                    fontWeight: 600,
                    textTransform: "capitalize",
                    cursor: "pointer",
                  }}
                  onClick={() => setVisibility(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <p className="modal-rest-hint">
              {visibility === "public"
                ? "Anyone can follow you instantly — no approval needed."
                : "People have to request to follow you, and you approve each one."}
            </p>
            <button type="submit" disabled={savingProfile}>
              {savingProfile ? "Saving…" : profileSaved ? "Saved ✓" : "Save profile"}
            </button>
          </form>

          <Link to={`/u/${profile.username}`} className="settings-link" style={{ display: "inline-block", marginBottom: 32 }}>
            View my profile
          </Link>
          <br />
        </>
      )}

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
