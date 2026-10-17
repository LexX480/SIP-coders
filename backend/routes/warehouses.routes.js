const express = require("express");
const { body, validationResult } = require("express-validator");
const Warehouse = require("../models/Warehouse");
const InventoryTransaction = require("../models/InventoryTransaction");
const { requireAuth, requireRole } = require("../middleware/auth");
const { getStockTotals, withStats } = require("../utils/warehouseStats");

const router = express.Router();

const RESOURCE_TYPES = ["food", "water", "shelter", "medical", "electrical", "clothing"];
const COORDINATOR_ROLES = ["ward_committee", "ndrrma", "cluster_lead"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Opening hours arrive as an array of { day, closed, open, close }, one per
// weekday. "HH:MM" strings compare correctly as plain strings, so
// "closing must be after opening" is a simple string comparison.
function validateOpeningHours(value) {
  if (!Array.isArray(value)) throw new Error("Opening hours must be a list");
  if (value.length > 7) throw new Error("Opening hours can have at most one entry per day");

  const seen = new Set();
  for (const h of value) {
    if (!Number.isInteger(h.day) || h.day < 0 || h.day > 6) throw new Error("Invalid day in opening hours");
    if (seen.has(h.day)) throw new Error("Each day can only appear once in opening hours");
    seen.add(h.day);

    if (h.closed) continue;
    if (!TIME_RE.test(h.open || "") || !TIME_RE.test(h.close || "")) {
      throw new Error("Opening and closing times must look like 09:00");
    }
    if (h.close <= h.open) throw new Error("Closing time must be after opening time");
  }
  return true;
}

function cleanOpeningHours(hours) {
  return hours
    .map((h) => ({
      day: h.day,
      closed: !!h.closed,
      open: h.closed ? undefined : h.open,
      close: h.closed ? undefined : h.close,
    }))
    .sort((a, b) => a.day - b.day);
}

const capacityValidator = body("capacity")
  .optional({ nullable: true })
  .custom((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 1))
  .withMessage("Capacity must be 1 or more");

const hoursValidator = body("openingHours").optional().custom(validateOpeningHours);

// ---------------------------------------------------------------------
// GET /api/warehouses - public. Used by the Drop Off Materials form so
// anyone can see where storage points are, and by the coordination side
// to list warehouses to manage. Each warehouse comes back with its
// capacity usage (stockTotal / percentFull / spaceLeft / isFull).
// ---------------------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.ward) filter.ward = req.query.ward;

    const warehouses = await Warehouse.find(filter)
      .populate("ward", "name district locality")
      .sort({ name: 1 });

    const totals = await getStockTotals(warehouses.map((w) => w._id));
    res.json(warehouses.map((w) => withStats(w, totals.get(String(w._id)) || 0)));
  } catch (err) {
    res.status(500).json({ message: "Could not load warehouses", error: err.message });
  }
});

// ---------------------------------------------------------------------
// POST /api/warehouses - coordinator roles only. Sets up a new drop-off
// point / storage unit.
// ---------------------------------------------------------------------
router.post(
  "/",
  requireAuth,
  requireRole(...COORDINATOR_ROLES),
  [
    body("name").trim().notEmpty().withMessage("Name is required").isLength({ max: 80 }),
    body("ward").notEmpty().withMessage("Ward is required"),
    body("address").trim().notEmpty().withMessage("Address is required").isLength({ max: 200 }),
    body("location.coordinates").isArray({ min: 2, max: 2 }).withMessage("Pick a location on the map"),
    body("contactPhone").optional().isString().isLength({ max: 20 }),
    capacityValidator,
    hoursValidator,
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const capacity = req.body.capacity === "" || req.body.capacity == null ? undefined : Number(req.body.capacity);

      const warehouse = await Warehouse.create({
        name: req.body.name,
        ward: req.body.ward,
        address: req.body.address,
        location: { type: "Point", coordinates: req.body.location.coordinates },
        contactPhone: req.body.contactPhone || undefined,
        capacity,
        openingHours: req.body.openingHours ? cleanOpeningHours(req.body.openingHours) : [],
        createdBy: req.user.id,
      });
      const populated = await warehouse.populate("ward", "name district locality");
      res.status(201).json(withStats(populated, 0));
    } catch (err) {
      res.status(500).json({ message: "Could not create warehouse", error: err.message });
    }
  }
);

// ---------------------------------------------------------------------
// GET /api/warehouses/:id - public. Used on the Drop Off Materials
// confirmation screen so a donor can see exactly where to go.
// ---------------------------------------------------------------------
router.get("/:id", async (req, res) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id).populate("ward", "name district locality");
    if (!warehouse) return res.status(404).json({ message: "Warehouse not found" });

    const totals = await getStockTotals([warehouse._id]);
    res.json(withStats(warehouse, totals.get(String(warehouse._id)) || 0));
  } catch (err) {
    res.status(500).json({ message: "Could not load warehouse", error: err.message });
  }
});

// ---------------------------------------------------------------------
// PATCH /api/warehouses/:id - coordinator roles only. Updates capacity
// and/or opening hours after a warehouse has been created. Send
// capacity: null to remove the limit, openingHours: [] to clear the hours.
// ---------------------------------------------------------------------
router.patch(
  "/:id",
  requireAuth,
  requireRole(...COORDINATOR_ROLES),
  [capacityValidator, hoursValidator, body("contactPhone").optional().isString().isLength({ max: 20 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const warehouse = await Warehouse.findById(req.params.id);
      if (!warehouse) return res.status(404).json({ message: "Warehouse not found" });

      if ("capacity" in req.body) {
        const c = req.body.capacity;
        warehouse.capacity = c === "" || c == null ? undefined : Number(c);
      }
      if ("openingHours" in req.body) {
        warehouse.openingHours = cleanOpeningHours(req.body.openingHours || []);
      }
      if ("contactPhone" in req.body) {
        warehouse.contactPhone = req.body.contactPhone || undefined;
      }

      await warehouse.save();
      const populated = await warehouse.populate("ward", "name district locality");
      const totals = await getStockTotals([warehouse._id]);
      res.json(withStats(populated, totals.get(String(warehouse._id)) || 0));
    } catch (err) {
      res.status(500).json({ message: "Could not update warehouse", error: err.message });
    }
  }
);

// ---------------------------------------------------------------------
// GET /api/warehouses/:id/inventory - coordinator roles only. Current
// stock is never stored directly - it's the sum of every
// InventoryTransaction for this warehouse, grouped by resourceType +
// subCategory, so this is always consistent with the transaction history.
// ---------------------------------------------------------------------
router.get("/:id/inventory", requireAuth, requireRole(...COORDINATOR_ROLES), async (req, res) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) return res.status(404).json({ message: "Warehouse not found" });

    const stock = await InventoryTransaction.aggregate([
      { $match: { warehouse: warehouse._id } },
      {
        $group: {
          _id: { resourceType: "$resourceType", subCategory: { $ifNull: ["$subCategory", ""] } },
          quantity: { $sum: "$quantityChange" },
        },
      },
      {
        $project: {
          _id: 0,
          resourceType: "$_id.resourceType",
          subCategory: "$_id.subCategory",
          quantity: 1,
        },
      },
      { $sort: { resourceType: 1 } },
    ]);

    const transactions = await InventoryTransaction.find({ warehouse: warehouse._id })
      .populate("performedBy", "name organizationName")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ stock, transactions });
  } catch (err) {
    res.status(500).json({ message: "Could not load inventory", error: err.message });
  }
});

// ---------------------------------------------------------------------
// POST /api/warehouses/:id/inventory/adjust - coordinator roles only.
// Manual stock entry/correction, independent of any donor pledge (e.g.
// physical recount, damaged goods written off, or stock handed out).
// ---------------------------------------------------------------------
router.post(
  "/:id/inventory/adjust",
  requireAuth,
  requireRole(...COORDINATOR_ROLES),
  [
    body("resourceType").isIn(RESOURCE_TYPES),
    body("subCategory").optional().isString().isLength({ max: 60 }),
    body("quantity").isFloat({ min: 0.01 }).withMessage("Enter an amount greater than 0"),
    body("direction").isIn(["add", "remove"]),
    body("note").optional().isString().isLength({ max: 200 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const warehouse = await Warehouse.findById(req.params.id);
      if (!warehouse) return res.status(404).json({ message: "Warehouse not found" });

      const signedQuantity = req.body.direction === "add" ? req.body.quantity : -req.body.quantity;

      const transaction = await InventoryTransaction.create({
        warehouse: warehouse._id,
        resourceType: req.body.resourceType,
        subCategory: req.body.subCategory || undefined,
        quantityChange: signedQuantity,
        reason: req.body.direction === "add" ? "manual_add" : "manual_remove",
        note: req.body.note || undefined,
        performedBy: req.user.id,
      });

      res.status(201).json(transaction);
    } catch (err) {
      res.status(500).json({ message: "Could not adjust inventory", error: err.message });
    }
  }
);

module.exports = router;