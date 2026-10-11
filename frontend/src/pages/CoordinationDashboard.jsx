import { useCallback, useEffect, useState } from "react";
import Header from "../components/Header";
import StatCard from "../components/StatCard";
import StatusPill from "../components/StatusPill";
import MapView from "../components/MapView";
import { RESOURCES } from "../components/ResourceGrid";
import { getCoordinationDashboard, getWardPriorities, getNeeds } from "../api/client";

const ICONS = Object.fromEntries(RESOURCES.map((r) => [r.value, r.icon]));

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function CoordinationDashboard() {
  const [stats, setStats] = useState(null);
  const [priorities, setPriorities] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const loadAll = useCallback(() => {
    getCoordinationDashboard().then(setStats).catch(() => setError("Could not load dashboard stats."));
    getWardPriorities().then(setPriorities).catch(() => setError("Could not load ward priorities."));
    // Every individual open need report, newest first - this is the raw
    // feed that guarantees a just-submitted report is always visible, even
    // if it's not the single highest-urgency item in its ward.
    getNeeds({ status: "open" })
      .then((data) => setNeeds([...data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))))
      .catch(() => setError("Could not load need reports."));
    setLastRefreshed(Date.now());
  }, []);

  useEffect(() => {
    loadAll();
    // Auto-refresh so newly reported needs show up without a manual reload
    const id = setInterval(loadAll, 20000);
    return () => clearInterval(id);
  }, [loadAll]);

  const markers = priorities
    .filter((p) => p.location?.coordinates)
    .map((p) => ({
      id: p.ward._id,
      lng: p.location.coordinates[0],
      lat: p.location.coordinates[1],
      resourceType: "shelter",
      label: `${p.ward.name} — score ${p.score}`,
    }));

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header variant="coordination" />
      <main className="w-full pt-16 flex-1">
        <div className="max-w-[1120px] mx-auto px-margin-mobile lg:px-margin py-space-lg">
          <div className="flex flex-wrap items-center justify-between gap-space-sm mb-space-md">
            <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Coordination Dashboard</h1>
            <button
              onClick={loadAll}
              className="h-9 px-3 rounded-lg border border-surface-container-highest bg-surface-container-lowest font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1.5 hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              {lastRefreshed ? `Updated ${timeAgo(new Date(lastRefreshed).toISOString())}` : "Refresh"}
            </button>
          </div>

          {error && <p className="font-caption text-caption text-status-critical mb-space-md">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md mb-space-lg">
            <StatCard icon="report_problem" label="Unmet Needs" value={stats?.unmetNeeds ?? "—"} />
            <StatCard icon="content_copy" label="Active Duplication Alerts" value={stats?.activeDuplicationAlerts ?? "—"} />
            <StatCard
              icon="map"
              label="Wards Covered"
              value={stats ? `${stats.wardsCovered} / ${stats.totalWards}` : "—"}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-md">
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md">
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">Priority wards by unmet need</h2>
              <div className="flex flex-col gap-space-xs">
                {priorities.map((p) => (
                  <div
                    key={p.ward._id}
                    className="flex items-center justify-between p-space-sm rounded-lg hover:bg-surface-container-low"
                  >
                    <div>
                      <p className="font-label-md text-label-md text-on-surface">
                        {p.ward.name}, {p.ward.district}
                      </p>
                      <p className="font-caption text-caption text-on-surface-variant">
                        {p.openNeedsCount > 0
                          ? `${p.resourceTypesNeeded.join(", ")} needed • ${p.openNeedsCount} open report${p.openNeedsCount === 1 ? "" : "s"}`
                          : "No open reports"}
                      </p>
                    </div>
                    <StatusPill status={p.urgency} />
                  </div>
                ))}
                {priorities.length === 0 && (
                  <p className="font-body-sm text-body-sm text-on-surface-variant p-space-sm">No ward data yet.</p>
                )}
              </div>
            </div>

            <div className="h-[360px] lg:h-auto">
              <MapView markers={markers} />
            </div>
          </div>

          {/* Raw feed of every open need report - guarantees a just-submitted
              report is visible immediately, independent of per-ward
              aggregation above. */}
          <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">Recent Need Reports</h2>
            <div className="flex flex-col gap-space-xs">
              {needs.map((n) => (
                <div key={n._id} className="flex items-center gap-space-sm p-space-sm rounded-lg hover:bg-surface-container-low">
                  <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
                    <span className="material-symbols-outlined text-[18px]">{ICONS[n.resourceType] || "inventory_2"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-label-md text-on-surface">
                      {n.resourceType} — {n.ward?.name}, {n.ward?.district}
                    </p>
                    <p className="font-caption text-caption text-on-surface-variant">
                      Reported {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  <StatusPill status={n.urgency} />
                </div>
              ))}
              {needs.length === 0 && (
                <p className="font-body-sm text-body-sm text-on-surface-variant p-space-sm">
                  No open need reports right now.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}