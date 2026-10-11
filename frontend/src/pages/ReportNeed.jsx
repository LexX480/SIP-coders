import { useEffect, useState } from "react";
import Header from "../components/Header";
import ResourceGrid, { SUBCATEGORIES } from "../components/ResourceGrid";
import UrgencyPills from "../components/UrgencyPills";
import MapPicker from "../components/MapPicker";
import { getWards, reportNeed } from "../api/client";

export default function ReportNeed() {
  const [resourceType, setResourceType] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [quantityNeeded, setQuantityNeeded] = useState(1);
  const [urgency, setUrgency] = useState("medium");
  const [coordinates, setCoordinates] = useState(null);
  const [wardId, setWardId] = useState("");
  const [wards, setWards] = useState([]);
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getWards().then(setWards).catch(() => setError("Could not load wards."));
  }, []);

  useEffect(() => {
    if (!coordinates || wards.length === 0) return;
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
  }, [coordinates, wards]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await reportNeed({
        resourceType,
        subCategory: subCategory || undefined,
        quantityNeeded,
        urgency,
        ward: wardId,
        location: { coordinates },
        reporterName: reporterName.trim(),
        reporterPhone: reporterPhone.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit this report.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header variant="responder" />
        <main className="w-full pt-16 flex-1 flex items-center justify-center">
          <div className="max-w-md w-full mx-auto p-space-lg text-center">
            <span className="material-symbols-outlined text-[48px] text-status-confirmed mb-space-sm">check_circle</span>
            <h1 className="font-headline-md text-headline-md text-on-surface mb-space-xs">Need reported</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Responders and coordinators can now see this on their dashboards.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const ward = wards.find((w) => w._id === wardId);
  const selectedSubLabel = (SUBCATEGORIES[resourceType] || []).find(
    (s) => s.value === subCategory
  )?.label;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header variant="responder" />
      <main className="w-full pt-16 flex-1">
        <form onSubmit={handleSubmit} className="max-w-xl mx-auto px-gutter py-space-lg space-y-space-lg">
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight text-center">Report a Need</h1>

          {error && <p className="font-caption text-caption text-status-critical text-center">{error}</p>}

          <div>
            <p className="font-label-md text-label-md text-on-surface mb-space-sm">What's needed?</p>
            <ResourceGrid
              value={resourceType}
              onChange={setResourceType}
              subCategory={subCategory}
              onSubCategoryChange={setSubCategory}
            />
            {selectedSubLabel && (
              <p className="font-caption text-caption text-on-surface-variant mt-space-xs">
                Reporting: <span className="text-on-surface">{selectedSubLabel}</span>
              </p>
            )}
          </div>

          <div>
            <p className="font-label-md text-label-md text-on-surface mb-space-sm">How much is needed?</p>
            <p className="font-caption text-caption text-on-surface-variant mb-space-sm">
              A rough estimate is fine - responders can adjust this when they log relief.
            </p>
            <div className="flex items-center gap-space-sm">
              <button
                type="button"
                onClick={() => setQuantityNeeded((q) => Math.max(1, q - 1))}
                className="w-11 h-11 rounded-lg border border-surface-container-highest flex items-center justify-center text-on-surface hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">remove</span>
              </button>
              <input
                type="number"
                min={1}
                value={quantityNeeded}
                onChange={(e) => setQuantityNeeded(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 h-11 rounded-lg border border-surface-container-highest bg-surface-container-highest/40 text-center font-label-lg text-label-lg text-on-surface [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setQuantityNeeded((q) => q + 1)}
                className="w-11 h-11 rounded-lg border border-surface-container-highest flex items-center justify-center text-on-surface hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
              </button>
              <span className="font-caption text-caption text-on-surface-variant">units</span>
            </div>
          </div>

          <div>
            <p className="font-label-md text-label-md text-on-surface mb-space-sm">How urgent?</p>
            <UrgencyPills value={urgency} onChange={setUrgency} />
          </div>

          <div>
            <p className="font-label-md text-label-md text-on-surface mb-space-sm">Who's reporting?</p>
            <p className="font-caption text-caption text-on-surface-variant mb-space-sm">
              Responders and coordinators will see this so they know who to follow up with. It isn't shown on the public transparency page.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Your full name"
                maxLength={80}
                required
                className="h-12 rounded-lg border border-surface-container-highest bg-surface-container-lowest px-space-sm font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-secondary/40"
              />
              <input
                type="tel"
                value={reporterPhone}
                onChange={(e) => setReporterPhone(e.target.value)}
                placeholder="Phone number"
                maxLength={20}
                required
                className="h-12 rounded-lg border border-surface-container-highest bg-surface-container-lowest px-space-sm font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-secondary/40"
              />
            </div>
          </div>

          <div>
            <p className="font-label-md text-label-md text-on-surface mb-space-sm">Where?</p>
            <MapPicker value={coordinates} onChange={setCoordinates} wardLabel={ward?.name} />
          </div>

          <button
            type="submit"
            disabled={!resourceType || !coordinates || !wardId || !reporterName.trim() || !reporterPhone.trim() || submitting}
            className="w-full h-12 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md shadow-sm disabled:opacity-40 hover:opacity-95 transition-opacity"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </form>
      </main>
    </div>
  );
}