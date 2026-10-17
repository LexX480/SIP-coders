import { useCallback, useEffect, useState } from "react";
import { RESOURCES, SUBCATEGORIES } from "./ResourceGrid";
import StatusPill from "./StatusPill";
import { OpenBadge } from "./WarehouseStatus";
import { getMyDispatches, markDispatchDelivered, markDispatchPickedUp } from "../api/client";

const ICONS = Object.fromEntries(RESOURCES.map((r) => [r.value, r.icon]));
const LABELS = Object.fromEntries(RESOURCES.map((r) => [r.value, r.label]));

// How often the dashboard checks for new pickups while it's open.
const POLL_MS = 30000;

function wardLabel(ward) {
  if (!ward) return "";
  const district = ward.district === "Kathmandu" ? "KTM" : ward.district;
  return [ward.name, district, ward.locality].filter(Boolean).join(", ");
}

function itemLabel(resourceType, subCategory) {
  if (!subCategory) return "";
  const full = (SUBCATEGORIES[resourceType] || []).find((s) => s.value === subCategory)?.label || subCategory;
  return full.replace(/\s*\(.*\)\s*$/, "");
}

function timeAgo(dateStr) {
  const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function mapsUrl(coordinates) {
  if (!coordinates || coordinates.length !== 2) return null;
  const [lng, lat] = coordinates;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function Step({ number, label, state }) {
  const styles = {
    done: "bg-status-confirmed/10 text-status-confirmed",
    current: "bg-secondary text-on-secondary",
    todo: "bg-surface-container text-on-surface-variant",
  };
  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-label-sm text-label-sm ${styles[state]}`}>
      {state === "done" ? <span className="material-symbols-outlined text-[14px]">check</span> : number}
      {label}
    </span>
  );
}

function ActionLink({ href, icon, children }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      className="h-10 px-3 rounded-lg border border-surface-container-highest text-on-surface font-label-md text-label-md flex items-center justify-center gap-1.5 hover:bg-surface-container-low transition-colors"
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      {children}
    </a>
  );
}

// Banner for the top of the responder dashboard: relief stock a coordinator
// has sent this organization's way that still has to be collected from a
// warehouse and delivered to a community. Refreshes by itself, so a new
// pickup shows up without reloading the page. Renders nothing when there's
// nothing to collect or deliver.
export default function PickupAlerts() {
  const [dispatches, setDispatches] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [errors, setErrors] = useState({});

  const load = useCallback(() => {
    return getMyDispatches()
      .then(setDispatches)
      .catch(() => { });
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    function onVisible() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  async function advance(dispatch, action) {
    setBusyId(dispatch._id);
    setErrors((e) => ({ ...e, [dispatch._id]: "" }));
    try {
      await action(dispatch._id);
      await load();
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [dispatch._id]: err.response?.data?.message || "Could not update this pickup. Try again.",
      }));
      load();
    } finally {
      setBusyId(null);
    }
  }

  if (dispatches.length === 0) return null;

  const waiting = dispatches.filter((d) => d.status === "pending_pickup").length;

  return (
    <section className="mb-space-lg" aria-label="Pickups and deliveries">
      <div className="flex items-center gap-space-sm mb-space-sm">
        <span className="relative flex w-2.5 h-2.5">
          {waiting > 0 && (
            <span className="absolute inline-flex w-full h-full rounded-full bg-status-critical opacity-60 animate-ping" />
          )}
          <span
            className={`relative inline-flex w-2.5 h-2.5 rounded-full ${waiting > 0 ? "bg-status-critical" : "bg-secondary"
              }`}
          />
        </span>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">
          {waiting > 0
            ? `${waiting} pickup${waiting === 1 ? "" : "s"} waiting - send volunteers now`
            : "Deliveries in progress"}
        </h2>
      </div>

      <div className="flex flex-col gap-space-sm">
        {dispatches.map((d) => {
          const pickedUp = d.status === "picked_up";
          const urgent = d.need?.urgency === "urgent";
          const sub = itemLabel(d.resourceType, d.subCategory);
          const warehouseCoords = d.warehouse?.location?.coordinates;
          const needCoords = d.need?.location?.coordinates;

          return (
            <div
              key={d._id}
              className={`rounded-xl border border-l-4 shadow-sm p-space-md ${urgent
                  ? "border-surface-container-highest border-l-status-critical bg-status-critical/5"
                  : "border-surface-container-highest border-l-status-pending bg-surface-container-lowest"
                }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-space-sm">
                <div className="flex items-start gap-space-sm min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-lowest text-primary flex items-center justify-center shrink-0 border border-surface-container-highest">
                    <span className="material-symbols-outlined text-[20px]">
                      {ICONS[d.resourceType] || "inventory_2"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-headline-sm text-headline-sm text-on-surface">
                      {pickedUp ? "Deliver" : "Pick up"} {d.quantity} units of {LABELS[d.resourceType] || d.resourceType}
                      {sub ? ` (${sub})` : ""}
                    </p>
                    <p className="font-caption text-caption text-on-surface-variant">
                      Dispatched {timeAgo(d.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-space-xs shrink-0">
                  <StatusPill status={d.need?.urgency} />
                  <Step number={1} label="Pick up" state={pickedUp ? "done" : "current"} />
                  <Step number={2} label="Deliver" state={pickedUp ? "current" : "todo"} />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-space-sm mt-space-sm">
                <div className={`rounded-lg p-space-sm bg-surface-container-lowest border ${pickedUp ? "border-surface-container-highest opacity-70" : "border-secondary/40"
                  }`}>
                  <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-0.5">
                    Collect from
                  </p>
                  <p className="font-label-md text-label-md text-on-surface">{d.warehouse?.name}</p>
                  <p className="font-caption text-caption text-on-surface-variant">{d.warehouse?.address}</p>
                  {d.warehouse?.openingHours?.length > 0 && (
                    <div className="mt-1">
                      <OpenBadge openingHours={d.warehouse.openingHours} showDetail />
                    </div>
                  )}
                </div>
                <div className={`rounded-lg p-space-sm bg-surface-container-lowest border ${pickedUp ? "border-secondary/40" : "border-surface-container-highest"
                  }`}>
                  <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-0.5">
                    Deliver to
                  </p>
                  <p className="font-label-md text-label-md text-on-surface">{wardLabel(d.ward)}</p>
                  {d.need?.reporterName && (
                    <p className="font-caption text-caption text-on-surface-variant">
                      Contact: {d.need.reporterName}
                      {d.need.reporterPhone ? ` • ${d.need.reporterPhone}` : ""}
                    </p>
                  )}
                </div>
              </div>

              {d.note && (
                <p className="font-caption text-caption text-on-surface-variant mt-space-sm flex items-start gap-1.5">
                  <span className="material-symbols-outlined text-[16px] shrink-0">sticky_note_2</span>
                  <span>Note from coordinator: {d.note}</span>
                </p>
              )}

              {errors[d._id] && (
                <p className="font-caption text-caption text-status-critical mt-space-sm">{errors[d._id]}</p>
              )}

              <div className="flex flex-wrap gap-space-sm mt-space-md">
                {!pickedUp ? (
                  <>
                    <ActionLink href={mapsUrl(warehouseCoords)} icon="directions">
                      Directions to warehouse
                    </ActionLink>
                    <ActionLink
                      href={d.warehouse?.contactPhone ? `tel:${d.warehouse.contactPhone}` : null}
                      icon="call"
                    >
                      Call warehouse
                    </ActionLink>
                    <button
                      type="button"
                      disabled={busyId === d._id}
                      onClick={() => advance(d, markDispatchPickedUp)}
                      className="h-10 px-4 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md shadow-sm hover:opacity-95 transition-opacity disabled:opacity-60 sm:ml-auto"
                    >
                      {busyId === d._id ? "Saving..." : "We've picked it up"}
                    </button>
                  </>
                ) : (
                  <>
                    <ActionLink href={mapsUrl(needCoords)} icon="directions">
                      Directions to delivery point
                    </ActionLink>
                    <ActionLink href={d.need?.reporterPhone ? `tel:${d.need.reporterPhone}` : null} icon="call">
                      Call {d.need?.reporterName || "contact"}
                    </ActionLink>
                    <button
                      type="button"
                      disabled={busyId === d._id}
                      onClick={() => advance(d, markDispatchDelivered)}
                      className="h-10 px-4 rounded-lg bg-status-confirmed text-white font-label-md text-label-md shadow-sm hover:opacity-95 transition-opacity disabled:opacity-60 sm:ml-auto"
                    >
                      {busyId === d._id ? "Saving..." : "Mark delivered"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}