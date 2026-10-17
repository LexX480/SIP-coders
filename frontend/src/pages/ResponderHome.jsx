import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import StatusPill from "../components/StatusPill";
import PickupAlerts from "../components/PickupAlerts";
import { RESOURCES, SUBCATEGORIES } from "../components/ResourceGrid";
import { getResponderDashboard, getNeeds, claimNeed, unclaimNeed } from "../api/client";
import { useAuth } from "../context/AuthContext";

const ICONS = Object.fromEntries(RESOURCES.map((r) => [r.value, r.icon]));
const LABELS = Object.fromEntries(RESOURCES.map((r) => [r.value, r.label]));

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

export default function ResponderHome() {
  const [stats, setStats] = useState(null);
  const [needs, setNeeds] = useState([]);
  const [selectedNeed, setSelectedNeed] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    getResponderDashboard()
      .then(setStats)
      .catch(() => setError("Could not load your stats. Is the backend running?"));

    loadNeeds();
  }, []);

  // Every need report, unsolved ones (open/claimed) first - and within that
  // group, anything a ward coordinator has assigned to this organization
  // comes first of all, so a transferred need doesn't get buried under
  // everything else that's merely urgent. Most urgent next, then solved
  // (addressed) ones pushed to the bottom, most recently resolved first.
  function loadNeeds() {
    getNeeds()
      .then((data) => {
        const urgencyWeight = { urgent: 3, medium: 2, low: 1 };
        const sorted = [...data].sort((a, b) => {
          const aSolved = a.status === "addressed" ? 1 : 0;
          const bSolved = b.status === "addressed" ? 1 : 0;
          if (aSolved !== bSolved) return aSolved - bSolved;
          if (aSolved) return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);

          const aAssignedToMe = a.assignedTo && user?._id && a.assignedTo._id === user._id ? 1 : 0;
          const bAssignedToMe = b.assignedTo && user?._id && b.assignedTo._id === user._id ? 1 : 0;
          if (aAssignedToMe !== bAssignedToMe) return bAssignedToMe - aAssignedToMe;

          return (urgencyWeight[b.urgency] || 0) - (urgencyWeight[a.urgency] || 0);
        });
        setNeeds(sorted.slice(0, 8));
      })
      .catch(() => { });
  }

  function openNeed(n) {
    setActionError("");
    setSelectedNeed(n);
  }

  function closeNeed() {
    setSelectedNeed(null);
    setActionError("");
  }

  async function handleClaim(need) {
    setActionLoading(true);
    setActionError("");
    try {
      const updated = await claimNeed(need._id);
      setNeeds((prev) => prev.map((n) => (n._id === updated._id ? updated : n)));
      setSelectedNeed(updated);
    } catch (err) {
      setActionError(err.response?.data?.message || "Could not claim this need.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnclaim(need) {
    setActionLoading(true);
    setActionError("");
    try {
      const updated = await unclaimNeed(need._id);
      setNeeds((prev) => prev.map((n) => (n._id === updated._id ? updated : n)));
      setSelectedNeed(updated);
    } catch (err) {
      setActionError(err.response?.data?.message || "Could not release this need.");
    } finally {
      setActionLoading(false);
    }
  }

  function handleLogRelief(need) {
    navigate("/responder/log", {
      state: {
        prefill: {
          resourceType: need.resourceType,
          subCategory: need.subCategory,
          quantity: need.quantityNeeded,
          wardId: need.ward?._id,
          coordinates: need.location?.coordinates,
          needId: need._id,
        },
      },
    });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header variant="responder" />
      <main className="w-full pt-16 flex-1">
        <div className="max-w-[1120px] mx-auto px-gutter py-space-lg">
          {/* Eyebrow row */}
          <div className="flex flex-wrap items-center justify-between gap-space-sm mb-space-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                Live Operations Field Session
              </span>
            </div>
            {/* Decorative location chip - wire to real org/ward data later */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low border border-surface-container-highest">
              <span className="material-symbols-outlined text-[14px] text-on-surface-variant">location_on</span>
              <span className="font-caption text-caption text-on-surface-variant">
                Kathmandu Valley Hub • Sector 04
              </span>
            </div>
          </div>

          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-space-lg">
            Responder Overview
          </h1>

          {error && <p className="font-caption text-caption text-status-critical mb-space-md">{error}</p>}

          {/* Pickups a coordinator has sent this organization's way - kept at
              the very top so volunteers can be sent out straight away. Hidden
              when there's nothing to collect or deliver. */}
          <PickupAlerts />

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md mb-space-md">
            <StatBlock
              label="Distributions Logged"
              icon="inventory_2"
              value={stats?.distributionsLogged}
              unit="deployments"
              footLeft="Current cycle"
              footRight="100% verified"
              footRightAccent="text-status-confirmed"
            />
            <StatBlock
              label="Wards Reached"
              icon="map"
              value={stats?.wardsReached}
              unit="municipal sectors"
              footLeft="Coverage range"
              footRight="Ward 3 to 11"
            />
            <StatBlock
              label="Active Alerts"
              icon="warning"
              value={stats?.activeAlerts}
              unit=""
              footLeft="Thamel Supply Delay"
              footRight="Priority B"
              footRightAccent="text-status-pending"
              valueAccent={stats?.activeAlerts > 0 ? "text-status-pending" : "text-on-surface"}
            />
          </div>

          {/* Wide dispatch CTA card */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-space-md p-space-lg rounded-xl bg-surface-container-lowest border border-surface-container-highest shadow-sm mb-space-md">
            <div>
              <p className="font-label-sm text-label-sm text-secondary uppercase tracking-wider mb-1">
                Relief Dispatch Protocol
              </p>
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1">Record Dispatch in Field</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
                Synchronize supply quantities, beneficiary tallies, and GPS location coordinates directly to the
                central registry.
              </p>
            </div>
            <Link
              to="/responder/log"
              className="shrink-0 h-11 px-6 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-opacity"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Log a Distribution</span>
            </Link>
          </div>

          {/* Community needs reported nearby - unsolved (open/claimed) ones
              first, anything assigned to this organization pinned at the
              very top of that group, most urgent next, solved (addressed)
              ones at the bottom. Clicking a row opens the full report
              (including who reported it) so a responder can claim it and
              handle the relief themself. */}
          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container-highest shadow-sm mb-space-md">
            <div className="flex items-center justify-between mb-space-sm">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Community Needs Reported</h2>
              <Link to="/transparency" className="font-label-sm text-label-sm text-secondary underline">
                View all
              </Link>
            </div>
            <div className="flex flex-col gap-space-xs">
              {needs.map((n) => {
                const claimedByMe = n.claimedBy && user?._id && n.claimedBy._id === user._id;
                const assignedToMe = n.assignedTo && user?._id && n.assignedTo._id === user._id;
                const solved = n.status === "addressed";
                return (
                  <button
                    key={n._id}
                    type="button"
                    onClick={() => openNeed(n)}
                    className={`w-full flex items-center gap-space-sm p-space-sm rounded-lg hover:bg-surface-container-low text-left transition-colors ${solved ? "opacity-60" : ""
                      } ${assignedToMe && !solved ? "ring-1 ring-secondary/40 bg-secondary/5" : ""}`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
                      <span className="material-symbols-outlined text-[18px]">{ICONS[n.resourceType] || "inventory_2"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-label-md text-label-md text-on-surface truncate">
                        {LABELS[n.resourceType] || n.resourceType} - {wardLabel(n.ward)}
                      </p>
                      <p className="font-caption text-caption text-on-surface-variant">
                        Reported {timeAgo(n.createdAt)}
                        {n.status === "claimed" && (
                          <span className={claimedByMe ? "text-secondary" : "text-on-surface-variant"}>
                            {" "}• {claimedByMe ? "You're handling this" : `Claimed by ${n.claimedBy?.name || "a responder"}`}
                          </span>
                        )}
                      </p>
                    </div>
                    {assignedToMe && !solved && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full font-label-sm text-label-sm bg-secondary/10 text-secondary shrink-0">
                        <span className="material-symbols-outlined text-[14px]">call_split</span>
                        Assigned to you
                      </span>
                    )}
                    <span
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-label-sm text-label-sm shrink-0 ${solved ? "bg-status-confirmed/10 text-status-confirmed" : "bg-status-pending/10 text-status-pending"
                        }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">{solved ? "task_alt" : "pending"}</span>
                      {solved ? "Solved" : "Unsolved"}
                    </span>
                    <StatusPill status={n.urgency} />
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">chevron_right</span>
                  </button>
                );
              })}
              {needs.length === 0 && (
                <p className="font-body-sm text-body-sm text-on-surface-variant p-space-sm">
                  No open need reports right now.
                </p>
              )}
            </div>
          </div>

          {/* Device/session meta row - decorative telemetry, wire up later if useful */}
          <div className="flex flex-wrap items-center justify-between gap-space-sm px-1">
            <span className="font-caption text-caption text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">devices</span>
              Authenticated Device ID: {user?._id ? user._id.slice(-8).toUpperCase() : "KMD-OPS-772"}
            </span>
            <span className="font-caption text-caption text-on-surface-variant">Bandwidth: High / Stable</span>
            <span className="font-caption text-caption text-on-surface-variant">Offline Queue: Empty</span>
          </div>
        </div>
      </main>
      <Footer />

      {selectedNeed && (
        <NeedDetailModal
          need={selectedNeed}
          currentUserId={user?._id}
          loading={actionLoading}
          error={actionError}
          onClose={closeNeed}
          onClaim={() => handleClaim(selectedNeed)}
          onUnclaim={() => handleUnclaim(selectedNeed)}
          onLogRelief={() => handleLogRelief(selectedNeed)}
        />
      )}
    </div>
  );
}

function StatBlock({ label, icon, value, unit, footLeft, footRight, footRightAccent, valueAccent }) {
  return (
    <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container-highest shadow-sm">
      <div className="flex items-start justify-between mb-space-sm">
        <span className="font-caption text-caption text-on-surface-variant">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
          <span className="material-symbols-outlined text-[16px]">{icon}</span>
        </div>
      </div>
      <div className="flex items-baseline gap-1.5 mb-space-sm">
        <span className={`font-headline-lg text-headline-lg leading-none ${valueAccent || "text-on-surface"}`}>
          {value ?? "—"}
        </span>
        {unit && <span className="font-caption text-caption text-on-surface-variant">{unit}</span>}
      </div>
      <div className="flex items-center justify-between pt-space-sm border-t border-surface-container-highest">
        <span className="font-caption text-caption text-on-surface-variant">{footLeft}</span>
        <span className={`font-label-sm text-label-sm ${footRightAccent || "text-on-surface"}`}>{footRight}</span>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-space-sm py-space-xs">
      <span className="material-symbols-outlined text-[18px] text-on-surface-variant mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="font-caption text-caption text-on-surface-variant">{label}</p>
        <p className="font-label-md text-label-md text-on-surface break-words">{value}</p>
      </div>
    </div>
  );
}

function NeedDetailModal({ need, currentUserId, loading, error, onClose, onClaim, onUnclaim, onLogRelief }) {
  const subLabel = (SUBCATEGORIES[need.resourceType] || []).find((s) => s.value === need.subCategory)?.label;
  const claimedByMe = need.claimedBy && currentUserId && need.claimedBy._id === currentUserId;
  const claimedByOther = need.claimedBy && !claimedByMe;
  const assignedToMe = need.assignedTo && currentUserId && need.assignedTo._id === currentUserId;
  const [lng, lat] = need.location?.coordinates || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-gutter"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-lg border border-surface-container-highest overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-space-md border-b border-surface-container-highest">
          <div className="flex items-center gap-space-sm">
            <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">{ICONS[need.resourceType] || "inventory_2"}</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                {LABELS[need.resourceType] || need.resourceType}
              </h3>
              {subLabel && <p className="font-caption text-caption text-on-surface-variant">{subLabel}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container-low text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-space-md">
          <div className="flex items-center flex-wrap gap-space-sm mb-space-sm">
            <StatusPill status={need.urgency} />
            <span
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-label-sm text-label-sm ${need.status === "addressed" ? "bg-status-confirmed/10 text-status-confirmed" : "bg-status-pending/10 text-status-pending"
                }`}
            >
              <span className="material-symbols-outlined text-[14px]">{need.status === "addressed" ? "task_alt" : "pending"}</span>
              {need.status === "addressed" ? "Solved" : "Unsolved"}
            </span>
            {need.status === "claimed" && (
              <span
                className={`font-label-sm text-label-sm px-2.5 py-1 rounded-full ${claimedByMe ? "bg-secondary/10 text-secondary" : "bg-surface-container text-on-surface-variant"
                  }`}
              >
                {claimedByMe ? "You're handling this" : `Claimed by ${need.claimedBy?.name || "a responder"}`}
              </span>
            )}
            {assignedToMe && (
              <span className="flex items-center gap-1 font-label-sm text-label-sm px-2.5 py-1 rounded-full bg-secondary/10 text-secondary">
                <span className="material-symbols-outlined text-[14px]">call_split</span>
                Assigned to your organization
              </span>
            )}
          </div>

          <div className="divide-y divide-surface-container-highest">
            <DetailRow icon="person" label="Reported by" value={need.reporterName} />
            <DetailRow
              icon="call"
              label="Phone"
              value={
                need.reporterPhone ? (
                  <a href={`tel:${need.reporterPhone}`} className="text-secondary underline">
                    {need.reporterPhone}
                  </a>
                ) : null
              }
            />
            <DetailRow icon="inventory_2" label="Quantity needed" value={need.quantityNeeded ? `${need.quantityNeeded} units` : null} />
            <DetailRow icon="location_on" label="Ward" value={wardLabel(need.ward)} />
            <DetailRow
              icon="pin_drop"
              label="Coordinates"
              value={lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : null}
            />
            <DetailRow icon="schedule" label="Reported" value={timeAgo(need.createdAt)} />
          </div>

          {!need.reporterName && !need.reporterPhone && (
            <p className="font-caption text-caption text-on-surface-variant mt-space-sm">
              Reporter details aren't available for this entry.
            </p>
          )}

          {error && <p className="font-caption text-caption text-status-critical mt-space-sm">{error}</p>}
        </div>

        <div className="p-space-md pt-0 flex flex-col gap-space-xs">
          {need.status === "open" && (
            <button
              type="button"
              onClick={onClaim}
              disabled={loading}
              className="w-full h-11 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md shadow-sm disabled:opacity-40 hover:opacity-95 transition-opacity"
            >
              {loading ? "Claiming..." : "Claim this need"}
            </button>
          )}

          {claimedByMe && (
            <>
              <button
                type="button"
                onClick={onLogRelief}
                className="w-full h-11 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md shadow-sm hover:opacity-95 transition-opacity"
              >
                Log relief for this need
              </button>
              <button
                type="button"
                onClick={onUnclaim}
                disabled={loading}
                className="w-full h-11 rounded-lg border border-surface-container-highest text-on-surface font-label-md text-label-md disabled:opacity-40 hover:bg-surface-container-low transition-colors"
              >
                {loading ? "Releasing..." : "Release this need"}
              </button>
            </>
          )}

          {claimedByOther && (
            <p className="font-caption text-caption text-on-surface-variant text-center py-space-xs">
              Already being handled — check back if it isn't resolved soon.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}