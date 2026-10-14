import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Header from "../components/Header";
import { RESOURCES } from "../components/ResourceGrid";
import { getByCategory, getVolumeOverTime } from "../api/client";

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

export default function Analytics() {
  const [volume, setVolume] = useState([]);
  const [byCategory, setByCategory] = useState([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      getVolumeOverTime().then(setVolume),
      getByCategory().then(setByCategory),
    ])
      .catch(() => setError("Could not load analytics."))
      .finally(() => setLoaded(true));
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