import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { loginResponder, registerResponder } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function ResponderAuth() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [method, setMethod] = useState("phone"); // "phone" | "email"
  const [organizationName, setOrganizationName] = useState("");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        loginMethod: method,
        password,
        ...(method === "phone" ? { phone: contact } : { email: contact }),
        ...(mode === "signup" ? { organizationName } : {}),
      };

      const data = mode === "signup" ? await registerResponder(payload) : await loginResponder(payload);
      login(data.token, data.user);
      navigate("/responder/home");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex flex-col justify-center items-center p-gutter pt-16">
        <div className="w-full max-w-[460px] mx-auto py-space-lg">
          <div className="w-full bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container-highest">
            <div className="mb-space-lg">
              <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight mb-1">
                Responder Access
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {mode === "login" ? "Sign in to your relief team." : "Register your relief team."}
              </p>
            </div>

            {/* Phone / Email toggle - one method at a time */}
            <div className="w-full bg-surface-container-low p-1 rounded-lg flex items-center mb-space-md border border-surface-container-highest">
              {["phone", "email"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`flex-1 py-1.5 rounded-md font-label-md text-label-md transition-all flex items-center justify-center gap-1.5 ${method === m ? "text-on-surface bg-surface-container-lowest shadow-sm" : "text-on-surface-variant"
                    }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{m === "phone" ? "phone" : "mail"}</span>
                  <span>{m === "phone" ? "Phone" : "Email"}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-space-md">
              {mode === "signup" && (
                <div className="flex flex-col space-y-1.5">
                  <label className="font-label-md text-label-md text-on-surface">Organization name</label>
                  <input
                    required
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg border border-surface-container-highest focus:outline-none focus:border-secondary transition-colors"
                    placeholder="e.g. Himal Relief Nepal"
                  />
                </div>
              )}

              <div className="flex flex-col space-y-1.5">
                <label className="font-label-md text-label-md text-on-surface">
                  {method === "phone" ? "Phone number" : "Email address"}
                </label>
                <input
                  required
                  type={method === "phone" ? "tel" : "email"}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg border border-surface-container-highest focus:outline-none focus:border-secondary transition-colors"
                  placeholder={method === "phone" ? "98XXXXXXXX" : "team@organization.org"}
                />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="font-label-md text-label-md text-on-surface">Password</label>
                <div className="relative">
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 pl-3.5 pr-11 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg border border-surface-container-highest focus:outline-none focus:border-secondary transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {error && <p className="font-caption text-caption text-status-critical">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-opacity disabled:opacity-60"
              >
                {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Register"}
              </button>
            </form>

            <p className="text-center font-caption text-caption text-on-surface-variant mt-space-md">
              {mode === "login" ? "New responder organization?" : "Already registered?"}{" "}
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="text-secondary underline"
              >
                {mode === "login" ? "Register here" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}