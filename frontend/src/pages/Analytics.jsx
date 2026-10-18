import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Header from "../components/Header";
import { RESOURCES } from "../components/ResourceGrid";
import { getByCategory, getLogisticsAnalytics, getVolumeOverTime } from "../api/client";

const ICONS = Object.fromEntries(RESOURCES.map((r) => [r.value, r.icon]));

const CATEGORY_COLORS = {
  food: "#D7263D",
  water: "#2E86AB",
  medical: "#1B2A4A",
  shelter: "#E0A458",
  electrical: "#6A4C93",
  clothing: "#2A9D8F",
};

function CustomTooltip({ active, payload, label, suffix = "" }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-surface-container-lowest border border-surface-container-highest rounded-lg shadow-lg px-3 py-2">
      <p className="font-caption text-caption text-on-surface-variant mb-0.5">{label}</p>
      <p className="font-label-md text-label-md text-on-surface">
        {payload[0].value} {suffix}
      </p>
    </div>
  );
}

function SummaryStat({ icon, label, value, sub, accent, pulse }) {
  return (
    <div className="group relative overflow-hidden bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div
        className={`absolute -right-4 -top-4 w-20 h-20 rounded-full bg-${accent}/10 transition-transform duration-500 group-hover:scale-150`}
      />
      <div className="relative flex items-start justify-between">
        <div
          className={`w-10 h-10 rounded-lg bg-${accent}/15 text-${accent} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}
        >
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
        {pulse && (
          <span className="relative flex h-2 w-2 mt-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-confirmed opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-status-confirmed" />
          </span>
        )}
      </div>
      <p className="relative font-headline-sm text-headline-sm text-on-surface mt-space-sm tabular-nums">{value}</p>
      <p className="relative font-caption text-caption text-on-surface-variant">{label}</p>
      {sub && <p className="relative font-caption text-caption text-on-surface-variant/70 mt-0.5">{sub}</p>}
    </div>
  );
}


// "95" -> "95 min", "135" -> "2h 15m", null -> "—"
function formatMins(mins) {
  if (mins === null || mins === undefined) return "—";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) return `${Math.round(h / 24)}d`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const STATUS_STEPS = [
  { key: "pending_pickup", label: "Waiting for pickup", color: "#E0A458" },
  { key: "picked_up", label: "On the way", color: "#2E86AB" },
  { key: "delivered", label: "Delivered", color: "#2A9D8F" },
  { key: "cancelled", label: "Cancelled", color: "#9CA3AF" },
];

function Card({ title, children, className = "" }) {
  return (
    <div className={`bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md ${className}`}>
      <h2 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">{title}</h2>
      {children}
    </div>
  );
}

function FlowTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-surface-container-lowest border border-surface-container-highest rounded-lg shadow-lg px-3 py-2">
      <p className="font-caption text-caption text-on-surface-variant mb-0.5">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-label-md text-label-md text-on-surface">
          {p.name}: {p.value} units
        </p>
      ))}
    </div>
  );
}

// Warehouses & dispatches section, shown below the distribution analytics.
function LogisticsSection({ data, error }) {
  if (error) {
    return (
      <p className="font-caption text-caption text-status-critical mt-space-lg bg-status-critical/10 border border-status-critical/30 rounded-lg px-3 py-2">
        {error}
      </p>
    );
  }
  if (!data) return null;

  const { summary: s, dispatchStatus, flow, warehouses, stockByCategory, responders } = data;
  const totalDispatches = Object.values(dispatchStatus).reduce((a, b) => a + b, 0);
  const noActivity = flow.every((d) => d.received === 0 && d.sentOut === 0);
  const deliveredPct = s.unitsDispatched > 0 ? Math.round((s.unitsDelivered / s.unitsDispatched) * 100) : null;
  const stockTotal = stockByCategory.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <section className="mt-space-xl" aria-label="Warehouses and dispatches">
      <div className="mb-space-md">
        <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">Warehouses &amp; dispatches</h2>
        <p className="font-caption text-caption text-on-surface-variant">
          What's sitting in storage, and how quickly it's getting out to communities
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-md">
        <SummaryStat
          icon="warehouse"
          label="Stock on hand"
          value={s.totalStock}
          sub={`across ${s.warehouseCount} warehouse${s.warehouseCount === 1 ? "" : "s"}`}
          accent="primary"
        />
        <SummaryStat
          icon="inventory"
          label="Warehouse space used"
          value={s.utilisationPct !== null ? `${s.utilisationPct}%` : "—"}
          sub={s.totalCapacity ? `of ${s.totalCapacity} units capacity` : "no capacity set yet"}
          accent="status-pending"
        />
        <SummaryStat
          icon="local_shipping"
          label="Units dispatched"
          value={s.unitsDispatched}
          sub={`${s.dispatchCount} dispatch${s.dispatchCount === 1 ? "" : "es"} • ${s.needsServed} need${s.needsServed === 1 ? "" : "s"} served`}
          accent="secondary"
          pulse={s.inTransit > 0}
        />
        <SummaryStat
          icon="task_alt"
          label="Delivered"
          value={deliveredPct !== null ? `${deliveredPct}%` : "—"}
          sub={s.inTransit > 0 ? `${s.inTransit} still in transit` : `${s.unitsDelivered} units arrived`}
          accent="status-confirmed"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md mb-space-md">
        <Card title="Stock in vs. sent out" className="lg:col-span-2 h-[340px] flex flex-col">
          {noActivity ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              No stock has moved in the last 14 days.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flow} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E3DE" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#E5E3DE" }}
                  tickFormatter={(d) => d.slice(5)}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                <Tooltip content={<FlowTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="received" name="Received" fill="#2A9D8F" radius={[4, 4, 0, 0]} animationDuration={900} />
                <Bar dataKey="sentOut" name="Sent out" fill="#1B2A4A" radius={[4, 4, 0, 0]} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Dispatch pipeline">
          {totalDispatches === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">No dispatches yet.</p>
          ) : (
            <>
              <div className="flex h-3 rounded-full overflow-hidden bg-surface-container-highest mb-space-sm">
                {STATUS_STEPS.map((st) =>
                  dispatchStatus[st.key] ? (
                    <div
                      key={st.key}
                      title={`${st.label}: ${dispatchStatus[st.key]}`}
                      style={{ width: `${(dispatchStatus[st.key] / totalDispatches) * 100}%`, backgroundColor: st.color }}
                    />
                  ) : null
                )}
              </div>
              <div className="flex flex-col gap-1.5 mb-space-md">
                {STATUS_STEPS.map((st) => (
                  <div key={st.key} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: st.color }} />
                      {st.label}
                    </span>
                    <span className="font-label-md text-label-md text-on-surface tabular-nums">
                      {dispatchStatus[st.key] || 0}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-space-sm border-t border-surface-container-highest flex flex-col gap-1.5">
                {[
                  ["Dispatch to pickup", s.avgPickupMins],
                  ["Pickup to delivery", s.avgDeliveryMins],
                  ["Dispatch to delivered", s.avgTotalMins],
                ].map(([label, mins]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="font-caption text-caption text-on-surface-variant">Avg. {label.toLowerCase()}</span>
                    <span className="font-label-md text-label-md text-on-surface tabular-nums">{formatMins(mins)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        <Card title="Stock by warehouse" className="lg:col-span-2">
          <div className="flex flex-col gap-space-md">
            {warehouses.map((w) => (
              <div key={w._id}>
                <div className="flex items-center justify-between mb-1 gap-space-sm">
                  <span className="font-label-md text-label-md text-on-surface truncate">{w.name}</span>
                  <span className="font-caption text-caption text-on-surface-variant shrink-0">
                    {w.stock}
                    {w.capacity ? ` / ${w.capacity} units` : " units"}
                    {w.percentFull !== null ? ` • ${w.percentFull}%` : ""}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-container-highest overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${w.percentFull ?? (s.totalStock > 0 ? Math.round((w.stock / s.totalStock) * 100) : 0)}%`,
                      backgroundColor: w.percentFull >= 90 ? "#D7263D" : w.percentFull >= 70 ? "#E0A458" : "#1B2A4A",
                    }}
                  />
                </div>
                <p className="font-caption text-caption text-on-surface-variant/70 mt-0.5">
                  {w.unitsDispatched > 0
                    ? `${w.unitsDispatched} units sent out in ${w.dispatchCount} dispatch${w.dispatchCount === 1 ? "" : "es"}`
                    : "Nothing dispatched yet"}
                </p>
              </div>
            ))}
            {warehouses.length === 0 && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">No warehouses yet.</p>
            )}
          </div>

          {stockByCategory.length > 0 && (
            <div className="mt-space-md pt-space-md border-t border-surface-container-highest">
              <p className="font-label-md text-label-md text-on-surface mb-space-xs">What's in storage</p>
              <div className="flex h-3 rounded-full overflow-hidden bg-surface-container-highest mb-space-xs">
                {stockByCategory.map((c) => (
                  <div
                    key={c.resourceType}
                    title={`${c.resourceType}: ${c.quantity}`}
                    style={{ width: `${(c.quantity / stockTotal) * 100}%`, backgroundColor: CATEGORY_COLORS[c.resourceType] || "#D7263D" }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-space-md gap-y-1">
                {stockByCategory.map((c) => (
                  <span key={c.resourceType} className="flex items-center gap-1.5 font-caption text-caption text-on-surface-variant">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c.resourceType] || "#D7263D" }} />
                    <span className="capitalize">{c.resourceType}</span> {c.quantity}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title="Top responding organizations">
          <div className="flex flex-col divide-y divide-surface-container-highest">
            {responders.map((r, i) => (
              <div key={r.organizationName} className="py-space-sm first:pt-0 flex items-center gap-space-sm">
                <span className="w-6 h-6 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center font-label-sm text-label-sm shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-label-md text-label-md text-on-surface truncate">{r.organizationName}</p>
                  <p className="font-caption text-caption text-on-surface-variant">
                    {r.units} units • {r.delivered}/{r.dispatches} delivered
                  </p>
                </div>
              </div>
            ))}
            {responders.length === 0 && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                No dispatches have been assigned to organizations yet.
              </p>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

export default function Analytics() {
  const [volume, setVolume] = useState([]);
  const [byCategory, setByCategory] = useState([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [logistics, setLogistics] = useState(null);
  const [logisticsError, setLogisticsError] = useState("");

  useEffect(() => {
    Promise.all([
      getVolumeOverTime().then(setVolume),
      getByCategory().then(setByCategory),
    ])
      .catch(() => setError("Could not load analytics."))
      .finally(() => setLoaded(true));

    // Loaded separately so a problem here never blanks the charts above.
    getLogisticsAnalytics()
      .then(setLogistics)
      .catch(() => setLogisticsError("Could not load warehouse and dispatch analytics."));
  }, []);

  const insights = useMemo(() => {
    const totalDistributed = byCategory.reduce((sum, c) => sum + c.totalQuantity, 0);
    const sortedCategories = [...byCategory].sort((a, b) => b.totalQuantity - a.totalQuantity);
    const top = sortedCategories[0];
    const topShare = top && totalDistributed > 0 ? Math.round((top.totalQuantity / totalDistributed) * 100) : 0;

    const first = volume[0]?.totalQuantity;
    const last = volume[volume.length - 1]?.totalQuantity;
    let trendPct = null;
    if (typeof first === "number" && typeof last === "number" && first > 0) {
      trendPct = Math.round(((last - first) / first) * 100);
    }

    const avgPerEntry = volume.length > 0 ? Math.round(volume.reduce((s, v) => s + v.totalQuantity, 0) / volume.length) : 0;

    const activeCategories = byCategory.filter((c) => c.totalQuantity > 0).length;

    const ranked = sortedCategories.map((c) => ({
      ...c,
      pct: totalDistributed > 0 ? Math.round((c.totalQuantity / totalDistributed) * 100) : 0,
    }));

    return { totalDistributed, top, topShare, trendPct, avgPerEntry, activeCategories, ranked };
  }, [volume, byCategory]);

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header variant="coordination" />
      <main className="w-full pt-16 flex-1">
        {/* Hero band */}
        <div className="bg-primary">
          <div className="max-w-[1120px] mx-auto px-margin-mobile lg:px-margin py-space-lg">
            <h1 className="font-headline-lg text-headline-lg text-white tracking-tight">Analytics</h1>
            <p className="font-caption text-caption text-white/70 mt-1">
              How relief is flowing across wards and resource categories
            </p>
          </div>
        </div>

        <div className="max-w-[1120px] mx-auto px-margin-mobile lg:px-margin py-space-lg -mt-8">
          {error && (
            <p className="font-caption text-caption text-status-critical mb-space-md bg-status-critical/10 border border-status-critical/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Summary stat strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-lg">
            <SummaryStat
              icon="local_shipping"
              label="Total Distributed"
              value={loaded ? insights.totalDistributed : "—"}
              sub="units across all categories"
              accent="primary"
              pulse
            />
            <SummaryStat
              icon={insights.top ? ICONS[insights.top.resourceType] || "inventory_2" : "inventory_2"}
              label="Top Category"
              value={insights.top ? insights.top.resourceType : "—"}
              sub={insights.top ? `${insights.topShare}% of total volume` : ""}
              accent="status-pending"
            />
            <SummaryStat
              icon={insights.trendPct !== null && insights.trendPct < 0 ? "trending_down" : "trending_up"}
              label="Trend"
              value={insights.trendPct !== null ? `${insights.trendPct > 0 ? "+" : ""}${insights.trendPct}%` : "—"}
              sub="vs. start of period"
              accent={insights.trendPct !== null && insights.trendPct < 0 ? "status-critical" : "status-confirmed"}
            />
            <SummaryStat
              icon="category"
              label="Active Categories"
              value={insights.activeCategories}
              sub={`avg ${insights.avgPerEntry} units/entry`}
              accent="status-confirmed"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md mb-space-md">
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md h-[340px] flex flex-col">
              <div className="flex items-center justify-between mb-space-sm shrink-0">
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Distribution volume over time</h2>
                {insights.trendPct !== null && (
                  <span
                    className={`font-caption text-caption px-2 py-0.5 rounded-full flex items-center gap-1 ${insights.trendPct < 0
                      ? "bg-status-critical/10 text-status-critical"
                      : "bg-status-confirmed/10 text-status-confirmed"
                      }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {insights.trendPct < 0 ? "trending_down" : "trending_up"}
                    </span>
                    {insights.trendPct > 0 ? "+" : ""}
                    {insights.trendPct}%
                  </span>
                )}
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volume} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E3DE" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "#E5E3DE" }}
                    padding={{ left: 24, right: 24 }}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip content={<CustomTooltip suffix="units" />} />
                  <Area
                    type="monotone"
                    dataKey="totalQuantity"
                    stroke="#1B2A4A"
                    strokeWidth={2.5}
                    fill="#1B2A4A"
                    fillOpacity={0.12}
                    dot={{ r: 3, fill: "#1B2A4A", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    animationDuration={900}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md h-[340px] flex flex-col">
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm shrink-0">
                Resource allocation by category
              </h2>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E3DE" vertical={false} />
                  <XAxis dataKey="resourceType" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#E5E3DE" }} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip content={<CustomTooltip suffix="units" />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                  <Bar dataKey="totalQuantity" radius={[6, 6, 0, 0]} animationDuration={900}>
                    {byCategory.map((entry) => (
                      <Cell key={entry.resourceType} fill={CATEGORY_COLORS[entry.resourceType] || "#D7263D"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category breakdown + insight callout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
            <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md">
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">Category breakdown</h2>
              <div className="flex flex-col gap-space-sm">
                {insights.ranked.map((c, i) => (
                  <div
                    key={c.resourceType}
                    style={{ animationDelay: `${i * 60}ms` }}
                    className="animate-[fadeSlideIn_0.4s_ease-out_backwards]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-6 h-6 rounded-md flex items-center justify-center text-white"
                          style={{ backgroundColor: CATEGORY_COLORS[c.resourceType] || "#D7263D" }}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {ICONS[c.resourceType] || "inventory_2"}
                          </span>
                        </span>
                        <span className="font-label-md text-label-md text-on-surface capitalize">{c.resourceType}</span>
                      </div>
                      <span className="font-caption text-caption text-on-surface-variant">
                        {c.totalQuantity} units • {c.pct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-container-highest overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: loaded ? `${c.pct}%` : "0%",
                          backgroundColor: CATEGORY_COLORS[c.resourceType] || "#D7263D",
                        }}
                      />
                    </div>
                  </div>
                ))}
                {insights.ranked.length === 0 && (
                  <p className="font-body-sm text-body-sm text-on-surface-variant">No distribution data yet.</p>
                )}
              </div>
            </div>

            <div className="bg-primary rounded-xl shadow-sm p-space-md flex flex-col justify-center">
              <span className="material-symbols-outlined text-white/70 text-[28px]">insights</span>
              <p className="font-headline-sm text-headline-sm text-white mt-space-sm leading-snug">
                {insights.top
                  ? `${insights.top.resourceType.charAt(0).toUpperCase()}${insights.top.resourceType.slice(1)} leads distribution at ${insights.topShare}% of total volume.`
                  : "Not enough data yet to surface an insight."}
              </p>
              {insights.trendPct !== null && (
                <p className="font-caption text-caption text-white/70 mt-space-sm">
                  Overall volume is {insights.trendPct >= 0 ? "up" : "down"} {Math.abs(insights.trendPct)}% across the
                  tracked period.
                </p>
              )}
            </div>
          </div>

          <LogisticsSection data={logistics} error={logisticsError} />
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