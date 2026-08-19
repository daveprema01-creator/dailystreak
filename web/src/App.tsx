import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useSession } from "./hooks/useSession";
import { ToastStack } from "./components/ui/ToastStack";
import { PersonalDashboard } from "./routes/PersonalDashboard";
import { WeeklyReview } from "./routes/WeeklyReview";
import { Insights } from "./routes/Insights";
import { Settings } from "./routes/Settings";
import { AuthPage } from "./routes/AuthPage";

export default function App() {
  useSession();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PersonalDashboard />} />
        <Route path="/review" element={<WeeklyReview />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/sign-in" element={<AuthPage mode="sign-in" />} />
        <Route path="/sign-up" element={<AuthPage mode="sign-up" />} />
        <Route path="*" element={<PersonalDashboard />} />
      </Routes>
      <ToastStack />
    </BrowserRouter>
  );
}
