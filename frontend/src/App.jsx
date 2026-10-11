import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Landing from "./pages/Landing";
import ResponderAuth from "./pages/ResponderAuth";
import ResponderHome from "./pages/ResponderHome";
import LogDistribution from "./pages/LogDistribution";
import MyDistributions from "./pages/MyDistributions";
import ReportNeed from "./pages/ReportNeed";
import PublicTransparency from "./pages/PublicTransparency";
import CoordinationLogin from "./pages/CoordinationLogin";
import CoordinationDashboard from "./pages/CoordinationDashboard";
import DuplicationAlerts from "./pages/DuplicationAlerts";
import DuplicationAlertDetail from "./pages/DuplicationAlertDetail";
import Analytics from "./pages/Analytics";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Batch 1 - Landing + Responder flow */}
          <Route path="/" element={<Landing />} />
          <Route path="/responder/auth" element={<ResponderAuth />} />
          <Route
            path="/responder/home"
            element={
              <ProtectedRoute role="responder">
                <ResponderHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/responder/log"
            element={
              <ProtectedRoute role="responder">
                <LogDistribution />
              </ProtectedRoute>
            }
          />
          <Route
            path="/responder/distributions"
            element={
              <ProtectedRoute role="responder">
                <MyDistributions />
              </ProtectedRoute>
            }
          />

          {/* Batch 2 - Community needs + public transparency */}
          <Route path="/needs/report" element={<ReportNeed />} />
          <Route path="/transparency" element={<PublicTransparency />} />

          {/* Batch 3 - Coordination console */}
          <Route path="/coordination/login" element={<CoordinationLogin />} />
          <Route
            path="/coordination/dashboard"
            element={
              <ProtectedRoute role="coordination">
                <CoordinationDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coordination/alerts"
            element={
              <ProtectedRoute role="coordination">
                <DuplicationAlerts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coordination/alerts/:id"
            element={
              <ProtectedRoute role="coordination">
                <DuplicationAlertDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coordination/analytics"
            element={
              <ProtectedRoute role="coordination">
                <Analytics />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
