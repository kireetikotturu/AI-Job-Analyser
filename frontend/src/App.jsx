import { useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import UploadPage from "./pages/UploadPage";
import Dashboard from "./pages/Dashboard";
import AllJobs from "./pages/AllJobs";
import ResumeAnalyzer from "./pages/ResumeAnalyzer";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Account from "./pages/Account";
import { ResumeAnalysisProvider, RESUME_INTERRUPTED_KEY } from "./context/ResumeAnalysisContext";
import { AuthProvider } from "./context/AuthContext";

function InterruptedAnalysisGuard() {
  const navigate = useNavigate();
  useEffect(() => {
    // If the last session ended by forcing a refresh/close while a resume
    // analysis was still running, that request is gone for good — there's
    // nothing valid to show on Resume Analyzer. Send the user back to the
    // Upload page instead of leaving them looking at an empty/stale view.
    let wasInterrupted = false;
    try {
      wasInterrupted = sessionStorage.getItem(RESUME_INTERRUPTED_KEY) === "1";
      sessionStorage.removeItem(RESUME_INTERRUPTED_KEY);
    } catch {
      // non-fatal
    }
    if (wasInterrupted) navigate("/", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ResumeAnalysisProvider>
        <div className="min-h-screen bg-cream">
          <Navbar />
          <InterruptedAnalysisGuard />
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/jobs" element={<AllJobs />} />
            <Route path="/resume-analyzer" element={<ResumeAnalyzer />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/account" element={<Account />} />
          </Routes>
        </div>
      </ResumeAnalysisProvider>
    </AuthProvider>
  );
}
