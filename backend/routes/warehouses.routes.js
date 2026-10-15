const express = require("express");
const { body, validationResult } = require("express-validator");
const Warehouse = require("../models/Warehouse");
const InventoryTransaction = require("../models/InventoryTransaction");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const RESOURCE_TYPES = ["food", "water", "shelter", "medical", "electrical", "clothing"];
const COORDINATOR_ROLES = ["ward_committee", "ndrrma", "cluster_lead"];

// ---------------------------------------------------------------------
// GET /api/warehouses - public. Used by the Drop Off Materials form so
// anyone can see where storage points are, and by the coordination side
// to list warehouses to manage.
// ---------------------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.ward) filter.ward = req.query.ward;

    const warehouses = await Warehouse.find(filter)
      .populate("ward", "name district locality")
      .sort({ name: 1 });
    res.json(warehouses);
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
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const warehouse = await Warehouse.create({
        name: req.body.name,
        ward: req.body.ward,
        address: req.body.address,
        location: { type: "Point", coordinates: req.body.location.coordinates },
        contactPhone: req.body.contactPhone || undefined,
        createdBy: req.user.id,
      });
      const populated = await warehouse.populate("ward", "name district locality");
      res.status(201).json(populated);
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
    res.json(warehouse);
  } catch (err) {
    res.status(500).json({ message: "Could not load warehouse", error: err.message });
  }
});

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