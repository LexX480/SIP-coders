const express = require("express");
const Dispatch = require("../models/Dispatch");
const Warehouse = require("../models/Warehouse");
const InventoryTransaction = require("../models/InventoryTransaction");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const COORDINATOR_ROLES = ["ward_committee", "ndrrma", "cluster_lead"];
const DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

// "2026-10-18" in Nepal time, so a drop-off at 11pm doesn't land on the
// wrong day.
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kathmandu" });

const minutesBetween = (a, b) => (new Date(b) - new Date(a)) / 60000;
const average = (nums) => (nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : null);

// ---------------------------------------------------------------------
// GET /api/analytics/logistics - coordinator roles only. Warehouse stock,
// stock flowing in/out, and how dispatches are performing.
// ---------------------------------------------------------------------
router.get("/", requireAuth, requireRole(...COORDINATOR_ROLES), async (req, res) => {
  try {
    const [warehouses, stockRows, dispatches] = await Promise.all([
      Warehouse.find().select("name capacity"),
      InventoryTransaction.aggregate([
        { $group: { _id: { warehouse: "$warehouse", resourceType: "$resourceType" }, quantity: { $sum: "$quantityChange" } } },
      ]),
      Dispatch.find()
        .select("warehouse resourceType quantity status assignedTo need createdAt pickedUpAt deliveredAt")
        .populate("assignedTo", "organizationName")
        .lean(),
    ]);

    // ---- Stock held (from the ledger, floored at 0 per item) ----
    const stockByWarehouse = new Map();
    const stockByCategory = new Map();
    for (const r of stockRows) {
      const qty = Math.max(0, r.quantity);
      const wid = String(r._id.warehouse);
      stockByWarehouse.set(wid, (stockByWarehouse.get(wid) || 0) + qty);
      stockByCategory.set(r._id.resourceType, (stockByCategory.get(r._id.resourceType) || 0) + qty);
    }

    // ---- Dispatch numbers ----
    const live = dispatches.filter((d) => d.status !== "cancelled");
    const delivered = dispatches.filter((d) => d.status === "delivered");
    const byStatus = { pending_pickup: 0, picked_up: 0, delivered: 0, cancelled: 0 };
    const unitsByWarehouse = new Map();
    const responders = new Map();
    for (const d of dispatches) {
      byStatus[d.status] = (byStatus[d.status] || 0) + 1;
      if (d.status === "cancelled") continue;
      const wid = String(d.warehouse);
      const w = unitsByWarehouse.get(wid) || { units: 0, count: 0 };
      w.units += d.quantity;
      w.count += 1;
      unitsByWarehouse.set(wid, w);

      const rid = String(d.assignedTo?._id || d.assignedTo);
      const r = responders.get(rid) || {
        organizationName: d.assignedTo?.organizationName || "Unknown organization",
        dispatches: 0,
        delivered: 0,
        units: 0,
      };
      r.dispatches += 1;
      r.units += d.quantity;
      if (d.status === "delivered") r.delivered += 1;
      responders.set(rid, r);
    }

    // ---- Stock in vs. out per day, last 14 days ----
    const since = new Date(Date.now() - (DAYS - 1) * DAY_MS);
    since.setHours(0, 0, 0, 0);
    const recent = await InventoryTransaction.find({ createdAt: { $gte: new Date(since.getTime() - DAY_MS) } })
      .select("quantityChange reason createdAt")
      .lean();

    const flow = new Map();
    for (let i = DAYS - 1; i >= 0; i--) flow.set(dayKey(Date.now() - i * DAY_MS), { date: "", received: 0, sentOut: 0 });
    for (const [date, row] of flow) row.date = date;
    for (const t of recent) {
      const row = flow.get(dayKey(t.createdAt));
      if (!row) continue;
      if (t.reason === "dropoff_confirmed" || t.reason === "manual_add") row.received += t.quantityChange;
      // Cancelled dispatches put units back, so they net off what went out.
      if (t.reason === "distributed_out" || t.reason === "dispatch_cancelled") row.sentOut -= t.quantityChange;
    }

    const totalCapacity = warehouses.reduce((s, w) => s + (w.capacity || 0), 0);
    const stockInCapped = warehouses.reduce(
      (s, w) => s + (w.capacity ? Math.min(w.capacity, stockByWarehouse.get(String(w._id)) || 0) : 0),
      0
    );

    res.json({
      summary: {
        warehouseCount: warehouses.length,
        totalStock: [...stockByWarehouse.values()].reduce((s, n) => s + n, 0),
        totalCapacity,
        utilisationPct: totalCapacity ? Math.round((stockInCapped / totalCapacity) * 100) : null,
        unitsDispatched: live.reduce((s, d) => s + d.quantity, 0),
        unitsDelivered: delivered.reduce((s, d) => s + d.quantity, 0),
        needsServed: new Set(live.map((d) => String(d.need))).size,
        dispatchCount: live.length,
        inTransit: byStatus.pending_pickup + byStatus.picked_up,
        // How long things take, in minutes (null until there's data).
        avgPickupMins: average(
          live.filter((d) => d.pickedUpAt).map((d) => minutesBetween(d.createdAt, d.pickedUpAt))
        ),
        avgDeliveryMins: average(
          delivered.filter((d) => d.pickedUpAt && d.deliveredAt).map((d) => minutesBetween(d.pickedUpAt, d.deliveredAt))
        ),
        avgTotalMins: average(delivered.filter((d) => d.deliveredAt).map((d) => minutesBetween(d.createdAt, d.deliveredAt))),
      },
      dispatchStatus: byStatus,
      flow: [...flow.values()],
      warehouses: warehouses
        .map((w) => {
          const stock = stockByWarehouse.get(String(w._id)) || 0;
          const sent = unitsByWarehouse.get(String(w._id)) || { units: 0, count: 0 };
          return {
            _id: w._id,
            name: w.name,
            stock,
            capacity: w.capacity || null,
            percentFull: w.capacity ? Math.min(100, Math.round((stock / w.capacity) * 100)) : null,
            unitsDispatched: sent.units,
            dispatchCount: sent.count,
          };
        })
        .sort((a, b) => b.stock - a.stock),
      stockByCategory: [...stockByCategory.entries()]
        .map(([resourceType, quantity]) => ({ resourceType, quantity }))
        .filter((c) => c.quantity > 0)
        .sort((a, b) => b.quantity - a.quantity),
      responders: [...responders.values()].sort((a, b) => b.units - a.units).slice(0, 5),
    });
  } catch (err) {
    res.status(500).json({ message: "Could not load warehouse analytics", error: err.message });
  }
});

module.exports = router;