import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import Header from "../components/Header";
import { RESOURCES, SUBCATEGORIES } from "../components/ResourceGrid";
import { getPublicDistributions, getWards } from "../api/client";

const DEFAULT_CENTER = [27.7, 85.3];

// One distinct, accessible color per resource category - used for the map
// marker fill, the legend swatch, and the sidebar accent, so the same color
// means the same resource everywhere on this page.
const RESOURCE_COLORS = {
  food: "#d97706",
  water: "#2563eb",
  shelter: "#7c3aed",
  medical: "#dc2626",
  electrical: "#ca8a04",
  clothing: "#059669",
};

function resourceMeta(resourceType) {
  return RESOURCES.find((r) => r.value === resourceType) || { label: resourceType, icon: "inventory_2" };
}

function subLabel(resourceType, subCategory) {
  if (!subCategory) return null;
  return (SUBCATEGORIES[resourceType] || []).find((s) => s.value === subCategory)?.label || null;
}

// "Ward 1, KTM, Naxal" - district shortened to KTM for Kathmandu (the only
// district currently seeded), full name kept for any other district, and
// the locality appended when the ward record has one.
function wardLabel(ward) {
  if (!ward) return "";
  const districtLabel = ward.district === "Kathmandu" ? "KTM" : ward.district;
  const parts = [ward.name, districtLabel, ward.locality].filter(Boolean);
  return parts.join(", ");
}

// "Ward 2" / "Ward 10" / "Ward 32" sort alphabetically as strings (10 before
// 2). parseInt(name) alone doesn't fix this - it returns NaN because the
// string starts with "Ward ", not a digit. Pull the number out with a
// regex instead, then sort on that. Falls back to a plain string compare
// for any ward whose name has no number in it at all.
function wardNumber(name) {
  const match = /\d+/.exec(name || "");
  return match ? parseInt(match[0], 10) : NaN;
}

function byWardNumber(a, b) {
  const numA = wardNumber(a.name);
  const numB = wardNumber(b.name);
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
  return a.name.localeCompare(b.name);
}

// A colored pin carrying the resource's Material Symbol glyph, so a marker
// reads as "medical supplies here" at a glance instead of being an
// unlabeled colored dot. Material Symbols is loaded globally as a font, so
// the ligature text works fine inside Leaflet's plain HTML divIcon.
function resourceDivIcon(resourceType) {
  const color = RESOURCE_COLORS[resourceType] || "#525252";
  const icon = resourceMeta(resourceType).icon;
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:32px;height:32px;border-radius:9999px;
        background:${color};border:2px solid white;
        box-shadow:0 1px 4px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
      ">
        <span class="material-symbols-outlined" style="font-size:18px;color:white;">${icon}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

export default function PublicTransparency() {
  const [distributions, setDistributions] = useState([]);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("map"); // "map" | "list"
  const [resourceFilter, setResourceFilter] = useState("all");
  const [wardFilter, setWardFilter] = useState("all");
  const [expandedType, setExpandedType] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPublicDistributions(), getWards()])
      .then(([dist, w]) => {
        if (cancelled) return;
        setDistributions(dist);
        setWards([...w].sort(byWardNumber));
      })
      .catch(() => !cancelled && setError("Could not load the public ledger."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return distributions.filter((d) => {
      if (resourceFilter !== "all" && d.resourceType !== resourceFilter) return false;
      if (wardFilter !== "all" && (d.ward?._id || d.ward?.name) !== wardFilter) return false;
      return true;
    });
  }, [distributions, resourceFilter, wardFilter]);

  // Aggregate stats for the filtered set - fills out the sidebar header and
  // gives a sense of scale before anyone drills into a specific resource.
  const stats = useMemo(() => {
    const totalUnits = filtered.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);
    const wardsReached = new Set(filtered.map((d) => d.ward?._id || d.ward?.name)).size;
    const orgsReached = new Set(filtered.map((d) => d.organizationName).filter(Boolean)).size;
    return { totalEntries: filtered.length, totalUnits, wardsReached, orgsReached };
  }, [filtered]);

  // Most recent entries across all resource types, newest first - gives the
  // sidebar a live-feed feel instead of just a static legend.
  const recentActivity = useMemo(() => {
    return [...filtered].sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt)).slice(0, 8);
  }, [filtered]);

  // Resource-type legend entries, each carrying its own matching
  // distribution records so the sidebar dropdown can list "who donated
  // this, and where" without a second request.
  const legend = useMemo(() => {
    const byType = new Map();
    for (const d of filtered) {
      if (!byType.has(d.resourceType)) byType.set(d.resourceType, []);
      byType.get(d.resourceType).push(d);
    }
    return RESOURCES.map((r) => ({
      ...r,
      color: RESOURCE_COLORS[r.value] || "#525252",
      entries: byType.get(r.value) || [],
    })).filter((r) => r.entries.length > 0);
  }, [filtered]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header variant="responder" />
      <main className="w-full pt-16 flex-1">
        <div className="max-w-[1280px] mx-auto px-gutter py-space-lg">
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight mb-space-md">
            Public Transparency Dashboard
          </h1>

          {/* Filter row */}
          <div className="flex flex-wrap items-center justify-between gap-space-sm mb-space-md">
            <div className="flex flex-wrap items-center gap-space-xs">
              <select
                value={resourceFilter}
                onChange={(e) => setResourceFilter(e.target.value)}
                className="h-10 px-3 rounded-lg bg-surface-container-lowest border border-surface-container-highest font-label-sm text-label-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
              >
                <option value="all">All resources</option>
                {RESOURCES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <select
                value={wardFilter}
                onChange={(e) => setWardFilter(e.target.value)}
                className="h-10 px-3 rounded-lg bg-surface-container-lowest border border-surface-container-highest font-label-sm text-label-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
              >
                <option value="all">All wards</option>
                {wards.map((w) => (
                  <option key={w._id} value={w._id}>
                    {wardLabel(w)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-container-highest">
              <button
                onClick={() => setView("map")}
                className={`h-8 px-3 rounded-md font-label-sm text-label-sm transition-colors ${view === "map" ? "bg-surface-container-lowest text-on-surface shadow-sm" : "text-on-surface-variant"
                  }`}
              >
                Map
              </button>
              <button
                onClick={() => setView("list")}
                className={`h-8 px-3 rounded-md font-label-sm text-label-sm transition-colors ${view === "list" ? "bg-surface-container-lowest text-on-surface shadow-sm" : "text-on-surface-variant"
                  }`}
              >
                List
              </button>
            </div>
          </div>

          {error && <p className="font-caption text-caption text-status-critical mb-space-md">{error}</p>}

          {/* Main layout: map/list on the left, resource legend on the right */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-space-md items-stretch">
            {/* Left: map or list */}
            {view === "map" ? (
              <div className="rounded-xl overflow-hidden border border-surface-container-highest h-[420px] sm:h-[520px]">
                <MapContainer center={DEFAULT_CENTER} zoom={10} className="w-full h-full">
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {filtered
                    .filter((d) => d.location?.coordinates)
                    .map((d) => (
                      <Marker
                        key={d._id}
                        position={[d.location.coordinates[1], d.location.coordinates[0]]}
                        icon={resourceDivIcon(d.resourceType)}
                      >
                        <Popup>
                          <div className="font-label-sm text-label-sm">
                            <p className="font-label-md text-label-md mb-0.5">{resourceMeta(d.resourceType).label}</p>
                            {subLabel(d.resourceType, d.subCategory) && (
                              <p className="text-on-surface-variant mb-0.5">{subLabel(d.resourceType, d.subCategory)}</p>
                            )}
                            <p className="text-on-surface-variant">
                              {d.quantity} units &bull; {wardLabel(d.ward)}
                            </p>
                            <p className="text-on-surface-variant">{d.organizationName || "Unnamed organization"}</p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                </MapContainer>
              </div>
            ) : (
              <div className="rounded-xl border border-surface-container-highest divide-y divide-surface-container-highest overflow-hidden">
                {loading && (
                  <div className="p-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">
                    Loading public ledger...
                  </div>
                )}
                {!loading && filtered.length === 0 && (
                  <div className="p-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">
                    No distributions match these filters.
                  </div>
                )}
                {filtered.map((d) => (
                  <div key={d._id} className="flex items-center gap-space-sm p-space-sm bg-surface-container-lowest">
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: RESOURCE_COLORS[d.resourceType] || "#525252" }}
                    >
                      <span className="material-symbols-outlined text-[18px] text-white">
                        {resourceMeta(d.resourceType).icon}
                      </span>
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-label-md text-label-md text-on-surface truncate">
                        {d.quantity} {resourceMeta(d.resourceType).label}
                        {subLabel(d.resourceType, d.subCategory) ? ` • ${subLabel(d.resourceType, d.subCategory)}` : ""}
                      </p>
                      <p className="font-caption text-caption text-on-surface-variant truncate">
                        {d.organizationName || "Unnamed organization"} &bull; {wardLabel(d.ward)}
                      </p>
                    </div>
                    <span className="font-caption text-caption text-on-surface-variant shrink-0">
                      {new Date(d.loggedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Right: stats + resource legend + live activity feed, stretched to match the map's height */}
            <div className="flex flex-col gap-space-sm h-[420px] sm:h-[520px]">
              {/* Quick stats */}
              <div className="grid grid-cols-2 gap-1.5 shrink-0">
                <SidebarStat label="Entries" value={stats.totalEntries} icon="inventory_2" />
                <SidebarStat label="Units Distributed" value={stats.totalUnits} icon="package_2" />
                <SidebarStat label="Wards Reached" value={stats.wardsReached} icon="location_on" />
                <SidebarStat label="Organizations" value={stats.orgsReached} icon="groups" />
              </div>

              {/* Resource legend */}
              <div className="rounded-xl border border-surface-container-highest bg-surface-container-lowest p-space-sm shrink-0">
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-space-xs">
                  Resource Types
                </p>

                {legend.length === 0 && (
                  <p className="font-caption text-caption text-on-surface-variant py-space-sm text-center">
                    No logged resources match these filters yet.
                  </p>
                )}

                <div className="flex flex-col gap-1">
                  {legend.map((r) => {
                    const isOpen = expandedType === r.value;
                    return (
                      <div key={r.value} className="rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedType(isOpen ? null : r.value)}
                          className="w-full flex items-center gap-2 py-space-xs px-1.5 hover:bg-surface-container-highest rounded-lg transition-colors"
                        >
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: r.color }} />
                          <span className="font-label-md text-label-md text-on-surface flex-1 text-left">{r.label}</span>
                          <span className="font-caption text-caption text-on-surface-variant">{r.entries.length}</span>
                          <span
                            className={`material-symbols-outlined text-[18px] text-on-surface-variant transition-transform ${isOpen ? "rotate-180" : ""
                              }`}
                          >
                            expand_more
                          </span>
                        </button>

                        {isOpen && (
                          <div className="pl-5 pr-1.5 pb-space-xs flex flex-col gap-1.5">
                            {r.entries.map((d) => (
                              <div
                                key={d._id}
                                className="flex items-start justify-between gap-2 py-1.5 px-2 rounded-md bg-background"
                              >
                                <div className="min-w-0">
                                  <p className="font-label-sm text-label-sm text-on-surface truncate">
                                    {d.organizationName || "Unnamed organization"}
                                  </p>
                                  <p className="font-caption text-caption text-on-surface-variant truncate">
                                    {wardLabel(d.ward)}
                                    {subLabel(d.resourceType, d.subCategory) ? ` • ${subLabel(d.resourceType, d.subCategory)}` : ""}
                                  </p>
                                </div>
                                <span className="font-caption text-caption text-on-surface-variant shrink-0">
                                  {d.quantity}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent activity feed - fills the remaining sidebar height and
                  keeps the panel feeling live instead of static once the
                  legend above it is short. */}
              <div className="rounded-xl border border-surface-container-highest bg-surface-container-lowest p-space-sm flex-1 min-h-0 flex flex-col">
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-space-xs shrink-0">
                  Recent Activity
                </p>
                <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5">
                  {recentActivity.length === 0 && (
                    <p className="font-caption text-caption text-on-surface-variant py-space-sm text-center">
                      No activity yet.
                    </p>
                  )}
                  {recentActivity.map((d) => (
                    <div key={d._id} className="flex items-start gap-2 py-1 px-1.5 rounded-md hover:bg-surface-container-highest transition-colors">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: RESOURCE_COLORS[d.resourceType] || "#525252" }}
                      >
                        <span className="material-symbols-outlined text-[13px] text-white">
                          {resourceMeta(d.resourceType).icon}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-label-sm text-label-sm text-on-surface truncate">
                          {d.quantity} {resourceMeta(d.resourceType).label}
                        </p>
                        <p className="font-caption text-caption text-on-surface-variant truncate">
                          {d.organizationName || "Unnamed organization"} &bull; {wardLabel(d.ward)}
                        </p>
                      </div>
                      <span className="font-caption text-caption text-on-surface-variant shrink-0">
                        {new Date(d.loggedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SidebarStat({ label, value, icon }) {
  return (
    <div className="rounded-xl border border-surface-container-highest bg-surface-container-lowest p-space-xs">
      <div className="flex items-center justify-between mb-0.5">
        <span className="font-caption text-caption text-on-surface-variant truncate">{label}</span>
        <span className="material-symbols-outlined text-[14px] text-on-surface-variant shrink-0">{icon}</span>
      </div>
      <p className="font-headline-sm text-headline-sm text-on-surface">{value}</p>
    </div>
  );
}