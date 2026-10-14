import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header";
import { confirmAlert, dismissAlert, getAlert } from "../api/client";

function timeAgo(dateStr) {
  const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function DuplicationAlertDetail() {
  const { id } = useParams();
  const [alert, setAlert] = useState(null);
  const [error, setError] = useState("");
  const [acting, setActing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getAlert(id)
      .then(setAlert)
      .catch(() => setError("Could not load this alert."));
  }, [id]);

  async function handleConfirm() {
    setActing(true);
    try {
      await confirmAlert(id);
      navigate("/coordination/alerts");
    } catch {
      setError("Could not confirm this alert.");
    } finally {
      setActing(false);
    }
  }

  async function handleDismiss() {
    setActing(true);
    try {
      await dismissAlert(id);
      navigate("/coordination/alerts");
    } catch {
      setError("Could not dismiss this alert.");
    } finally {
      setActing(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <Header variant="coordination" />
        <main className="pt-24 text-center font-body-md text-status-critical">{error}</main>
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <Header variant="coordination" />
        <main className="pt-24 text-center font-body-md text-on-surface-variant">Loading...</main>
      </div>
    );
  }

  const isNeed = alert.kind === "need";
  const count = isNeed ? alert.reportCount : alert.organizationCount;
  const summary = isNeed
    ? `${count} separate report${count === 1 ? "" : "s"} for the same need were submitted here — likely the same household or neighbors.`
    : `${count} organizations reported delivering ${alert.resourceType} here.`;

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header variant="coordination" />
      <main className="w-full pt-16 flex-1 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto p-space-lg">
          <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-lg text-center">
            <span className="material-symbols-outlined text-[40px] text-status-critical mb-space-sm">
              {isNeed ? "groups" : "content_copy"}
            </span>
            <h1 className="font-headline-md text-headline-md text-on-surface mb-1">
              {alert.ward?.name} - {alert.resourceType}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mb-space-md">{summary}</p>

            {isNeed ? (
              <div className="text-left divide-y divide-surface-container-highest mb-space-lg">
                {(alert.needs || []).map((n) => (
                  <div key={n._id} className="py-space-sm">
                    <p className="font-label-md text-label-md text-on-surface">
                      {n.reporterName || "Unknown reporter"}
                    </p>
                    <p className="font-caption text-caption text-on-surface-variant">
                      {n.reporterPhone ? `${n.reporterPhone} • ` : ""}
                      Needs {n.quantityNeeded} unit{n.quantityNeeded === 1 ? "" : "s"} • {timeAgo(n.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-left divide-y divide-surface-container-highest mb-space-lg">
                {(alert.distributions || []).map((d) => (
                  <div key={d._id} className="py-space-sm">
                    <p className="font-label-md text-label-md text-on-surface">
                      {d.organization?.organizationName || "Unknown organization"}
                    </p>
                    <p className="font-caption text-caption text-on-surface-variant">
                      {d.quantity} unit{d.quantity === 1 ? "" : "s"} • {timeAgo(d.loggedAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-space-sm">
              <button
                onClick={handleDismiss}
                disabled={acting}
                className="flex-1 h-11 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md disabled:opacity-60"
              >
                Dismiss Alert
              </button>
              <button
                onClick={handleConfirm}
                disabled={acting}
                className="flex-1 h-11 rounded-lg bg-status-critical text-white font-label-md text-label-md disabled:opacity-60"
              >
                Confirm Duplicate
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}