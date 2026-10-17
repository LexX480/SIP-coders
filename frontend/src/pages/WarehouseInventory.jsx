import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Header from "../components/Header";
import { RESOURCES } from "../components/ResourceGrid";
import OpeningHoursEditor from "../components/OpeningHoursEditor";
import { CapacityBar, HoursList, OpenBadge } from "../components/WarehouseStatus";
import { findHoursError } from "../utils/warehouseHours";
import {
  adjustInventory,
  cancelDropoff,
  confirmDropoff,
  getDropoffs,
  getWarehouse,
  getWarehouseInventory,
  updateWarehouse,
} from "../api/client";

const ICONS = Object.fromEntries(RESOURCES.map((r) => [r.value, r.icon]));
const LABELS = Object.fromEntries(RESOURCES.map((r) => [r.value, r.label]));

function wardLabel(ward) {
  if (!ward) return "";
  const district = ward.district === "Kathmandu" ? "KTM" : ward.district;
  return [ward.name, district, ward.locality].filter(Boolean).join(", ");
}

function timeAgo(dateStr) {
  const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function WarehouseInventory() {
  const { id } = useParams();
  const [warehouse, setWarehouse] = useState(null);
  const [stock, setStock] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [pledges, setPledges] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjResourceType, setAdjResourceType] = useState("food");
  const [adjSubCategory, setAdjSubCategory] = useState("");
  const [adjQuantity, setAdjQuantity] = useState("");
  const [adjDirection, setAdjDirection] = useState("add");
  const [adjNote, setAdjNote] = useState("");
  const [adjSubmitting, setAdjSubmitting] = useState(false);
  const [adjError, setAdjError] = useState("");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [capInput, setCapInput] = useState("");
  const [hoursDraft, setHoursDraft] = useState([]);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  function loadAll() {
    getWarehouse(id)
      .then(setWarehouse)
      .catch(() => setError("Could not load this warehouse."));
    getWarehouseInventory(id)
      .then((data) => {
        setStock(data.stock || []);
        setTransactions(data.transactions || []);
      })
      .catch(() => setError("Could not load inventory."));
    getDropoffs({ warehouse: id, status: "pending" })
      .then(setPledges)
      .catch(() => { });
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleConfirm(pledgeId) {
    setBusyId(pledgeId);
    try {
      await confirmDropoff(pledgeId);
      loadAll();
    } catch {
      setError("Could not confirm this drop-off.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(pledgeId) {
    setBusyId(pledgeId);
    try {
      await cancelDropoff(pledgeId);
      loadAll();
    } catch {
      setError("Could not cancel this drop-off.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdjust(e) {
    e.preventDefault();
    setAdjError("");
    if (!adjQuantity || Number(adjQuantity) <= 0) return setAdjError("Enter an amount greater than 0.");

    setAdjSubmitting(true);
    try {
      await adjustInventory(id, {
        resourceType: adjResourceType,
        subCategory: adjSubCategory || undefined,
        quantity: Number(adjQuantity),
        direction: adjDirection,
        note: adjNote || undefined,
      });
      setAdjQuantity("");
      setAdjSubCategory("");
      setAdjNote("");
      setAdjustOpen(false);
      loadAll();
    } catch (err) {
      setAdjError(err.response?.data?.message || "Could not adjust inventory.");
    } finally {
      setAdjSubmitting(false);
    }
  }

  function openSettings() {
    setCapInput(warehouse?.capacity ? String(warehouse.capacity) : "");
    setHoursDraft(warehouse?.openingHours || []);
    setSettingsError("");
    setSettingsOpen(true);
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSettingsError("");

    if (capInput !== "" && !(Number(capInput) >= 1)) return setSettingsError("Capacity must be 1 or more.");
    const hoursProblem = findHoursError(hoursDraft);
    if (hoursProblem) return setSettingsError(hoursProblem);

    setSettingsSaving(true);
    try {
      const updated = await updateWarehouse(id, {
        capacity: capInput === "" ? null : Number(capInput),
        openingHours: hoursDraft,
      });
      setWarehouse(updated);
      setSettingsOpen(false);
    } catch (err) {
      const data = err.response?.data;
      setSettingsError(data?.message || data?.errors?.[0]?.msg || "Could not save these changes.");
    } finally {
      setSettingsSaving(false);
    }
  }

  const totalUnits = stock.reduce((sum, s) => sum + s.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header variant="coordination" />
      <main className="w-full pt-16 flex-1">
        <div className="bg-primary">
          <div className="max-w-[1120px] mx-auto px-margin-mobile lg:px-margin py-space-lg">
            <h1 className="font-headline-lg text-headline-lg text-on-primary tracking-tight">
              {warehouse?.name || "Warehouse"}
            </h1>
            {warehouse && (
              <p className="font-body-md text-body-md text-on-primary/80 mt-0.5">
                {warehouse.address}
                {warehouse.ward ? ` • ${wardLabel(warehouse.ward)}` : ""}
              </p>
            )}
          </div>
        </div>

        <div className="max-w-[1120px] mx-auto px-margin-mobile lg:px-margin py-space-lg">
          {error && <p className="font-caption text-caption text-status-critical mb-space-md">{error}</p>}

          <div className="grid lg:grid-cols-[1fr_360px] gap-space-lg items-start">
            <div className="flex flex-col gap-space-lg">
              {/* Current stock */}
              <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md">
                <div className="flex items-center justify-between mb-space-sm">
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">Current stock</h2>
                  <span className="font-caption text-caption text-on-surface-variant">{totalUnits} units total</span>
                </div>
                {warehouse?.capacity && <CapacityBar warehouse={warehouse} className="mb-space-sm" />}
                <div className="grid sm:grid-cols-2 gap-space-sm">
                  {stock.map((s) => (
                    <div
                      key={`${s.resourceType}-${s.subCategory}`}
                      className="flex items-center gap-space-sm p-space-sm rounded-lg bg-surface-container"
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">
                          {ICONS[s.resourceType] || "inventory_2"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-label-md text-label-md text-on-surface capitalize">
                          {LABELS[s.resourceType] || s.resourceType}
                        </p>
                        <p className="font-caption text-caption text-on-surface-variant">
                          {s.quantity} units{s.subCategory ? ` • ${s.subCategory}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                  {stock.length === 0 && (
                    <p className="font-body-sm text-body-sm text-on-surface-variant sm:col-span-2">
                      No stock recorded yet.
                    </p>
                  )}
                </div>
              </div>

              {/* Capacity & opening hours */}
              <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md">
                <div className="flex items-center justify-between mb-space-sm">
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">Capacity &amp; hours</h2>
                  {warehouse && (
                    <button
                      onClick={() => (settingsOpen ? setSettingsOpen(false) : openSettings())}
                      className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center"
                      title={settingsOpen ? "Close" : "Edit"}
                    >
                      <span className="material-symbols-outlined text-[18px]">{settingsOpen ? "close" : "edit"}</span>
                    </button>
                  )}
                </div>

                {!settingsOpen && warehouse && (
                  <div className="grid sm:grid-cols-2 gap-space-md">
                    <div>
                      <p className="font-label-sm text-label-sm text-on-surface mb-1">Capacity</p>
                      {warehouse.capacity ? (
                        <>
                          <p className="font-body-sm text-body-sm text-on-surface-variant mb-1.5">
                            Holds up to {warehouse.capacity} units
                          </p>
                          <CapacityBar warehouse={warehouse} />
                        </>
                      ) : (
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          No limit set - donors are never turned away for space.
                        </p>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-space-sm mb-1">
                        <p className="font-label-sm text-label-sm text-on-surface">Opening hours</p>
                        <OpenBadge openingHours={warehouse.openingHours} />
                      </div>
                      {warehouse.openingHours?.length > 0 ? (
                        <HoursList openingHours={warehouse.openingHours} />
                      ) : (
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          Not set - donors see no opening times.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {settingsOpen && (
                  <form onSubmit={handleSaveSettings} className="flex flex-col gap-space-md">
                    <div className="flex flex-col space-y-1.5 max-w-[280px]">
                      <label className="font-label-md text-label-md text-on-surface">Capacity in units</label>
                      <input
                        type="number"
                        min="1"
                        value={capInput}
                        onChange={(e) => setCapInput(e.target.value)}
                        className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary transition-colors"
                        placeholder="No limit"
                      />
                      <p className="font-caption text-caption text-on-surface-variant">
                        Leave empty for no limit. Currently holding {warehouse?.stockTotal ?? 0} units.
                      </p>
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <label className="font-label-md text-label-md text-on-surface">Opening hours</label>
                      <OpeningHoursEditor value={hoursDraft} onChange={setHoursDraft} />
                    </div>

                    {settingsError && <p className="font-caption text-caption text-status-critical">{settingsError}</p>}

                    <div className="flex gap-space-sm">
                      <button
                        type="submit"
                        disabled={settingsSaving}
                        className="h-11 px-space-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:opacity-95 transition-opacity disabled:opacity-60"
                      >
                        {settingsSaving ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettingsOpen(false)}
                        className="h-11 px-space-md rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-highest transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Pending pledges */}
              <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md">
                <h2 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">
                  Pending drop-offs ({pledges.length})
                </h2>
                <div className="flex flex-col gap-space-sm">
                  {pledges.map((p) => (
                    <div
                      key={p._id}
                      className="flex items-center gap-space-sm p-space-sm rounded-lg border border-surface-container-highest"
                    >
                      <div className="w-9 h-9 rounded-lg bg-status-pending/10 text-status-pending flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">
                          {ICONS[p.resourceType] || "inventory_2"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-label-md text-label-md text-on-surface">
                          {p.quantity} {LABELS[p.resourceType] || p.resourceType}
                        </p>
                        <p className="font-caption text-caption text-on-surface-variant">
                          {p.donorName} • {p.donorPhone} • {timeAgo(p.createdAt)}
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => handleCancel(p._id)}
                          disabled={busyId === p._id}
                          className="h-8 px-2.5 rounded-md bg-surface-container text-on-surface font-label-sm text-label-sm disabled:opacity-60"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleConfirm(p._id)}
                          disabled={busyId === p._id}
                          className="h-8 px-2.5 rounded-md bg-status-confirmed text-white font-label-sm text-label-sm disabled:opacity-60"
                        >
                          Confirm Arrival
                        </button>
                      </div>
                    </div>
                  ))}
                  {pledges.length === 0 && (
                    <p className="font-body-sm text-body-sm text-on-surface-variant">No pending drop-offs.</p>
                  )}
                </div>
              </div>

              {/* Recent transactions */}
              <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md">
                <h2 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">Recent activity</h2>
                <div className="flex flex-col divide-y divide-surface-container-highest">
                  {transactions.map((t) => (
                    <div key={t._id} className="py-space-xs flex items-center justify-between gap-space-sm">
                      <div className="min-w-0">
                        <p className="font-label-sm text-label-sm text-on-surface">
                          {LABELS[t.resourceType] || t.resourceType}
                          {t.subCategory ? ` • ${t.subCategory}` : ""}
                        </p>
                        <p className="font-caption text-caption text-on-surface-variant">
                          {t.reason.replace("_", " ")} • {timeAgo(t.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`font-label-md text-label-md shrink-0 ${t.quantityChange >= 0 ? "text-status-confirmed" : "text-status-critical"
                          }`}
                      >
                        {t.quantityChange >= 0 ? "+" : ""}
                        {t.quantityChange}
                      </span>
                    </div>
                  ))}
                  {transactions.length === 0 && (
                    <p className="font-body-sm text-body-sm text-on-surface-variant py-space-xs">No activity yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Manual adjust panel */}
            <aside className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md">
              <div className="flex items-center justify-between mb-space-sm">
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Adjust stock</h2>
                <button
                  onClick={() => setAdjustOpen((v) => !v)}
                  className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[18px]">{adjustOpen ? "close" : "edit"}</span>
                </button>
              </div>

              {!adjustOpen && (
                <p className="font-caption text-caption text-on-surface-variant">
                  Manually add or remove stock, e.g. a physical recount or distributed items.
                </p>
              )}

              {adjustOpen && (
                <form onSubmit={handleAdjust} className="flex flex-col gap-space-sm">
                  <div className="flex flex-col space-y-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface">Resource</label>
                    <select
                      value={adjResourceType}
                      onChange={(e) => setAdjResourceType(e.target.value)}
                      className="w-full h-10 px-3 bg-surface-container-lowest text-on-surface font-body-sm text-body-sm rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary transition-colors cursor-pointer"
                    >
                      {RESOURCES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col space-y-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface">Sub-category (optional)</label>
                    <input
                      value={adjSubCategory}
                      onChange={(e) => setAdjSubCategory(e.target.value)}
                      className="w-full h-10 px-3 bg-surface-container-lowest text-on-surface font-body-sm text-body-sm rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  <div className="flex gap-space-sm">
                    <div className="flex-1 flex flex-col space-y-1.5">
                      <label className="font-label-sm text-label-sm text-on-surface">Amount</label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={adjQuantity}
                        onChange={(e) => setAdjQuantity(e.target.value)}
                        className="w-full h-10 px-3 bg-surface-container-lowest text-on-surface font-body-sm text-body-sm rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                    <div className="flex-1 flex flex-col space-y-1.5">
                      <label className="font-label-sm text-label-sm text-on-surface">Direction</label>
                      <select
                        value={adjDirection}
                        onChange={(e) => setAdjDirection(e.target.value)}
                        className="w-full h-10 px-3 bg-surface-container-lowest text-on-surface font-body-sm text-body-sm rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary transition-colors cursor-pointer"
                      >
                        <option value="add">Add</option>
                        <option value="remove">Remove</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface">Note (optional)</label>
                    <input
                      value={adjNote}
                      onChange={(e) => setAdjNote(e.target.value)}
                      className="w-full h-10 px-3 bg-surface-container-lowest text-on-surface font-body-sm text-body-sm rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary transition-colors"
                      placeholder="e.g. physical recount"
                    />
                  </div>

                  {adjError && <p className="font-caption text-caption text-status-critical">{adjError}</p>}

                  <button
                    type="submit"
                    disabled={adjSubmitting}
                    className="h-10 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60"
                  >
                    {adjSubmitting ? "Saving..." : "Save Adjustment"}
                  </button>
                </form>
              )}
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}