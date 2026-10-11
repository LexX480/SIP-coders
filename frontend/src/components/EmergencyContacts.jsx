import { useEffect, useRef, useState } from "react";
import { getPublicDistributions } from "../api/client";

// National Nepal emergency numbers - cross-checked against Nepal Police,
// the National Emergency Operation Centre, and multiple public emergency-
// number registers (Wikipedia-sourced). These are nationwide toll-free
// short codes as of 2026. Local ward/municipal numbers vary by district and
// aren't hardcoded here for that reason - see the note in the panel.
const NATIONAL_NUMBERS = [
  { label: "Nepal Police", number: "100", icon: "local_police", note: "Crime, accidents, general emergencies" },
  { label: "Ambulance", number: "102", icon: "emergency", note: "Emergency medical dispatch" },
  { label: "Fire Brigade", number: "101", icon: "local_fire_department", note: "Fires and rescue" },
  { label: "Traffic Police", number: "103", icon: "traffic", note: "Road incidents, traffic emergencies" },
  {
    label: "National Emergency Operation Centre",
    number: "1149",
    icon: "warning",
    note: "Natural disaster reporting & coordination",
  },
  { label: "Nepal Red Cross Society", number: "1130", icon: "medical_services", note: "Disaster & ambulance services" },
  { label: "Tourist Police", number: "1144", icon: "support_agent", note: "For visitors: theft, scams, lost documents" },
];

export default function EmergencyContacts() {
  const [open, setOpen] = useState(false);
  const [activeOrgs, setActiveOrgs] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Pull real, currently-active responder organizations from logged
  // distributions - a live proxy for "who's actually on the ground right
  // now" rather than a static/fabricated volunteer list.
  useEffect(() => {
    if (!open || activeOrgs.length > 0) return;
    getPublicDistributions()
      .then((data) => {
        const counts = {};
        data.forEach((d) => {
          const name = d.organizationName || "Unnamed Organization";
          counts[name] = (counts[name] || 0) + 1;
        });
        const orgs = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }));
        setActiveOrgs(orgs);
      })
      .catch(() => { });
  }, [open, activeOrgs.length]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-9 px-3 rounded-full bg-status-critical/10 text-status-critical flex items-center gap-1.5 hover:bg-status-critical/15 transition-colors"
        title="Emergency contacts"
      >
        <span className="material-symbols-outlined text-[18px]">emergency</span>
        <span className="font-label-sm text-label-sm hidden sm:inline">Emergency</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto bg-surface-container-lowest border border-surface-container-highest rounded-xl shadow-lg z-50">
          <div className="p-space-sm border-b border-surface-container-highest">
            <p className="font-label-md text-label-md text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-status-critical">emergency</span>
              Emergency Contacts — Nepal
            </p>
            <p className="font-caption text-caption text-on-surface-variant mt-0.5">
              National toll-free numbers, reachable nationwide, 24/7.
            </p>
          </div>

          <div className="p-space-xs">
            {NATIONAL_NUMBERS.map((c) => (
              <a
                key={c.number}
                href={`tel:${c.number}`}
                className="flex items-center gap-space-sm p-space-sm rounded-lg hover:bg-surface-container-low transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-status-critical/10 flex items-center justify-center text-status-critical shrink-0">
                  <span className="material-symbols-outlined text-[16px]">{c.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-label-sm text-label-sm text-on-surface">{c.label}</p>
                  <p className="font-caption text-caption text-on-surface-variant truncate">{c.note}</p>
                </div>
                <span className="font-label-md text-label-md text-on-surface shrink-0">{c.number}</span>
              </a>
            ))}
          </div>

          {activeOrgs.length > 0 && (
            <div className="p-space-sm border-t border-surface-container-highest">
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-space-xs">
                Active Responder Organizations
              </p>
              {activeOrgs.map((org) => (
                <div key={org.name} className="flex items-center justify-between py-1">
                  <span className="font-body-sm text-body-sm text-on-surface truncate">{org.name}</span>
                  <span className="font-caption text-caption text-on-surface-variant shrink-0">
                    {org.count} logged
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="p-space-sm border-t border-surface-container-highest">
            <p className="font-caption text-caption text-on-surface-variant">
              Sourced from Nepal Police and National Emergency Operation Centre public registers. Local ward numbers
              vary — confirm with your ward office where possible.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}