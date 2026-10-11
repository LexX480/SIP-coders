import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import { RESOURCES, SUBCATEGORIES } from "../components/ResourceGrid";
import { getMyDistributions } from "../api/client";

const STATUS_STYLES = {
  confirmed: { label: "Confirmed", dot: "bg-status-confirmed", text: "text-status-confirmed", bg: "bg-status-confirmed/10" },
  possible_duplicate: { label: "Flagged", dot: "bg-status-critical", text: "text-status-critical", bg: "bg-status-critical/10" },
  pending: { label: "Pending", dot: "bg-status-pending", text: "text-status-pending", bg: "bg-status-pending/10" },
};

function resourceMeta(resourceType) {
  return RESOURCES.find((r) => r.value === resourceType) || { label: resourceType, icon: "inventory_2" };
}

function subLabel(resourceType, subCategory) {
  if (!subCategory) return null;
  return (SUBCATEGORIES[resourceType] || []).find((s) => s.value === subCategory)?.label || null;
}

function shortId(id) {
  return `#DIST-${(id || "").slice(-6).toUpperCase()}`;
}

function wardLabel(ward) {
  if (!ward) return "";
  const districtLabel = ward.district === "Kathmandu" ? "KTM" : ward.district;
  const parts = [ward.name, districtLabel, ward.locality].filter(Boolean);
  return parts.join(", ");
}

function toCsv(rows) {
  const header = ["ID", "Ward", "Resource", "Specific Item", "Quantity", "Status", "Logged At"];
  const lines = rows.map((d) =>
    [
      shortId(d._id),
      d.ward?.name || "",
      resourceMeta(d.resourceType).label,
      subLabel(d.resourceType, d.subCategory) || "",
      d.quantity,
      STATUS_STYLES[d.status]?.label || d.status,
      new Date(d.loggedAt).toLocaleString(),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

export default function MyDistributions() {
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [resourceFilter, setResourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    getMyDistributions()
      .then((data) => !cancelled && setDistributions(data))
      .catch(() => !cancelled && setError("Could not load your distributions."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return distributions.filter((d) => {
      if (resourceFilter !== "all" && d.resourceType !== resourceFilter) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const haystack = `${d.ward?.name || ""} ${shortId(d._id)} ${resourceMeta(d.resourceType).label} ${subLabel(d.resourceType, d.subCategory) || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [distributions, resourceFilter, statusFilter, query]);

  const stats = useMemo(() => {
    const totalVolume = filtered.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);
    const confirmed = filtered.filter((d) => d.status === "confirmed").length;
    const flagged = filtered.filter((d) => d.status === "possible_duplicate").length;
    const wardCount = new Set(filtered.map((d) => d.ward?._id || d.ward?.name)).size;
    return { totalVolume, confirmed, flagged, wardCount };
  }, [filtered]);

  function handleExport() {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `saajharahat-distributions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header variant="responder" />
      <main className="w-full pt-16 flex-1">
        <div className="max-w-[1120px] mx-auto px-gutter py-space-lg">
          {/* Sync status bar */}
          <div className="flex flex-wrap items-center justify-between gap-space-xs mb-space-md font-caption text-caption text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-status-confirmed animate-pulse" />
              Data synced with District Desk &bull; Last updated just now
            </span>
            <span className="flex items-center gap-1">
              Lalitpur &amp; Kathmandu Central Hub
              <span className="material-symbols-outlined text-[14px]">sync</span>
            </span>
          </div>

          {/* Header row */}
          <div className="flex flex-wrap items-start justify-between gap-space-sm mb-space-md">
            <div>
              <div className="flex flex-wrap items-center gap-space-xs mb-1">
                <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">My Distributions</h1>
                <span className="px-2.5 py-1 rounded-full bg-surface-container-highest font-label-sm text-label-sm text-on-surface-variant">
                  {filtered.length} {filtered.length === 1 ? "Entry" : "Total Entries"}
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
                Track and review logged relief supplies dispatched across active crisis clusters.
              </p>
            </div>
            <div className="flex items-center gap-space-xs shrink-0">
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className={`h-10 px-4 rounded-lg border flex items-center gap-1.5 font-label-md text-label-md transition-colors ${filtersOpen
                  ? "bg-on-surface text-surface-container-lowest border-on-surface"
                  : "bg-surface-container-lowest text-on-surface border-surface-container-highest hover:bg-surface-container-highest"
                  }`}
              >
                <span className="material-symbols-outlined text-[18px]">tune</span>
                Filter
              </button>
              <button
                onClick={handleExport}
                disabled={filtered.length === 0}
                className="h-10 px-4 rounded-lg bg-surface-container-lowest border border-surface-container-highest flex items-center gap-1.5 font-label-md text-label-md text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Export Log
              </button>
            </div>
          </div>

          {/* Filter panel */}
          {filtersOpen && (
            <div className="flex flex-wrap items-center gap-space-sm mb-space-md p-space-sm rounded-xl bg-surface-container-lowest border border-surface-container-highest">
              <div className="relative flex-1 min-w-[180px]">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2">
                  search
                </span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search ward, item, or ID"
                  className="w-full h-10 pl-9 pr-3 rounded-lg bg-background border border-surface-container-highest font-body-sm text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                />
              </div>
              <select
                value={resourceFilter}
                onChange={(e) => setResourceFilter(e.target.value)}
                className="h-10 px-3 rounded-lg bg-background border border-surface-container-highest font-label-sm text-label-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
              >
                <option value="all">All Resources</option>
                {RESOURCES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-3 rounded-lg bg-background border border-surface-container-highest font-label-sm text-label-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
              >
                <option value="all">All Statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="possible_duplicate">Flagged</option>
                <option value="pending">Pending</option>
              </select>
              {(query || resourceFilter !== "all" || statusFilter !== "all") && (
                <button
                  onClick={() => {
                    setQuery("");
                    setResourceFilter("all");
                    setStatusFilter("all");
                  }}
                  className="font-label-sm text-label-sm text-secondary hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm mb-space-md">
            <StatCard label="Total Volume" value={stats.totalVolume} icon="inventory_2" />
            <StatCard label="Confirmed" value={stats.confirmed} icon="check_circle" accent="text-status-confirmed" />
            <StatCard label="Flagged" value={stats.flagged} icon="warning" accent="text-status-critical" />
            <StatCard label="Wards Covered" value={stats.wardCount} icon="location_on" />
          </div>

          {error && <p className="font-caption text-caption text-status-critical mb-space-md">{error}</p>}

          {/* List */}
          <div className="flex flex-col gap-space-sm">
            {loading && (
              <div className="p-space-lg rounded-xl bg-surface-container-lowest border border-surface-container-highest text-center font-body-sm text-body-sm text-on-surface-variant">
                Loading your distributions...
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="p-space-lg rounded-xl bg-surface-container-lowest border border-dashed border-surface-container-highest text-center">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant mb-1 block">inbox</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {distributions.length === 0
                    ? "You haven't logged any distributions yet."
                    : "No entries match your filters."}
                </p>
              </div>
            )}

            {filtered.map((d) => {
              const meta = resourceMeta(d.resourceType);
              const statusStyle = STATUS_STYLES[d.status] || STATUS_STYLES.pending;
              const sub = subLabel(d.resourceType, d.subCategory);
              const isOpen = expandedId === d._id;

              return (
                <div
                  key={d._id}
                  className="rounded-xl bg-surface-container-lowest border border-surface-container-highest shadow-sm overflow-hidden transition-shadow hover:shadow-md"
                >
                  <button
                    onClick={() => setExpandedId(isOpen ? null : d._id)}
                    className="w-full flex items-center gap-space-sm p-space-sm text-left"
                    aria-expanded={isOpen}
                  >
                    <div className="w-11 h-11 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[22px] text-on-surface">{meta.icon}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-1.5">
                        <span className="font-label-md text-label-md text-on-surface truncate">
                          {d.ward?.name || "Unassigned Ward"}
                        </span>
                        <span className="font-caption text-caption text-on-surface-variant">{shortId(d._id)}</span>
                      </div>
                      <p className="font-caption text-caption text-on-surface-variant truncate">
                        {d.quantity} {meta.label.toLowerCase()}
                        {sub ? ` • ${sub}` : ""}
                      </p>
                    </div>

                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                      <span className="font-caption text-caption text-on-surface-variant">
                        {new Date(d.loggedAt).toLocaleDateString()}
                      </span>
                      <span
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                        <span className="font-label-sm text-label-sm">{statusStyle.label}</span>
                      </span>
                    </div>

                    <span
                      className={`material-symbols-outlined text-[20px] text-on-surface-variant shrink-0 transition-transform ${isOpen ? "rotate-180" : ""
                        }`}
                    >
                      expand_more
                    </span>
                  </button>

                  {/* Mobile-only status row */}
                  <div className="sm:hidden flex items-center justify-between px-space-sm pb-space-sm -mt-1">
                    <span className="font-caption text-caption text-on-surface-variant">
                      {new Date(d.loggedAt).toLocaleDateString()}
                    </span>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                      <span className="font-label-sm text-label-sm">{statusStyle.label}</span>
                    </span>
                  </div>

                  {isOpen && (
                    <div className="px-space-sm pb-space-sm pt-space-xs border-t border-surface-container-highest bg-background/40">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-space-md gap-y-space-xs py-space-sm">
                        <DetailRow label="Resource Category" value={meta.label} />
                        <DetailRow label="Specific Item" value={sub || "Not specified"} />
                        <DetailRow label="Quantity Logged" value={String(d.quantity)} />
                        <DetailRow label="Entry Type" value={d.entryType === "planned" ? "Planned" : "Logged (Delivered)"} />
                        <DetailRow
                          label="Coordinates"
                          value={
                            d.location?.coordinates
                              ? `${d.location.coordinates[1].toFixed(4)}°, ${d.location.coordinates[0].toFixed(4)}°`
                              : "—"
                          }
                        />
                        <DetailRow label="Ward & Locality" value={d.ward ? wardLabel(d.ward) : "—"} />
                        <DetailRow label="Logged At" value={new Date(d.loggedAt).toLocaleString()} />
                        <DetailRow label="Record ID" value={d._id} mono />
                      </div>

                      {d.status === "possible_duplicate" && d.duplicateNote && (
                        <div className="flex items-start gap-2 p-space-xs rounded-lg bg-status-critical/10 mb-space-xs">
                          <span className="material-symbols-outlined text-[16px] text-status-critical mt-0.5">warning</span>
                          <p className="font-caption text-caption text-status-critical">{d.duplicateNote}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-space-xs">
                        <a
                          href="/transparency"
                          className="h-9 px-3 rounded-lg border border-surface-container-highest flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface hover:bg-surface-container-highest transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">public</span>
                          View on Public Transparency
                        </a>
                        <button
                          onClick={() => navigator.clipboard?.writeText(d._id)}
                          className="h-9 px-3 rounded-lg border border-surface-container-highest flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface hover:bg-surface-container-highest transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">content_copy</span>
                          Copy Record ID
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Audit footer card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs p-space-md mt-space-md rounded-xl bg-surface-container-highest/40">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant mt-0.5">verified_user</span>
              <div>
                <p className="font-label-md text-label-md text-on-surface">Decentralized Multi-Agency Audit</p>
                <p className="font-caption text-caption text-on-surface-variant">
                  Log integrity verified cryptographically on local coordination mesh. No centralized bottleneck.
                </p>
              </div>
            </div>
            <span className="font-caption text-caption text-on-surface-variant shrink-0 sm:text-right">
              Agency ledgers actively reconciling
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon, accent = "text-on-surface" }) {
  return (
    <div className="p-space-sm rounded-xl bg-surface-container-lowest border border-surface-container-highest">
      <div className="flex items-center justify-between mb-1">
        <span className="font-caption text-caption text-on-surface-variant">{label}</span>
        <span className={`material-symbols-outlined text-[16px] ${accent}`}>{icon}</span>
      </div>
      <p className={`font-headline-sm text-headline-sm ${accent}`}>{value}</p>
    </div>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-space-sm">
      <span className="font-caption text-caption text-on-surface-variant shrink-0">{label}</span>
      <span className={`font-label-sm text-label-sm text-on-surface text-right truncate ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}