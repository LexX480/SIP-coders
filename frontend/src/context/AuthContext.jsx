import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("saajharahat_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem("saajharahat_user");
      }
    }
    setReady(true);
  }, []);

  function login(token, userData) {
    localStorage.setItem("saajharahat_token", token);
    localStorage.setItem("saajharahat_user", JSON.stringify(userData));
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem("saajharahat_token");
    localStorage.removeItem("saajharahat_user");
    setUser(null);
  }

  const isCoordination = user && ["ward_committee", "ndrrma", "cluster_lead"].includes(user.role);
  const isResponder = user && user.role === "responder";

  return (
    <AuthContext.Provider value={{ user, ready, login, logout, isCoordination, isResponder }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
