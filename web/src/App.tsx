import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSession, useDisplayName } from "./hooks/useSession";
import { useOwnProfile } from "./hooks/useProfile";
import { useSessionStore } from "./store/sessionStore";
import { ToastStack } from "./components/ui/ToastStack";
import { OnboardingModal } from "./components/layout/OnboardingModal";
import { ProfileSetupModal } from "./components/layout/ProfileSetupModal";
import { PersonalDashboard } from "./routes/PersonalDashboard";
import { WeeklyReview } from "./routes/WeeklyReview";
import { Insights } from "./routes/Insights";
import { Settings } from "./routes/Settings";
import { Profile } from "./routes/Profile";
import { Friends } from "./routes/Friends";
import { AuthPage } from "./routes/AuthPage";

/**
 * Two sequential mandatory gates, checked regardless of which route the user lands on
 * directly (now that routes are real URLs, not just reachable by clicking through "/"):
 * 1. No display name yet — welcome + name onboarding.
 * 2. Signed in, has a display name, but hasn't claimed a profile/username yet (Phase B).
 * Guests (no session) only ever hit gate 1 — profiles are a signed-in-only concept.
 */
function OnboardingGates() {
  const bootstrapped = useSessionStore((s) => s.bootstrapped);
  const displayName = useDisplayName();
  const { needsProfileSetup } = useOwnProfile();

  const needsOnboarding = bootstrapped && !displayName;
  if (needsOnboarding) return <OnboardingModal />;
  if (needsProfileSetup) return <ProfileSetupModal />;
  return null;
}

export default function App() {
  useSession();

  return (
    <BrowserRouter>
      <OnboardingGates />
      <Routes>
        <Route path="/" element={<PersonalDashboard />} />
        <Route path="/review" element={<WeeklyReview />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/u/:username" element={<Profile />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/feed" element={<Navigate to="/friends" replace />} />
        <Route path="/sign-in" element={<AuthPage mode="sign-in" />} />
        <Route path="/sign-up" element={<AuthPage mode="sign-up" />} />
        <Route path="*" element={<PersonalDashboard />} />
      </Routes>
      <ToastStack />
    </BrowserRouter>
  );
}
