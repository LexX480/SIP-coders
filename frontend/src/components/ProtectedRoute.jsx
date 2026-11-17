import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingScreen from "./LoadingScreen";

// role: "responder" | "coordination" | undefined (any logged-in user)
export default function ProtectedRoute({ role, children }) {
  const { user, ready, isResponder, isCoordination } = useAuth();

  // Wait for the stored-login check to finish. The delay means a quick check
  // never flashes the loader, but a slow one (e.g. a future server check of
  // the token) shows it instead of a blank page.
  if (!ready) return <LoadingScreen delay={200} />;

  if (!user) return <Navigate to={role === "coordination" ? "/coordination/login" : "/responder/auth"} replace />;

  if (role === "responder" && !isResponder) return <Navigate to="/" replace />;
  if (role === "coordination" && !isCoordination) return <Navigate to="/coordination/login" replace />;

  return children;
}