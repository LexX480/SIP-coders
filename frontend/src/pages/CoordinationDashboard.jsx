import { useCallback, useEffect, useRef, useState } from "react";
import Header from "../components/Header";
import StatCard from "../components/StatCard";
import StatusPill from "../components/StatusPill";
import MapView from "../components/MapView";
import { RESOURCES } from "../components/ResourceGrid";
import { getCoordinationDashboard, getWardPriorities, getNeeds } from "../api/client";

const ICONS = Object.fromEntries(RESOURCES.map((r) => [r.value, r.icon]));

const URGENCY_BORDER = {
  urgent: "border-l-status-critical",
  medium: "border-l-status-pending",
  low: "border-l-status-confirmed",
};

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Small count-up animation so the stat numbers feel alive when they refresh,
// instead of just snapping to the new value.
function useCountUp(value) {
  const [display, setDisplay] = useState(value ?? 0);
  const prevRef = useRef(value ?? 0);

  useEffect(() => {
    if (value === null || value === undefined) return;
    const from = prevRef.current;
    const to = value;
    if (from === to) return;
    const duration = 500;
    const start = performance.now();
    let raf;
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = to;
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return value === null || value === undefined ? "—" : display;
}

function AnimatedStatCard({ icon, label, value, accent }) {
  const display = useCountUp(typeof value === "number" ? value : null);
  const shown = typeof value === "number" ? display : value ?? "—";
  return (
    <div
      className={`group relative overflow-hidden bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-${accent}`}
    >
      <div
        className={`absolute -right-4 -top-4 w-20 h-20 rounded-full bg-${accent}/10 transition-transform duration-500 group-hover:scale-150`}
      />
      <div className="relative flex items-center gap-space-sm">
        <div
          className={`w-11 h-11 rounded-lg bg-${accent}/15 text-${accent} flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}
        >
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </div>
        <div>
          <p className="font-headline-sm text-headline-sm text-on-surface tabular-nums">{shown}</p>
          <p className="font-caption text-caption text-on-surface-variant">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Leaflet (and most tile-map libraries) size their canvas once on mount and
// don't notice later layout shifts from flex/grid reflow, which is what was
// leaving a gray strip under the map. Giving this wrapper one fixed height
// at every breakpoint (instead of switching between a mobile height and an
// "auto" desktop height) means the map never resizes after it first draws,
// so there's nothing for it to get out of sync with. A ResizeObserver is
// also wired in as a second line of defense for any map implementation that
// does listen for size changes.
function MapFrame({ markers }) {
  const frameRef = useRef(null);

  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      window.dispatchEvent(new Event("resize"));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      className="relative h-[420px] rounded-xl overflow-hidden border border-surface-container-highest shadow-sm bg-surface-container-lowest"
    >
      <MapView markers={markers} />
    </div>
  );
}

export default function CoordinationDashboard() {
  const [stats, setStats] = useState(null);
  const [priorities, setPriorities] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(() => {
    setRefreshing(true);
    getCoordinationDashboard().then(setStats).catch(() => setError("Could not load dashboard stats."));
    getWardPriorities().then(setPriorities).catch(() => setError("Could not load ward priorities."));
    getNeeds({ status: "open" })
      .then((data) => setNeeds([...data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))))
      .catch(() => setError("Could not load need reports."));
    setLastRefreshed(Date.now());
    window.setTimeout(() => setRefreshing(false), 500);
  }, []);

  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 20000);
    return () => clearInterval(id);
  }, [loadAll]);

  const activePriorities = priorities.filter((p) => p.openNeedsCount > 0);

  const markers = activePriorities
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
        {/* Hero band */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/80">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, white 0, transparent 45%), radial-gradient(circle at 80% 60%, white 0, transparent 40%)",
            }}
          />
          <div className="relative max-w-[1120px] mx-auto px-margin-mobile lg:px-margin py-space-lg">
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
              <div>
                <h1 className="font-headline-lg text-headline-lg text-white tracking-tight">
                  Coordination Dashboard
                </h1>
                <p className="font-caption text-caption text-white/70 mt-1">
                  Live view of unmet needs across Kathmandu Valley
                </p>
              </div>
              <button
                onClick={loadAll}
                className="h-9 px-3 rounded-lg bg-white/15 backdrop-blur text-white font-label-sm text-label-sm flex items-center gap-1.5 hover:bg-white/25 active:scale-95 transition-all duration-200"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-confirmed opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-status-confirmed" />
                </span>
                <span
                  className={`material-symbols-outlined text-[16px] transition-transform duration-500 ${refreshing ? "animate-spin" : ""
                    }`}
                >
                  refresh
                </span>
                {lastRefreshed ? `Updated ${timeAgo(new Date(lastRefreshed).toISOString())}` : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-[1120px] mx-auto px-margin-mobile lg:px-margin py-space-lg -mt-8">
          {error && (
            <p className="font-caption text-caption text-status-critical mb-space-md bg-status-critical/10 border border-status-critical/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md mb-space-lg">
            <AnimatedStatCard icon="report_problem" label="Unmet Needs" value={stats?.unmetNeeds} accent="status-critical" />
            <AnimatedStatCard
              icon="content_copy"
              label="Active Duplication Alerts"
              value={stats?.activeDuplicationAlerts}
              accent="status-pending"
            />
            <AnimatedStatCard
              icon="map"
              label="Wards Covered"
              value={stats ? `${stats.wardsCovered} / ${stats.totalWards}` : "—"}
              accent="primary"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-md items-stretch">
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md flex flex-col h-[420px]">
              <div className="flex items-center justify-between mb-space-sm shrink-0">
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Priority wards by unmet need</h2>
                {activePriorities.length > 0 && (
                  <span className="font-caption text-caption text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
                    {activePriorities.length} active
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-space-xs overflow-y-auto flex-1 min-h-0 pr-1">
                {activePriorities.map((p, i) => (
                  <div
                    key={p.ward._id}
                    style={{ animationDelay: `${i * 40}ms` }}
                    className={`animate-[fadeSlideIn_0.4s_ease-out_backwards] flex items-center justify-between p-space-sm rounded-lg border-l-4 bg-surface-container-low/0 hover:bg-surface-container-low hover:translate-x-1 transition-all duration-200 cursor-default ${URGENCY_BORDER[p.urgency] || "border-l-surface-container-highest"
                      }`}
                  >
                    <div>
                      <p className="font-label-md text-label-md text-on-surface">
                        {p.ward.name}, {p.ward.district}
                      </p>
                      <p className="font-caption text-caption text-on-surface-variant">
                        {p.resourceTypesNeeded.join(", ")} needed • {p.openNeedsCount} open report
                        {p.openNeedsCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <StatusPill status={p.urgency} />
                  </div>
                ))}
                {activePriorities.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                    <span className="material-symbols-outlined text-[32px] text-on-surface-variant/50">
                      task_alt
                    </span>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      No wards have open need reports right now.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <MapFrame markers={markers} />
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">Recent Need Reports</h2>
            <div className="flex flex-col gap-space-xs">
              {needs.map((n, i) => (
                <div
                  key={n._id}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className="animate-[fadeSlideIn_0.4s_ease-out_backwards] group flex items-center gap-space-sm p-space-sm rounded-lg hover:bg-surface-container-low hover:translate-x-1 transition-all duration-200"
                >
                  <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0 transition-transform duration-200 group-hover:scale-110">
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

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}