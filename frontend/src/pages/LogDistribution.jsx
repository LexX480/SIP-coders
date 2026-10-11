import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import ResourceGrid, { RESOURCES, SUBCATEGORIES } from "../components/ResourceGrid";
import MapPicker from "../components/MapPicker";
import { getWards, logDistribution, markNeedAddressed } from "../api/client";
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

export default function LogDistribution() {
  const routerLocation = useLocation();
  const prefill = routerLocation.state?.prefill;

  const [resourceType, setResourceType] = useState(prefill?.resourceType || "");
  const [subCategory, setSubCategory] = useState(prefill?.subCategory || "");
  const [coordinates, setCoordinates] = useState(prefill?.coordinates || null);
  const [wardId, setWardId] = useState(prefill?.wardId || "");
  const [quantity, setQuantity] = useState(prefill?.quantity ? String(prefill.quantity) : "");
  const [needId] = useState(prefill?.needId || null);
  const [wards, setWards] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    getWards().then(setWards).catch(() => setError("Could not load wards."));
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

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const data = await logDistribution({
        resourceType,
        subCategory: subCategory || undefined,
        quantity: Number(quantity),
        ward: wardId,
        location: { coordinates },
      });

      // Best-effort: if this log came from claiming a community need,
      // close the loop by marking that need addressed. A failure here
      // shouldn't block the responder from seeing their successful log.
      if (needId) {
        try {
          await markNeedAddressed(needId);
        } catch {
          // ignore - the distribution itself already succeeded
        }
      }

      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not log this distribution.");
    } finally {
      setSubmitting(false);
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
              {flagged ? "Logged — possible duplicate flagged" : "Distribution logged"}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mb-space-lg">
              {flagged
                ? result.distribution.duplicateNote
                : needId
                  ? "This distribution is now visible on the public transparency dashboard, and the community need report it resolved has been closed out."
                  : "This distribution is now visible on the public transparency dashboard."}
            </p>
            <button
              onClick={() => navigate("/responder/distributions")}
              className="h-11 px-6 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md shadow-sm hover:opacity-95 transition-opacity"
            >
              View My Distributions
            </button>
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
                <span className="material-symbols-outlined text-[18px]">sync</span>
                <span>{submitting ? "Submitting..." : "Submit Distribution"}</span>
              </button>
              <p className="font-caption text-caption text-on-surface-variant text-center mt-space-xs flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[13px]">lock</span>
                Immutable entry recorded to public relief register
              </p>
            </div>
          </div>
        </div>
      </main>
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