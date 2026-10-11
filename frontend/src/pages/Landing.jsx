import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import StatusPill from "../components/StatusPill";
import { RESOURCES } from "../components/ResourceGrid";
import { getPublicDistributions, getNeeds } from "../api/client";

// Interactive, color-coded replacements for the old flat FEATURES list.
// Each card gets its own accent, a short action-driven line instead of a
// bare label, a one-line explainer, and a hover state that lifts the card
// and reveals a "go there" arrow. The two cards tied to something a visitor
// can actually do are real links; duplication detection is a backend/
// coordinator-side feature with no dedicated public page, so it stays
// informational instead of linking somewhere misleading.
const FEATURES = [
  {
    icon: "edit_location_alt",
    eyebrow: "For Responders",
    title: "Log It As It Happens",
    description: "Drop a pin, pick what you delivered, and it's on the record in under a minute.",
    accent: "secondary",
    href: "/responder/auth",
    cta: "Join as a Responder",
  },
  {
    icon: "search_insights",
    eyebrow: "Working Quietly",
    title: "Catch Overlaps Early",
    description: "When two teams reach the same ward with the same aid, the system flags it automatically.",
    accent: "primary",
  },
  {
    icon: "visibility",
    eyebrow: "For Everyone",
    title: "See What's Still Needed",
    description: "Every open need, ward by ward, visible the moment someone reports it.",
    accent: "status-confirmed",
    href: "/transparency",
    cta: "View Transparency Map",
  },
];

const ACCENT_CLASSES = {
  secondary: {
    iconBg: "bg-secondary/10 group-hover:bg-secondary",
    icon: "text-secondary group-hover:text-on-secondary",
    eyebrow: "text-secondary",
    ring: "group-hover:ring-secondary/40",
  },
  primary: {
    iconBg: "bg-primary/10 group-hover:bg-primary",
    icon: "text-primary group-hover:text-white",
    eyebrow: "text-primary",
    ring: "group-hover:ring-primary/40",
  },
  "status-confirmed": {
    iconBg: "bg-status-confirmed/10 group-hover:bg-status-confirmed",
    icon: "text-status-confirmed group-hover:text-white",
    eyebrow: "text-status-confirmed",
    ring: "group-hover:ring-status-confirmed/40",
  },
};

function FeatureCard({ icon, eyebrow, title, description, accent, href, cta }) {
  const a = ACCENT_CLASSES[accent];
  const Wrapper = href ? Link : "div";
  const wrapperProps = href ? { to: href } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`group relative flex flex-col p-space-lg rounded-xl bg-surface-container-lowest shadow-sm ring-1 ring-transparent transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${a.ring} ${href ? "cursor-pointer" : ""
        }`}
    >
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center mb-space-sm transition-colors duration-300 ${a.iconBg}`}
      >
        <span className={`material-symbols-outlined text-[24px] transition-colors duration-300 ${a.icon}`}>
          {icon}
        </span>
      </div>

      <span className={`font-label-sm text-label-sm uppercase tracking-wider mb-1 ${a.eyebrow}`}>{eyebrow}</span>
      <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1.5">{title}</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant flex-1">{description}</p>

      {href && (
        <span
          className={`flex items-center gap-1 mt-space-sm font-label-sm text-label-sm ${a.eyebrow} opacity-0 translate-x-[-4px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300`}
        >
          {cta}
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </span>
      )}
    </Wrapper>
  );
}

const ICONS = Object.fromEntries(RESOURCES.map((r) => [r.value, r.icon]));

function timeAgo(dateStr) {
  const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function Landing() {
  const [feed, setFeed] = useState([]);
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    // Merge real distributions + real need reports into one reverse-
    // chronological feed - nothing here is fabricated, it's a live read of
    // whatever has actually been logged/reported in the system.
    Promise.all([getPublicDistributions(), getNeeds({ status: "open" })])
      .then(([distributions, needs]) => {
        const distItems = distributions.map((d) => ({
          id: `dist-${d._id}`,
          kind: "distribution",
          resourceType: d.resourceType,
          wardName: d.ward?.name,
          wardDistrict: d.ward?.district,
          orgName: d.organizationName,
          quantity: d.quantity,
          status: d.status,
          at: d.loggedAt,
        }));
        const needItems = needs.map((n) => ({
          id: `need-${n._id}`,
          kind: "need",
          resourceType: n.resourceType,
          wardName: n.ward?.name,
          wardDistrict: n.ward?.district,
          urgency: n.urgency,
          at: n.createdAt,
        }));
        const merged = [...distItems, ...needItems].sort((a, b) => new Date(b.at) - new Date(a.at));
        setFeed(merged.slice(0, 12));
      })
      .catch(() => setError("Could not load live relief activity."));
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Full-page background photo - fixed so it stays put while the page scrolls, sits behind everything */}
      <div
        className="fixed inset-0 bg-cover bg-center scale-110"
        style={{ backgroundImage: "url('/hero-bg.jpg')" }}
        aria-hidden="true"
      />
      {/* Readability overlay - tweak the /NN opacity value: lower = more photo visible, higher = more faded */}
      <div className="fixed inset-0 bg-background/80" aria-hidden="true" />

      {/* Everything else sits above the background layers */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Header variant="responder" />
        <main className="w-full pt-16 flex-1">
          <div className="max-w-[1120px] mx-auto px-gutter py-space-lg">
            <div className="flex flex-col items-center justify-center pt-space-xl pb-space-lg text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container mb-space-md">
                <span className="w-2 h-2 rounded-full bg-secondary" />
                <span className="font-caption text-caption text-on-surface-variant tracking-wide uppercase">
                  Decentralized Crisis Logistics
                </span>
              </div>
              <h1 className="font-display text-display text-primary max-w-3xl tracking-tight mb-space-sm">
                Relief That Finds Its Way
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl mx-auto mb-space-lg">
                Real-time coordination for responders and relief teams across every ward.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-space-md">
                <Link
                  to="/responder/auth"
                  className="h-11 px-6 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-opacity"
                >
                  <span>Join as a Responder</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
                <Link
                  to="/needs/report"
                  className="h-11 px-6 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md flex items-center justify-center gap-2 shadow-sm hover:bg-surface-container transition-colors"
                >
                  <span>Report a Need</span>
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">emergency</span>
                </Link>
              </div>
            </div>

            <div className="mt-space-xl pt-space-xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                {FEATURES.map((f) => (
                  <FeatureCard key={f.title} {...f} />
                ))}
              </div>
            </div>

            {/* Live Relief Feed - horizontally scrollable, real data */}
            <div className="mt-space-xl pt-space-xl">
              <div className="flex items-end justify-between mb-space-md">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                    <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                      Live Relief Network
                    </span>
                  </div>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Recent Activity</h2>
                </div>
                <Link
                  to="/transparency"
                  className="font-label-md text-label-md text-secondary flex items-center gap-1 shrink-0 hover:opacity-80 transition-opacity"
                >
                  Open full transparency map
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
              </div>

              {error && <p className="font-caption text-caption text-status-critical mb-space-md">{error}</p>}

              {feed.length > 0 ? (
                <div
                  className="relative overflow-hidden"
                  onMouseEnter={() => setPaused(true)}
                  onMouseLeave={() => setPaused(false)}
                  style={{
                    // Fade the edges so cards don't look like they're cut off mid-slide
                    maskImage: "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)",
                    WebkitMaskImage:
                      "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)",
                  }}
                >
                  <div
                    className="flex gap-space-md w-max pb-space-sm"
                    style={{
                      animation: `scroll-left ${feed.length * 5}s linear infinite`,
                      animationPlayState: paused ? "paused" : "running",
                    }}
                  >
                    {/* Feed rendered twice back-to-back so the -50% loop is seamless */}
                    {[...feed, ...feed].map((item, i) => (
                      <div
                        key={`${item.id}-${i}`}
                        className="shrink-0 w-[280px] p-space-md rounded-xl bg-surface-container-lowest border border-surface-container-highest shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-space-sm">
                          <span className="font-caption text-caption text-on-surface-variant">
                            {item.wardName}
                            {item.wardDistrict ? `, ${item.wardDistrict}` : ""}
                          </span>
                          <StatusPill status={item.kind === "distribution" ? item.status : item.urgency} />
                        </div>
                        <div className="flex items-center gap-space-sm mb-space-sm">
                          <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
                            <span className="material-symbols-outlined text-[18px]">{ICONS[item.resourceType] || "inventory_2"}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-label-md text-label-md text-on-surface truncate">
                              {item.kind === "distribution"
                                ? `${item.quantity} ${item.resourceType} delivered`
                                : `${item.resourceType} needed`}
                            </p>
                            <p className="font-caption text-caption text-on-surface-variant truncate">
                              {item.kind === "distribution" ? item.orgName : "Community reported"}
                            </p>
                          </div>
                        </div>
                        <p className="font-caption text-caption text-on-surface-variant">{timeAgo(item.at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                !error && (
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    No relief activity logged yet — be the first to log a distribution or report a need.
                  </p>
                )
              )}
            </div>

            {/* Dark CTA card */}
            <div className="mt-space-xl relative overflow-hidden rounded-2xl blur-0  bg-on-surface p-space-lg md:p-space-xl">
              <div className="relative z-10 max-w-lg">
                <p className="font-label-sm text-label-sm text-secondary-fixed-dim uppercase tracking-wider mb-space-sm">
                  Community Response
                </p>
                <h2 className="font-headline-lg text-headline-lg text-surface-container-lowest tracking-tight mb-space-sm">
                  Need help in your ward today?
                </h2>
                <p className="font-body-md text-body-md text-surface-container-highest/80 mb-space-lg">
                  Do not wait for aid to find you. Take 30 seconds to report what's needed, and it goes straight to
                  every responder organization and ward coordinator on the network.
                </p>
                <div className="flex flex-wrap gap-space-sm">
                  <Link
                    to="/needs/report"
                    className="h-11 px-6 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-opacity"
                  >
                    Report a Need
                  </Link>
                  <Link
                    to="/transparency"
                    className="h-11 px-6 rounded-lg bg-surface-container-lowest/10 border border-surface-container-lowest/30 text-surface-container-lowest font-label-md text-label-md flex items-center justify-center gap-2 hover:bg-surface-container-lowest/15 transition-colors"
                  >
                    View Public Transparency
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}