import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header";
import { confirmAlert, dismissAlert, getAlert } from "../api/client";

export default function DuplicationAlertDetail() {
  const { id } = useParams();
  const [alert, setAlert] = useState(null);
  const [error, setError] = useState("");
  const [acting, setActing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getAlert(id).then(setAlert).catch(() => setError("Could not load this alert."));
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

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header variant="coordination" />
      <main className="w-full pt-16 flex-1 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto p-space-lg">
          <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-lg text-center">
            <span className="material-symbols-outlined text-[40px] text-status-critical mb-space-sm">content_copy</span>
            <h1 className="font-headline-md text-headline-md text-on-surface mb-1">
              {alert.ward?.name} — {alert.resourceType}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mb-space-lg">
              {alert.organizationCount} organizations reported delivering {alert.resourceType} here
            </p>

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
