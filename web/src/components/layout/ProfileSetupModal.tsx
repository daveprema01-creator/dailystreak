import { useEffect, useState, type FormEvent } from "react";
import { isUsernameAvailable } from "../../api/profilesApi";
import { isValidUsername, normalizeUsername, usernameError } from "../../lib/username";
import { useDisplayName } from "../../hooks/useSession";
import { useOwnProfile } from "../../hooks/useProfile";
import { Modal } from "../ui/Modal";

type Availability = "idle" | "checking" | "available" | "taken" | "error";

/**
 * Mandatory one-time gate for every signed-in user without a profiles row yet — claims a
 * username and asks public or private directly, with no silent default (per the product
 * decision: "make them pick during onboarding and allow them to switch later").
 */
export function ProfileSetupModal() {
  const displayName = useDisplayName();
  const { claimProfile } = useOwnProfile();

  const [usernameInput, setUsernameInput] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private" | null>(null);
  const [availability, setAvailability] = useState<Availability>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const username = normalizeUsername(usernameInput);
  const formatError = usernameError(username);

  useEffect(() => {
    if (!username || !isValidUsername(username)) {
      setAvailability("idle");
      return;
    }
    let cancelled = false;
    setAvailability("checking");
    const timer = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(username);
        if (!cancelled) setAvailability(available ? "available" : "taken");
      } catch {
        if (!cancelled) setAvailability("error");
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  const canSubmit = isValidUsername(username) && availability === "available" && visibility !== null && !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || visibility === null) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await claimProfile({ username, displayName: displayName ?? "", isPublic: visibility === "public" });
    } catch (err) {
      setSubmitError((err as Error).message || "Couldn't save that username — try another.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={null}>
      <h2>Claim your username</h2>
      <p>This is how people will find and follow you.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="username"
          autoComplete="off"
          maxLength={20}
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
          autoFocus
        />
        {formatError && <p className="auth-error visible">{formatError}</p>}
        {!formatError && availability === "taken" && <p className="auth-error visible">That username is taken.</p>}
        {!formatError && availability === "available" && (
          <p className="auth-error visible success">@{username} is available.</p>
        )}
        {!formatError && availability === "error" && (
          <p className="auth-error visible">Couldn't check availability — try again.</p>
        )}

        <div className="modal-goal-row" style={{ marginTop: 8, gap: 10 }}>
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
            : visibility === "private"
              ? "People have to request to follow you, and you approve each one."
              : "Choose who can follow you. You can change this later in Settings."}
        </p>

        {submitError && <p className="auth-error visible">{submitError}</p>}
        <button type="submit" disabled={!canSubmit}>
          {submitting ? "Saving…" : "Continue"}
        </button>
      </form>
    </Modal>
  );
}
