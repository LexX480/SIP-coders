import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import StatusPill from "../components/StatusPill";
import { getAlerts } from "../api/client";

export default function DuplicationAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getAlerts().then(setAlerts).catch(() => setError("Could not load alerts."));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header variant="coordination" />
      <main className="w-full pt-16 flex-1">
        <div className="max-w-[720px] mx-auto px-margin-mobile lg:px-margin py-space-lg">
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight mb-space-md">
            Duplication Alerts
          </h1>

          {error && <p className="font-caption text-caption text-status-critical mb-space-md">{error}</p>}

          <div className="flex flex-col gap-space-sm">
            {alerts.map((a) => (
              <Link
                key={a._id}
                to={`/coordination/alerts/${a._id}`}
                className="flex items-center gap-space-sm p-space-md rounded-xl bg-surface-container-lowest border border-surface-container-highest shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 rounded-lg bg-status-critical/10 flex items-center justify-center text-status-critical shrink-0">
                  <span className="material-symbols-outlined text-[20px]">content_copy</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-label-md text-label-md text-on-surface">
                    {a.ward?.name} — {a.resourceType}
                  </p>
                  <p className="font-caption text-caption text-on-surface-variant">
                    {a.organizationCount} organizations reported delivering here
                  </p>
                </div>
                <StatusPill status={a.status === "confirmed" ? "confirmed_alert" : a.status} />
              </Link>
            ))}
            {alerts.length === 0 && !error && (
              <p className="font-body-md text-body-md text-on-surface-variant text-center py-space-lg">
                No duplication alerts right now.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
