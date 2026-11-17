import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import ResourceGrid, { RESOURCES, SUBCATEGORIES } from "../components/ResourceGrid";
import MapPicker from "../components/MapPicker";
import {
  cancelDelivery,
  getMyDeliveries,
  getWards,
  logDistribution,
  markDeliveryArrived,
  markNeedAddressed,
  restoreDelivery,
  startDelivery,
} from "../api/client";
import { useAuth } from "../context/AuthContext";

const CATEGORY_LABELS = {
  food: "Food Rations",
  water: "Water Supply",
  shelter: "Shelter Kits",
  medical: "Medical Aid",
  electrical: "Electrical & Lighting",
  clothing: "Clothing",
};

const STEPS = ["Resource", "Location", "Confirm"];

function wardLabel(ward) {
  if (!ward) return "";
  const districtLabel = ward.district === "Kathmandu" ? "KTM" : ward.district;
  const parts = [ward.name, districtLabel, ward.locality].filter(Boolean);
  return parts.join(", ");
}

function timeAgo(dateStr) {
  const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function apiError(err, fallback) {
  const data = err.response?.data;
  return data?.message || data?.errors?.[0]?.msg || fallback;
}

export default function LogDistribution() {
  const routerLocation = useLocation();
  const prefill = routerLocation.state?.prefill;

  const [resourceType, setResourceType] = useState(prefill?.resourceType || "");
  const [subCategory, setSubCategory] = useState(prefill?.subCategory || "");
  const [coordinates, setCoordinates] = useState(prefill?.coordinates || null);
  const [wardId, setWardId] = useState(prefill?.wardId || "");
  const [quantity, setQuantity] = useState(prefill?.quantity ? String(prefill.quantity) : "");
  const [needId, setNeedId] = useState(prefill?.needId || null);
  const [wards, setWards] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [resultHadNeed, setResultHadNeed] = useState(false);
  const [error, setError] = useState("");

  // Deliveries that have been sent out but haven't arrived yet
  const [deliveries, setDeliveries] = useState([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);
  const [deliveryBusyId, setDeliveryBusyId] = useState(null);
  const [deliveryError, setDeliveryError] = useState("");
  const [deliveryNotice, setDeliveryNotice] = useState("");

  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    getWards().then(setWards).catch(() => setError("Could not load wards."));
    getMyDeliveries()
      .then(setDeliveries)
      .catch(() => setDeliveryError("Could not load your deliveries on the way."))
      .finally(() => setDeliveriesLoading(false));
  }, []);

  // Skip the nearest-ward auto-pick when we already know the ward from a
  // claimed need report - its own coordinates would resolve to the same
  // ward anyway, but this avoids a flash of "—" while wards load.
  useEffect(() => {
    if (!coordinates || wards.length === 0) return;
    if (prefill?.wardId && wardId === prefill.wardId) return;
    const [lng, lat] = coordinates;
    let nearest = wards[0];
    let best = Infinity;
    for (const w of wards) {
      const [wlng, wlat] = w.location.coordinates;
      const d = Math.hypot(wlng - lng, wlat - lat);
      if (d < best) {
        best = d;
        nearest = w;
      }
    }
    setWardId(nearest._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinates, wards]);

  const selectedWard = wards.find((w) => w._id === wardId);
  const selectedResource = RESOURCES.find((r) => r.value === resourceType);
  const selectedSubLabel = (SUBCATEGORIES[resourceType] || []).find(
    (s) => s.value === subCategory
  )?.label;

  const timestamp = useMemo(
    () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    []
  );

  const completedSteps = (resourceType ? 1 : 0) + (coordinates && wardId ? 1 : 0) + (quantity ? 1 : 0);

  const canSubmit = resourceType && coordinates && wardId && Number(quantity) > 0 && !submitting;

  // Submitting no longer logs anything publicly - it sends the delivery out.
  // It's only logged (public register, analytics, duplicate check) once the
  // responder presses "Mark delivered" on it.
  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    setDeliveryError("");
    try {
      const created = await startDelivery({
        resourceType,
        subCategory: subCategory || undefined,
        quantity: Number(quantity),
        ward: wardId,
        location: { coordinates },
        need: needId || undefined,
      });
      setDeliveries((d) => [created, ...d]);
      setDeliveryNotice("Delivery is on its way. Mark it delivered once it reaches the location.");

      // Fresh form for the next delivery
      setResourceType("");
      setSubCategory("");
      setQuantity("");
      setCoordinates(null);
      setWardId("");
      setNeedId(null);
    } catch (err) {
      setError(apiError(err, "Could not start this delivery."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelivered(delivery) {
    setDeliveryBusyId(delivery._id);
    setDeliveryError("");
    setDeliveryNotice("");

    // 1. Claim the arrival first (atomic), so a double click can't log twice.
    let arrived;
    try {
      arrived = await markDeliveryArrived(delivery._id);
    } catch (err) {
      setDeliveryError(apiError(err, "Could not mark this delivered."));
      getMyDeliveries().then(setDeliveries).catch(() => { });
      setDeliveryBusyId(null);
      return;
    }

    // 2. Now it has really arrived, log it to the public register.
    try {
      const data = await logDistribution({
        resourceType: arrived.resourceType,
        subCategory: arrived.subCategory || undefined,
        quantity: arrived.quantity,
        ward: arrived.ward?._id || arrived.ward,
        location: { coordinates: arrived.location.coordinates },
      });

      // Best-effort: close out the community need this delivery came from.
      if (arrived.need) {
        try {
          await markNeedAddressed(arrived.need);
        } catch {
          // ignore - the distribution itself already succeeded
        }
      }

      setDeliveries((d) => d.filter((x) => x._id !== delivery._id));
      setResultHadNeed(Boolean(arrived.need));
      setResult(data);
    } catch (err) {
      // Logging failed: put it back on the way so nothing is lost.
      try {
        await restoreDelivery(delivery._id);
      } catch {
        // ignore - the list refresh below shows the true state
      }
      setDeliveryError(apiError(err, "Could not log this distribution. It is still on its way - try again."));
      getMyDeliveries().then(setDeliveries).catch(() => { });
    } finally {
      setDeliveryBusyId(null);
    }
  }

  async function handleCancelDelivery(delivery) {
    setDeliveryBusyId(delivery._id);
    setDeliveryError("");
    setDeliveryNotice("");
    try {
      await cancelDelivery(delivery._id);
      setDeliveries((d) => d.filter((x) => x._id !== delivery._id));
      setDeliveryNotice("Delivery cancelled. Nothing was logged.");
    } catch (err) {
      setDeliveryError(apiError(err, "Could not cancel this delivery."));
      getMyDeliveries().then(setDeliveries).catch(() => { });
    } finally {
      setDeliveryBusyId(null);
    }
  }

  if (result) {
    const flagged = result.duplication?.flagged;
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header variant="responder" />
        <main className="w-full pt-16 flex-1 flex items-center justify-center">
          <div className="max-w-md w-full mx-auto p-space-lg text-center">
            <span
              className={`material-symbols-outlined text-[48px] mb-space-sm ${flagged ? "text-status-critical" : "text-status-confirmed"}`}
            >
              {flagged ? "warning" : "check_circle"}
            </span>
            <h1 className="font-headline-md text-headline-md text-on-surface mb-space-xs">
              {flagged ? "Delivered — possible duplicate flagged" : "Delivered and logged"}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mb-space-lg">
              {flagged
                ? result.distribution.duplicateNote
                : resultHadNeed
                  ? "It reached the location, so it is now visible on the public transparency dashboard, and the community need report it resolved has been closed out."
                  : "It reached the location, so it is now visible on the public transparency dashboard."}
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-space-sm">
              <button
                onClick={() => navigate("/responder/distributions")}
                className="h-11 px-6 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md shadow-sm hover:opacity-95 transition-opacity"
              >
                View My Distributions
              </button>
              <button
                onClick={() => setResult(null)}
                className="h-11 px-6 rounded-lg border border-surface-container-highest text-on-surface font-label-md text-label-md hover:bg-surface-container-low transition-colors"
              >
                Back to deliveries
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header variant="responder" />
      <main className="w-full pt-16 flex-1">
        <div className="max-w-[1120px] mx-auto px-gutter py-space-lg">
          <div className="flex flex-wrap items-start justify-between gap-space-md mb-space-lg">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                  Field Dispatch Log
                </span>
              </div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-1">
                Log a Relief Distribution
              </h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
                Record frontline deliveries directly to synchronize emergency supply balances across cluster teams.
              </p>
            </div>
            <div className="flex items-center gap-space-sm shrink-0">
              <StepBadge index={1} label="Resource" active={completedSteps >= 1} />
              <StepBadge index={2} label="Location" active={completedSteps >= 2} />
              <StepBadge index={3} label="Confirm" active={completedSteps >= 3} />
            </div>
          </div>

          {needId && (
            <div className="flex items-center gap-space-sm p-space-sm rounded-lg bg-secondary/10 border border-secondary/30 mb-space-md">
              <span className="material-symbols-outlined text-[18px] text-secondary">link</span>
              <p className="font-caption text-caption text-secondary">
                Pre-filled from a community need you claimed. Everything below is editable before you submit.
              </p>
            </div>
          )}

          {error && <p className="font-caption text-caption text-status-critical mb-space-md">{error}</p>}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-space-md items-start">
            <div className="flex flex-col gap-space-md">
              <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container-highest shadow-sm">
                <div className="flex items-center justify-between mb-space-sm">
                  <div>
                    <p className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">Step 01</p>
                    <h2 className="font-headline-sm text-headline-sm text-on-surface">Select Resource</h2>
                  </div>
                  <span className="font-caption text-caption text-on-surface-variant">Standard Cluster Type</span>
                </div>
                <ResourceGrid
                  value={resourceType}
                  onChange={setResourceType}
                  subCategory={subCategory}
                  onSubCategoryChange={setSubCategory}
                />
              </div>

              <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container-highest shadow-sm">
                <div className="flex items-center justify-between mb-space-sm">
                  <div>
                    <p className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">Step 02</p>
                    <h2 className="font-headline-sm text-headline-sm text-on-surface">Distribution Site</h2>
                  </div>
                  {coordinates && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-status-confirmed/10 text-status-confirmed">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      <span className="font-label-sm text-label-sm">GPS Verified</span>
                    </span>
                  )}
                </div>
                <MapPicker value={coordinates} onChange={setCoordinates} wardLabel={wardLabel(selectedWard)} />
                {coordinates && (
                  <p className="font-caption text-caption text-on-surface-variant mt-space-xs">
                    {coordinates[1].toFixed(4)}° N, {coordinates[0].toFixed(4)}° E
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-space-md">
              <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container-highest shadow-sm">
                <div className="flex items-center justify-between mb-space-md">
                  <div>
                    <p className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">Step 03</p>
                    <h2 className="font-headline-sm text-headline-sm text-on-surface">Confirm Log</h2>
                  </div>
                  <span className="font-caption text-caption text-on-surface-variant">Final Review</span>
                </div>

                <div className="space-y-space-sm">
                  <ConfirmRow
                    label="Resource Category"
                    value={selectedResource ? CATEGORY_LABELS[selectedResource.value] : "—"}
                  />

                  {selectedSubLabel && (
                    <ConfirmRow label="Specific Item" value={selectedSubLabel} bordered />
                  )}

                  <div className="flex items-center justify-between py-space-xs border-t border-surface-container-highest pt-space-sm">
                    <span className="font-label-md text-label-md text-on-surface-variant">Distribution Volume</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => String(Math.max(1, Number(q || 0) - 1)))}
                        className="w-7 h-7 rounded-full border border-surface-container-highest flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest active:scale-95 transition"
                        aria-label="Decrease quantity"
                      >
                        <span className="material-symbols-outlined text-[16px]">remove</span>
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="0"
                        className="w-12 text-center bg-surface-container-highest/40 rounded-md py-1 font-label-md text-label-md text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => String(Number(q || 0) + 1))}
                        className="w-7 h-7 rounded-full border border-surface-container-highest flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest active:scale-95 transition"
                        aria-label="Increase quantity"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-space-xs border-t border-surface-container-highest pt-space-sm">
                    <span className="font-label-md text-label-md text-on-surface-variant">Distribution Location</span>
                    <div className="text-right">
                      <span className="font-label-md text-label-md text-on-surface flex items-center justify-end gap-1">
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant">location_on</span>
                        {coordinates
                          ? `${coordinates[1].toFixed(4)}°, ${coordinates[0].toFixed(4)}°`
                          : "—"}
                      </span>
                      {selectedWard && (
                        <span className="font-caption text-caption text-on-surface-variant block">
                          {wardLabel(selectedWard)}
                        </span>
                      )}
                    </div>
                  </div>

                  <ConfirmRow
                    label="Field Team Lead"
                    value={user?.organizationName || "—"}
                    bordered
                  />
                  <ConfirmRow label="Timestamp" value={`Today, ${timestamp} NPT`} bordered />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="w-full h-12 mt-space-md rounded-lg bg-secondary text-on-secondary font-label-md text-label-md flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 hover:opacity-95 transition-opacity"
                >
                  <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                  <span>{submitting ? "Sending out..." : "Send Out for Delivery"}</span>
                </button>
                <p className="font-caption text-caption text-on-surface-variant text-center mt-space-xs flex items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">lock</span>
                  Logged to the public relief register once you mark it delivered
                </p>
              </div>

              <DeliveriesInProgress
                deliveries={deliveries}
                loading={deliveriesLoading}
                busyId={deliveryBusyId}
                error={deliveryError}
                notice={deliveryNotice}
                onDelivered={handleDelivered}
                onCancel={handleCancelDelivery}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Small panel under "Confirm Log": everything that has been sent out and is
// still on its way. A delivery only becomes a public distribution when the
// responder presses "Mark delivered" on it.
function DeliveriesInProgress({ deliveries, loading, busyId, error, notice, onDelivered, onCancel }) {
  return (
    <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container-highest shadow-sm">
      <div className="flex items-center justify-between mb-space-xs">
        <div className="flex items-center gap-space-sm">
          <div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px]">local_shipping</span>
          </div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">On the way</h2>
        </div>
        {deliveries.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-label-sm text-label-sm">
            {deliveries.length}
          </span>
        )}
      </div>
      <p className="font-caption text-caption text-on-surface-variant mb-space-sm">
        Deliveries are only logged once they reach the location. Press delivered when yours arrives.
      </p>

      {notice && (
        <div className="flex items-start gap-1.5 p-space-sm rounded-lg bg-status-confirmed/10 text-status-confirmed font-caption text-caption mb-space-sm">
          <span className="material-symbols-outlined text-[16px] shrink-0">check_circle</span>
          <span>{notice}</span>
        </div>
      )}
      {error && <p className="font-caption text-caption text-status-critical mb-space-sm">{error}</p>}

      <div className="flex flex-col gap-space-sm">
        {loading && <p className="font-body-sm text-body-sm text-on-surface-variant">Loading...</p>}

        {deliveries.map((d) => {
          const busy = busyId === d._id;
          const sub = (SUBCATEGORIES[d.resourceType] || []).find((x) => x.value === d.subCategory)?.label;
          return (
            <div key={d._id} className="rounded-lg border border-surface-container-highest p-space-sm">
              <div className="flex items-start justify-between gap-space-sm">
                <div className="min-w-0">
                  <p className="font-label-md text-label-md text-on-surface">
                    {d.quantity} × {CATEGORY_LABELS[d.resourceType] || d.resourceType}
                  </p>
                  {sub && <p className="font-caption text-caption text-on-surface-variant">{sub}</p>}
                  <p className="font-caption text-caption text-on-surface-variant flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-[13px]">location_on</span>
                    <span className="truncate">{wardLabel(d.ward) || "Selected location"}</span>
                  </p>
                  <p className="font-caption text-caption text-on-surface-variant">Sent {timeAgo(d.createdAt)}</p>
                </div>
                <span className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-status-pending/10 text-status-pending font-label-sm text-label-sm">
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-status-pending opacity-60 animate-ping" />
                    <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-status-pending" />
                  </span>
                  On the way
                </span>
              </div>
              <div className="flex gap-space-xs mt-space-sm">
                <button
                  type="button"
                  onClick={() => onDelivered(d)}
                  disabled={busy}
                  className="flex-1 h-10 rounded-lg bg-status-confirmed text-white font-label-md text-label-md shadow-sm hover:opacity-95 transition-opacity disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">task_alt</span>
                  {busy ? "Saving..." : "Mark delivered"}
                </button>
                <button
                  type="button"
                  onClick={() => onCancel(d)}
                  disabled={busy}
                  title="Cancel - it never went out"
                  className="h-10 px-3 rounded-lg border border-surface-container-highest text-on-surface-variant font-label-md text-label-md hover:bg-surface-container-low transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        })}

        {!loading && deliveries.length === 0 && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Nothing on the way. Send a delivery out above and it will wait here until it arrives.
          </p>
        )}
      </div>
    </div>
  );
}

function StepBadge({ index, label, active }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`w-6 h-6 rounded-full flex items-center justify-center font-label-sm text-label-sm ${active ? "bg-on-surface text-surface-container-lowest" : "border border-surface-container-highest text-on-surface-variant"
          }`}
      >
        {index}
      </span>
      <span className="font-label-sm text-label-sm text-on-surface-variant hidden sm:inline">{label}</span>
    </div>
  );
}

function ConfirmRow({ label, value, icon, bordered }) {
  return (
    <div className={`flex items-center justify-between py-space-xs ${bordered ? "border-t border-surface-container-highest pt-space-sm" : ""}`}>
      <span className="font-label-md text-label-md text-on-surface-variant">{label}</span>
      <span className="font-label-md text-label-md text-on-surface flex items-center gap-1">
        {icon && <span className="material-symbols-outlined text-[14px] text-on-surface-variant">{icon}</span>}
        {value}
      </span>
    </div>
  );
}