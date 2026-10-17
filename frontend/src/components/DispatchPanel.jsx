import { useCallback, useEffect, useState } from "react";
import { RESOURCES, SUBCATEGORIES } from "./ResourceGrid";
import StatusPill from "./StatusPill";
import {
  cancelDispatch,
  createDispatch,
  getDispatchCandidates,
  getDispatches,
  getResponders,
} from "../api/client";

const ICONS = Object.fromEntries(RESOURCES.map((r) => [r.value, r.icon]));
const LABELS = Object.fromEntries(RESOURCES.map((r) => [r.value, r.label]));

const DISPATCH_STATUS = {
  pending_pickup: { label: "Waiting for pickup", style: "bg-status-pending/10 text-status-pending" },
  picked_up: { label: "On the way", style: "bg-secondary/10 text-secondary" },
  delivered: { label: "Delivered", style: "bg-status-confirmed/10 text-status-confirmed" },
};

const INPUT =
  "w-full h-10 px-3 bg-surface-container-lowest text-on-surface font-body-sm text-body-sm rounded-lg border border-surface-container-highest focus:outline-none focus:border-secondary transition-colors";

function wardLabel(ward) {
  if (!ward) return "";
  const district = ward.district === "Kathmandu" ? "KTM" : ward.district;
  return [ward.name, district, ward.locality].filter(Boolean).join(", ");
}

// "Protein (Lentils, Beans, Dried Fish)" -> "Protein"
function itemLabel(resourceType, subCategory) {
  if (!subCategory) return "General";
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

function apiError(err, fallback) {
  const data = err.response?.data;
  return data?.message || data?.errors?.[0]?.msg || fallback;
}

// Lives on the warehouse page. Lists open need reports this warehouse has
// stock for, lets a coordinator dispatch some of that stock to one of them,
// and tracks what's already been sent. `refreshKey` should change whenever
// the warehouse's stock changes elsewhere on the page; `onChanged` is called
// after a dispatch is created or cancelled so the page can reload its stock.
export default function DispatchPanel({ warehouseId, refreshKey, onChanged }) {
  const [needs, setNeeds] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [responders, setResponders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [openNeedId, setOpenNeedId] = useState(null);
  const [form, setForm] = useState({ subCategory: "", quantity: "", assignedTo: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    return Promise.all([
      getDispatchCandidates(warehouseId).then((d) => setNeeds(d.needs || [])),
      getDispatches({ warehouse: warehouseId }).then(setDispatches),
    ])
      .then(() => setError(""))
      .catch(() => setError("Could not load dispatch options."))
      .finally(() => setLoading(false));
  }, [warehouseId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    getResponders()
      .then(setResponders)
      .catch(() => { });
  }, []);

  function openForm(need) {
    if (openNeedId === need._id) {
      setOpenNeedId(null);
      return;
    }
    // Start from the stock line that matches what was asked for, otherwise
    // the one with the most units.
    const line = need.stockLines.find((l) => l.subCategory === need.subCategory) || need.stockLines[0];
    setForm({
      subCategory: line.subCategory,
      quantity: String(Math.min(need.remaining, line.quantity)),
      assignedTo: need.suggestedResponder?._id || "",
      note: "",
    });
    setFormError("");
    setSuccess("");
    setOpenNeedId(need._id);
  }

  function changeLine(need, subCategory) {
    const line = need.stockLines.find((l) => l.subCategory === subCategory);
    setForm((f) => ({ ...f, subCategory, quantity: String(Math.min(need.remaining, line.quantity)) }));
  }

  async function handleSubmit(e, need) {
    e.preventDefault();
    setFormError("");

    const line = need.stockLines.find((l) => l.subCategory === form.subCategory);
    const quantity = Number(form.quantity);

    if (!form.assignedTo) return setFormError("Choose which organization should pick this up.");
    if (!(quantity >= 1)) return setFormError("Enter at least 1 unit.");
    if (!line || quantity > line.quantity) {
      return setFormError(`Only ${line ? line.quantity : 0} units of that item are in stock.`);
    }
    if (quantity > need.remaining) return setFormError(`Only ${need.remaining} more units are needed.`);

    setSubmitting(true);
    try {
      const created = await createDispatch({
        warehouse: warehouseId,
        need: need._id,
        assignedTo: form.assignedTo,
        quantity,
        subCategory: form.subCategory || undefined,
        note: form.note || undefined,
      });
      const org = created.assignedTo?.organizationName || "The organization";
      setSuccess(`${quantity} units dispatched. ${org} now has a pickup alert on their dashboard.`);
      setOpenNeedId(null);
      await load();
      if (onChanged) onChanged();
    } catch (err) {
      setFormError(apiError(err, "Could not create this dispatch."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(dispatch) {
    setBusyId(dispatch._id);
    setError("");
    try {
      await cancelDispatch(dispatch._id);
      setSuccess("Dispatch cancelled - the units are back in stock.");
      await load();
      if (onChanged) onChanged();
    } catch (err) {
      setError(apiError(err, "Could not cancel this dispatch."));
    } finally {
      setBusyId(null);
    }
  }

  const recent = dispatches.filter((d) => d.status !== "cancelled").slice(0, 8);

  return (
    <section className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md">
      <div className="flex items-center gap-space-sm mb-1.5">
        <div className="w-9 h-9 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[18px]">local_shipping</span>
        </div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Send stock to a need</h2>
      </div>
      <p className="font-caption text-caption text-on-surface-variant">
        Open requests this warehouse can cover, most urgent first. Dispatching takes the units out of stock and sends a
        pickup alert to the organization you choose.
      </p>

      {success && (
        <div className="mt-space-sm flex items-start gap-1.5 p-space-sm rounded-lg bg-status-confirmed/10 text-status-confirmed font-caption text-caption">
          <span className="material-symbols-outlined text-[16px] shrink-0">check_circle</span>
          <span>{success}</span>
        </div>
      )}
      {error && <p className="font-caption text-caption text-status-critical mt-space-sm">{error}</p>}

      <div className="flex flex-col gap-space-sm mt-space-sm">
        {loading && <p className="font-body-sm text-body-sm text-on-surface-variant">Loading...</p>}

        {needs.map((n) => {
          const isOpen = openNeedId === n._id;
          const line = n.stockLines.find((l) => l.subCategory === form.subCategory);
          const max = line ? Math.min(n.remaining, line.quantity) : n.remaining;
          return (
            <div
              key={n._id}
              className={`rounded-lg border ${isOpen ? "border-secondary" : "border-surface-container-highest"}`}
            >
              <div className="p-space-sm flex items-start gap-space-sm">
                <div className="w-9 h-9 rounded-lg bg-surface-container text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">{ICONS[n.resourceType] || "inventory_2"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-space-xs">
                    <p className="font-label-md text-label-md text-on-surface truncate">
                      {LABELS[n.resourceType] || n.resourceType}
                      {n.subCategory ? ` - ${itemLabel(n.resourceType, n.subCategory)}` : ""}
                    </p>
                    <StatusPill status={n.urgency} />
                  </div>
                  <p className="font-caption text-caption text-on-surface-variant">{wardLabel(n.ward)}</p>
                  <p className="font-caption text-caption text-on-surface-variant">
                    Needs {n.remaining} more
                    {n.dispatched > 0 ? ` (${n.dispatched} already sent)` : ""}
                    {n.distanceKm != null ? ` • ${n.distanceKm} km away` : ""}
                  </p>
                </div>
              </div>

              <div className="px-space-sm pb-space-sm">
                <button
                  type="button"
                  onClick={() => openForm(n)}
                  className={`w-full h-9 rounded-lg font-label-md text-label-md transition-colors ${isOpen
                      ? "bg-surface-container text-on-surface"
                      : "bg-secondary text-on-secondary shadow-sm hover:opacity-95"
                    }`}
                >
                  {isOpen ? "Close" : "Dispatch"}
                </button>
              </div>

              {isOpen && (
                <form
                  onSubmit={(e) => handleSubmit(e, n)}
                  className="px-space-sm pb-space-sm pt-space-sm border-t border-surface-container-highest flex flex-col gap-space-sm"
                >
                  <div className="flex flex-col space-y-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface">Send from</label>
                    {n.stockLines.length > 1 ? (
                      <select
                        value={form.subCategory}
                        onChange={(e) => changeLine(n, e.target.value)}
                        className={`${INPUT} cursor-pointer`}
                      >
                        {n.stockLines.map((l) => (
                          <option key={l.subCategory} value={l.subCategory}>
                            {itemLabel(n.resourceType, l.subCategory)} ({l.quantity} in stock)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        {itemLabel(n.resourceType, n.stockLines[0].subCategory)} ({n.stockLines[0].quantity} in stock)
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col space-y-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface">Units to send</label>
                    <input
                      type="number"
                      min="1"
                      max={max}
                      step="any"
                      value={form.quantity}
                      onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                      className={INPUT}
                    />
                    <p className="font-caption text-caption text-on-surface-variant">Up to {max} units.</p>
                  </div>

                  <div className="flex flex-col space-y-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface">Organization to notify</label>
                    <select
                      value={form.assignedTo}
                      onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
                      className={`${INPUT} cursor-pointer`}
                    >
                      <option value="">Choose organization</option>
                      {responders.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.organizationName}
                        </option>
                      ))}
                    </select>
                    {n.suggestedResponder && (
                      <p className="font-caption text-caption text-on-surface-variant">
                        Pre-selected: this request is already with {n.suggestedResponder.organizationName}.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col space-y-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface">Note for the team (optional)</label>
                    <input
                      value={form.note}
                      onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                      maxLength={200}
                      className={INPUT}
                      placeholder="e.g. ask for the storekeeper at the gate"
                    />
                  </div>

                  {formError && <p className="font-caption text-caption text-status-critical">{formError}</p>}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-10 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md shadow-sm hover:opacity-95 transition-opacity disabled:opacity-60"
                  >
                    {submitting ? "Dispatching..." : "Dispatch & notify"}
                  </button>
                </form>
              )}
            </div>
          );
        })}

        {!loading && needs.length === 0 && !error && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            No open need reports match what's in stock here right now.
          </p>
        )}
      </div>

      {recent.length > 0 && (
        <div className="mt-space-md pt-space-md border-t border-surface-container-highest">
          <h3 className="font-label-md text-label-md text-on-surface mb-space-xs">Recent dispatches</h3>
          <div className="flex flex-col divide-y divide-surface-container-highest">
            {recent.map((d) => {
              const meta = DISPATCH_STATUS[d.status] || DISPATCH_STATUS.pending_pickup;
              return (
                <div key={d._id} className="py-space-xs flex items-center gap-space-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-label-sm text-label-sm text-on-surface">
                      {d.quantity} {LABELS[d.resourceType] || d.resourceType}
                      {d.subCategory ? ` - ${itemLabel(d.resourceType, d.subCategory)}` : ""}
                    </p>
                    <p className="font-caption text-caption text-on-surface-variant truncate">
                      {wardLabel(d.ward)} • {d.assignedTo?.organizationName || "organization"} • {timeAgo(d.createdAt)}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full font-caption text-caption ${meta.style}`}>
                    {meta.label}
                  </span>
                  {d.status === "pending_pickup" && (
                    <button
                      type="button"
                      onClick={() => handleCancel(d)}
                      disabled={busyId === d._id}
                      title="Cancel and return the units to stock"
                      className="shrink-0 w-7 h-7 rounded-full bg-surface-container text-on-surface-variant hover:text-status-critical flex items-center justify-center disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}