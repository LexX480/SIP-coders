const express = require("express");
const { body, validationResult } = require("express-validator");
const Dispatch = require("../models/Dispatch");
const Warehouse = require("../models/Warehouse");
const NeedReport = require("../models/NeedReport");
const InventoryTransaction = require("../models/InventoryTransaction");
const User = require("../models/User");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const COORDINATOR_ROLES = ["ward_committee", "ndrrma", "cluster_lead"];
const URGENCY_WEIGHT = { urgent: 3, medium: 2, low: 1 };

// Stock that has been sent out for a need counts against that need as soon
// as it's dispatched, whether or not it has arrived yet.
const COUNTED_STATUSES = ["pending_pickup", "picked_up", "delivered"];

// Great-circle distance in km between two [lng, lat] points.
function distanceKm([lng1, lat1], [lng2, lat2]) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Units currently in a warehouse for one exact item (resourceType +
// optional subCategory), summed from the ledger.
async function stockFor(warehouseId, resourceType, subCategory) {
  const subFilter = subCategory ? { subCategory } : { subCategory: { $in: [null, ""] } };
  const rows = await InventoryTransaction.aggregate([
    { $match: { warehouse: warehouseId, resourceType, ...subFilter } },
    { $group: { _id: null, total: { $sum: "$quantityChange" } } },
  ]);
  return rows.length ? rows[0].total : 0;
}

// Units already dispatched (not cancelled) for a need.
async function dispatchedFor(needId, statuses = COUNTED_STATUSES) {
  const rows = await Dispatch.aggregate([
    { $match: { need: needId, status: { $in: statuses } } },
    { $group: { _id: null, total: { $sum: "$quantity" } } },
  ]);
  return rows.length ? rows[0].total : 0;
}

// Everything a pickup card needs, in one populate.
function withDetails(query) {
  return query
    .populate("warehouse", "name address location contactPhone openingHours")
    .populate("need", "resourceType subCategory urgency quantityNeeded location reporterName reporterPhone status")
    .populate("ward", "name district locality")
    .populate("assignedTo", "organizationName");
}

// ---------------------------------------------------------------------
// GET /api/dispatches/candidates/:warehouseId - coordinator roles only.
// Open/claimed need reports this warehouse could cover right now: same
// resource type as something it has in stock, and not already fully
// covered by earlier dispatches. Most urgent first, then nearest.
// ---------------------------------------------------------------------
router.get("/candidates/:warehouseId", requireAuth, requireRole(...COORDINATOR_ROLES), async (req, res) => {
  try {
    const warehouse = await Warehouse.findById(req.params.warehouseId);
    if (!warehouse) return res.status(404).json({ message: "Warehouse not found" });

    const stockRows = await InventoryTransaction.aggregate([
      { $match: { warehouse: warehouse._id } },
      {
        $group: {
          _id: { resourceType: "$resourceType", subCategory: { $ifNull: ["$subCategory", ""] } },
          quantity: { $sum: "$quantityChange" },
        },
      },
    ]);

    const linesByType = new Map();
    for (const r of stockRows) {
      if (r.quantity <= 0) continue;
      const lines = linesByType.get(r._id.resourceType) || [];
      lines.push({ subCategory: r._id.subCategory, quantity: r.quantity });
      linesByType.set(r._id.resourceType, lines);
    }
    for (const lines of linesByType.values()) lines.sort((a, b) => b.quantity - a.quantity);

    if (linesByType.size === 0) return res.json({ needs: [] });

    const needs = await NeedReport.find({
      status: { $in: ["open", "claimed"] },
      resourceType: { $in: [...linesByType.keys()] },
    })
      .populate("ward", "name district locality")
      .populate("claimedBy", "organizationName fullName name role")
      .populate("assignedTo", "organizationName");

    const sentRows = await Dispatch.aggregate([
      { $match: { need: { $in: needs.map((n) => n._id) }, status: { $in: COUNTED_STATUSES } } },
      { $group: { _id: "$need", total: { $sum: "$quantity" } } },
    ]);
    const sentByNeed = new Map(sentRows.map((r) => [String(r._id), r.total]));

    const candidates = [];
    for (const n of needs) {
      const dispatched = sentByNeed.get(String(n._id)) || 0;
      const remaining = n.quantityNeeded - dispatched;
      if (remaining <= 0) continue;

      // Pre-select whoever is already tied to this need: the organization a
      // coordinator referred it to, otherwise a responder who claimed it.
      let suggestedResponder = null;
      if (n.assignedTo) {
        suggestedResponder = { _id: n.assignedTo._id, organizationName: n.assignedTo.organizationName };
      } else if (n.claimedBy && n.claimedBy.role === "responder") {
        suggestedResponder = {
          _id: n.claimedBy._id,
          organizationName: n.claimedBy.organizationName || n.claimedBy.name,
        };
      }

      const hasPoints = n.location?.coordinates?.length === 2 && warehouse.location?.coordinates?.length === 2;
      candidates.push({
        _id: n._id,
        resourceType: n.resourceType,
        subCategory: n.subCategory || "",
        urgency: n.urgency,
        status: n.status,
        quantityNeeded: n.quantityNeeded,
        dispatched,
        remaining,
        ward: n.ward,
        createdAt: n.createdAt,
        distanceKm: hasPoints
          ? Math.round(distanceKm(warehouse.location.coordinates, n.location.coordinates) * 10) / 10
          : null,
        suggestedResponder,
        stockLines: linesByType.get(n.resourceType),
      });
    }

    candidates.sort((a, b) => {
      const byUrgency = (URGENCY_WEIGHT[b.urgency] || 0) - (URGENCY_WEIGHT[a.urgency] || 0);
      if (byUrgency !== 0) return byUrgency;
      const da = a.distanceKm ?? Infinity;
      const db = b.distanceKm ?? Infinity;
      if (da !== db) return da - db;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    res.json({ needs: candidates });
  } catch (err) {
    res.status(500).json({ message: "Could not load matching needs", error: err.message });
  }
});

// ---------------------------------------------------------------------
// POST /api/dispatches - coordinator roles only. Sends stock from a
// warehouse to cover (part of) a need. The units leave the warehouse's
// inventory immediately, and the chosen responder organization gets a
// pickup task on its dashboard.
// ---------------------------------------------------------------------
router.post(
  "/",
  requireAuth,
  requireRole(...COORDINATOR_ROLES),
  [
    body("warehouse").isMongoId().withMessage("Choose a warehouse"),
    body("need").isMongoId().withMessage("Choose a need to fulfil"),
    body("assignedTo").isMongoId().withMessage("Choose which organization should pick this up"),
    body("quantity").isFloat({ min: 1 }).withMessage("Enter how many units to send"),
    body("subCategory").optional({ nullable: true }).isString().isLength({ max: 60 }),
    body("note").optional({ nullable: true }).isString().isLength({ max: 200 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const warehouse = await Warehouse.findById(req.body.warehouse);
      if (!warehouse) return res.status(404).json({ message: "Warehouse not found" });

      const need = await NeedReport.findById(req.body.need);
      if (!need) return res.status(404).json({ message: "Need report not found" });
      if (need.status === "addressed") {
        return res.status(409).json({ message: "This need has already been addressed" });
      }

      const responder = await User.findOne({ _id: req.body.assignedTo, role: "responder" });
      if (!responder) return res.status(404).json({ message: "That organization could not be found" });

      const quantity = Number(req.body.quantity);
      const subCategory = req.body.subCategory || undefined;

      const available = await stockFor(warehouse._id, need.resourceType, subCategory);
      if (quantity > available) {
        return res.status(409).json({
          message: `Only ${available} units of that item are in stock at this warehouse.`,
        });
      }

      const remaining = need.quantityNeeded - (await dispatchedFor(need._id));
      if (remaining <= 0) {
        return res.status(409).json({ message: "Enough has already been dispatched for this need." });
      }
      if (quantity > remaining) {
        return res.status(409).json({
          message: `Only ${remaining} more units are still needed for this request.`,
        });
      }

      const dispatch = await Dispatch.create({
        warehouse: warehouse._id,
        need: need._id,
        ward: need.ward,
        resourceType: need.resourceType,
        subCategory,
        quantity,
        assignedTo: responder._id,
        note: req.body.note || undefined,
        createdBy: req.user.id,
      });

      let deduction;
      try {
        deduction = await InventoryTransaction.create({
          warehouse: warehouse._id,
          resourceType: need.resourceType,
          subCategory,
          quantityChange: -quantity,
          reason: "distributed_out",
          relatedDispatch: dispatch._id,
          note: `Dispatched to ${responder.organizationName || "responder"}`,
          performedBy: req.user.id,
        });
      } catch (txErr) {
        // Never leave a pickup task behind for stock that wasn't deducted.
        await Dispatch.deleteOne({ _id: dispatch._id });
        throw txErr;
      }

      // Two coordinators sending the same last units at the same moment can
      // both get past the checks above. Now that both writes are in, check
      // again: if this one took stock below zero or sent more than the need
      // asked for, undo it. (If both race, both are undone and either can
      // simply retry - stock is never oversold.)
      const stockAfter = await stockFor(warehouse._id, need.resourceType, subCategory);
      const sentAfter = await dispatchedFor(need._id);
      if (stockAfter < 0 || sentAfter > need.quantityNeeded) {
        await InventoryTransaction.deleteOne({ _id: deduction._id });
        await Dispatch.deleteOne({ _id: dispatch._id });
        return res.status(409).json({
          message: "Someone else just dispatched the same stock. Refresh and try again.",
        });
      }

      // Show the need on that organization's "Community Needs" list as
      // assigned to them, unless it has already been referred elsewhere.
      if (!need.assignedTo) {
        need.assignedTo = responder._id;
        need.assignedAt = new Date();
        await need.save({ validateModifiedOnly: true });
      }

      const populated = await withDetails(Dispatch.findById(dispatch._id));
      res.status(201).json(populated);
    } catch (err) {
      res.status(500).json({ message: "Could not create this dispatch", error: err.message });
    }
  }
);

// ---------------------------------------------------------------------
// GET /api/dispatches - coordinator roles only. Dispatches, newest first.
// Filter with ?warehouse=<id> and/or ?status=<status>.
// ---------------------------------------------------------------------
router.get("/", requireAuth, requireRole(...COORDINATOR_ROLES), async (req, res) => {
  try {
    const filter = {};
    if (req.query.warehouse) filter.warehouse = req.query.warehouse;
    if (req.query.status) filter.status = req.query.status;

    const dispatches = await withDetails(Dispatch.find(filter).sort({ createdAt: -1 }).limit(50));
    res.json(dispatches);
  } catch (err) {
    res.status(500).json({ message: "Could not load dispatches", error: err.message });
  }
});

// ---------------------------------------------------------------------
// GET /api/dispatches/mine - responder organizations only. Pickups still
// waiting to be collected or on their way, most urgent first. This is what
// the banner at the top of the responder dashboard shows.
// ---------------------------------------------------------------------
router.get("/mine", requireAuth, requireRole("responder"), async (req, res) => {
  try {
    const dispatches = await withDetails(
      Dispatch.find({ assignedTo: req.user.id, status: { $in: ["pending_pickup", "picked_up"] } })
    );

    dispatches.sort((a, b) => {
      // Not yet collected before already on the way, then urgency, then oldest.
      const aStage = a.status === "pending_pickup" ? 1 : 0;
      const bStage = b.status === "pending_pickup" ? 1 : 0;
      if (aStage !== bStage) return bStage - aStage;
      const byUrgency = (URGENCY_WEIGHT[b.need?.urgency] || 0) - (URGENCY_WEIGHT[a.need?.urgency] || 0);
      if (byUrgency !== 0) return byUrgency;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    res.json(dispatches);
  } catch (err) {
    res.status(500).json({ message: "Could not load your pickups", error: err.message });
  }
});

// Only the organization a dispatch is assigned to (or a coordinator) can
// move it along.
async function loadForUpdate(req, res) {
  const dispatch = await Dispatch.findById(req.params.id);
  if (!dispatch) {
    res.status(404).json({ message: "Dispatch not found" });
    return null;
  }
  const isAssignee = String(dispatch.assignedTo) === String(req.user.id);
  const isCoordinator = COORDINATOR_ROLES.includes(req.user.role);
  if (!isAssignee && !isCoordinator) {
    res.status(403).json({ message: "This pickup isn't assigned to you" });
    return null;
  }
  return dispatch;
}

// ---------------------------------------------------------------------
// PATCH /api/dispatches/:id/pickup - volunteers have collected the stock.
// ---------------------------------------------------------------------
router.patch("/:id/pickup", requireAuth, async (req, res) => {
  try {
    const dispatch = await loadForUpdate(req, res);
    if (!dispatch) return;

    const updated = await Dispatch.findOneAndUpdate(
      { _id: dispatch._id, status: "pending_pickup" },
      { status: "picked_up", pickedUpAt: new Date() }
    );
    if (!updated) {
      return res.status(409).json({ message: "This pickup has already been collected or was cancelled" });
    }

    res.json(await withDetails(Dispatch.findById(updated._id)));
  } catch (err) {
    res.status(500).json({ message: "Could not update this pickup", error: err.message });
  }
});

// ---------------------------------------------------------------------
// PATCH /api/dispatches/:id/deliver - the stock reached the community.
// Once everything delivered for a need adds up to what was asked for, the
// need itself is marked addressed.
// ---------------------------------------------------------------------
router.patch("/:id/deliver", requireAuth, async (req, res) => {
  try {
    const dispatch = await loadForUpdate(req, res);
    if (!dispatch) return;

    const updated = await Dispatch.findOneAndUpdate(
      { _id: dispatch._id, status: "picked_up" },
      { status: "delivered", deliveredAt: new Date() }
    );
    if (!updated) {
      return res.status(409).json({ message: "Mark this as picked up before delivering it" });
    }

    const need = await NeedReport.findById(updated.need);
    if (need && need.status !== "addressed") {
      const delivered = await dispatchedFor(need._id, ["delivered"]);
      if (delivered >= need.quantityNeeded) {
        need.status = "addressed";
        await need.save({ validateModifiedOnly: true });
      }
    }

    res.json(await withDetails(Dispatch.findById(updated._id)));
  } catch (err) {
    res.status(500).json({ message: "Could not update this delivery", error: err.message });
  }
});

// ---------------------------------------------------------------------
// PATCH /api/dispatches/:id/cancel - coordinator roles only, and only
// before the stock has been collected. The units go back into the
// warehouse's inventory.
// ---------------------------------------------------------------------
router.patch("/:id/cancel", requireAuth, requireRole(...COORDINATOR_ROLES), async (req, res) => {
  try {
    const cancelled = await Dispatch.findOneAndUpdate(
      { _id: req.params.id, status: "pending_pickup" },
      { status: "cancelled", cancelledAt: new Date() }
    );

    if (!cancelled) {
      const exists = await Dispatch.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ message: "Dispatch not found" });
      return res.status(409).json({ message: "Only a pickup that hasn't been collected yet can be cancelled" });
    }

    await InventoryTransaction.create({
      warehouse: cancelled.warehouse,
      resourceType: cancelled.resourceType,
      subCategory: cancelled.subCategory || undefined,
      quantityChange: cancelled.quantity,
      reason: "dispatch_cancelled",
      relatedDispatch: cancelled._id,
      performedBy: req.user.id,
    });

    res.json(await withDetails(Dispatch.findById(cancelled._id)));
  } catch (err) {
    res.status(500).json({ message: "Could not cancel this dispatch", error: err.message });
  }
});

module.exports = router;