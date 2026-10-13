import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginCoordination } from "../api/client";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Header";

const ROLES = [
  { value: "ward_committee", label: "Ward Disaster Committee" },
  { value: "ndrrma", label: "NDRRMA" },
  { value: "cluster_lead", label: "Cluster Lead" },
];

export default function CoordinationLogin() {
  const [role, setRole] = useState(ROLES[0].value);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await loginCoordination({ role, email, password });
      login(data.token, data.user);
      navigate("/coordination/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-margin-mobile bg-surface">
      <Header />
      <main className="w-full max-w-[480px] mx-auto py-space-xl">
        <div className="w-full bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg shadow-sm border border-surface-container-highest">
          <div className="flex flex-col items-center text-center">
            <img src="/logo-icon.png" alt="SaajhaRahat" className="w-12 h-12 object-contain rounded-full shadow-sm mb-space-sm" />
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/5 text-primary mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary">
                Disaster Response Grid
              </span>
            </div>
            <h1 className="font-headline-md text-headline-md text-primary tracking-tight">Authority Access</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-[280px]">
              Select your role to access ward coordination.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-space-lg space-y-space-md">
            <div className="flex flex-col space-y-1.5">
              <label className="font-label-md text-label-md text-primary" htmlFor="role-select">
                Official Role
              </label>
              <select
                id="role-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary transition-colors cursor-pointer"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="font-label-md text-label-md text-primary">Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary transition-colors"
                placeholder="coordinator@ward.gov.np"
              />
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="font-label-md text-label-md text-primary">Password</label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="font-caption text-caption text-status-critical">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:opacity-95 transition-opacity disabled:opacity-60"
            >
              {loading ? "Please wait..." : "Sign in"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
