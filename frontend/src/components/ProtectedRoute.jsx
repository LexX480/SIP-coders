import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// role: "responder" | "coordination" | undefined (any logged-in user)
export default function ProtectedRoute({ role, children }) {
  const { user, ready, isResponder, isCoordination } = useAuth();

  if (!ready) return null; // wait for localStorage check to finish

  if (!user) return <Navigate to={role === "coordination" ? "/coordination/login" : "/responder/auth"} replace />;

  if (role === "responder" && !isResponder) return <Navigate to="/" replace />;
  if (role === "coordination" && !isCoordination) return <Navigate to="/coordination/login" replace />;

  return children;
}
