import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import StatusPill from "../components/StatusPill";
import { getAlerts } from "../api/client";

const KIND_META = {
  distribution: { icon: "content_copy", label: "Distribution overlap", color: "text-primary", bg: "bg-primary/10" },
  need: { icon: "groups", label: "Need report overlap", color: "text-secondary", bg: "bg-secondary/10" },
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "dismissed", label: "Dismissed" },
];

function timeAgo(dateStr) {
  const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function StatTile({ icon, label, value, tone }) {
  const toneClasses = {
    critical: "bg-status-critical/10 text-status-critical",
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
  };
  return (
    <div className="rounded-xl border border-surface-container-highest bg-surface-container-lowest p-space-md flex items-center gap-space-sm">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${toneClasses[tone] || toneClasses.primary
          }`}
      >
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="font-headline-sm text-headline-sm text-on-surface leading-none">{value}</p>
        <p className="font-caption text-caption text-on-surface-variant truncate">{label}</p>
      </div>
    </div>
  );
}

export default function DuplicationAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getAlerts()
      .then(setAlerts)
      .catch(() => setError("Could not load alerts."));
  }, []);

  const stats = useMemo(() => {
    const pending = alerts.filter((a) => a.status === "pending").length;
    const confirmed = alerts.filter((a) => a.status === "confirmed").length;
    const needCount = alerts.filter((a) => a.kind === "need").length;
    const distCount = alerts.filter((a) => a.kind === "distribution").length;
    return { pending, confirmed, needCount, distCount };
  }, [alerts]);

  const visible = filter === "all" ? alerts : alerts.filter((a) => a.status === filter);

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header variant="coordination" />
      <main className="w-full pt-16 flex-1">
        {/* Hero band */}
        <div className="bg-primary">
          <div className="max-w-[1100px] mx-auto px-margin-mobile lg:px-margin py-space-lg flex items-center gap-space-md">
            <div className="w-14 h-14 rounded-xl bg-on-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-primary text-[28px]">warning</span>
            </div>
            <div>
              <h1 className="font-headline-lg text-headline-lg text-on-primary tracking-tight">
                Duplication Alerts
              </h1>
              <p className="font-body-md text-body-md text-on-primary/80 mt-0.5 max-w-[520px]">
                Flags when the same need or delivery looks like it's been reported more than once in a ward, so
                relief doesn't get double-logged or double-promised.
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-[1100px] mx-auto px-margin-mobile lg:px-margin py-space-lg">
          {/* Stat row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm mb-space-lg">
            <StatTile icon="pending_actions" label="Pending review" value={stats.pending} tone="critical" />
            <StatTile icon="task_alt" label="Confirmed" value={stats.confirmed} tone="primary" />
            <StatTile icon="groups" label="Need overlaps" value={stats.needCount} tone="secondary" />
            <StatTile icon="content_copy" label="Distribution overlaps" value={stats.distCount} tone="primary" />
          </div>

          {error && <p className="font-caption text-caption text-status-critical mb-space-md">{error}</p>}

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 mb-space-md flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3.5 py-1.5 rounded-full font-label-md text-label-md transition-colors ${filter === f.value
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-highest"
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-[1fr_320px] gap-space-lg items-start">
            <div className="flex flex-col gap-space-sm">
              {visible.map((a, i) => {
                const meta = KIND_META[a.kind] || KIND_META.distribution;
                const count = a.kind === "need" ? a.reportCount : a.organizationCount;
                const countLabel =
                  a.kind === "need"
                    ? `${count} report${count === 1 ? "" : "s"} for the same need here`
                    : `${count} organizations reported delivering here`;

                return (
                  <Link
                    key={a._id}
                    to={`/coordination/alerts/${a._id}`}
                    style={{ animationDelay: `${i * 60}ms` }}
                    className="alert-row flex items-center gap-space-sm p-space-md rounded-xl bg-surface-container-lowest border border-surface-container-highest shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg ${meta.bg} flex items-center justify-center ${meta.color} shrink-0`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{meta.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-label-md text-label-md text-on-surface">
                          {a.ward?.name} — {a.resourceType}
                        </p>
                        <span className="font-caption text-caption text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-full">
                          {meta.label}
                        </span>
                      </div>
                      <p className="font-caption text-caption text-on-surface-variant">
                        {countLabel}
                        {a.createdAt ? ` • ${timeAgo(a.createdAt)}` : ""}
                      </p>
                    </div>
                    <StatusPill status={a.status === "confirmed" ? "confirmed_alert" : a.status} />
                    <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                      chevron_right
                    </span>
                  </Link>
                );
              })}

              {visible.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center text-center py-space-xl px-space-md rounded-xl border border-dashed border-surface-container-highest">
                  <span className="material-symbols-outlined text-[40px] text-on-surface-variant mb-space-sm">
                    verified
                  </span>
                  <p className="font-label-md text-label-md text-on-surface mb-1">
                    {filter === "all" ? "No duplication alerts right now" : `No ${filter} alerts`}
                  </p>
                  <p className="font-caption text-caption text-on-surface-variant max-w-[280px]">
                    New need reports and distribution logs are checked automatically as they come in.
                  </p>
                </div>
              )}
            </div>

            {/* How it works side panel */}
            <aside className="flex flex-col gap-space-sm">
              <div className="rounded-xl border border-surface-container-highest bg-surface-container-lowest p-space-md">
                <p className="font-label-md text-label-md text-on-surface mb-space-sm">How detection works</p>
                <div className="flex items-start gap-2 mb-space-sm">
                  <span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">groups</span>
                  <p className="font-caption text-caption text-on-surface-variant">
                    <span className="text-on-surface font-label-sm">Need overlap</span> — 2+ open reports for the
                    same resource in the same ward within 48 hours, e.g. neighbors or family members reporting the
                    same need.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px] mt-0.5">content_copy</span>
                  <p className="font-caption text-caption text-on-surface-variant">
                    <span className="text-on-surface font-label-sm">Distribution overlap</span> — 2+ organizations
                    logging the same resource delivered in the same ward within the same window.
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-surface-container-highest bg-surface-container-lowest p-space-md">
                <p className="font-label-md text-label-md text-on-surface mb-1">Reviewing an alert</p>
                <p className="font-caption text-caption text-on-surface-variant">
                  Open an alert to see everyone involved, then confirm it as a real duplicate or dismiss it if it
                  turns out to be two genuinely separate needs or deliveries.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes alertFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .alert-row {
          animation: alertFadeIn 0.35s ease both;
        }
      `}</style>
    </div>
  );
}