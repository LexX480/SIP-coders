const express = require("express");
const { body, validationResult } = require("express-validator");
const DropoffPledge = require("../models/DropoffPledge");
const Warehouse = require("../models/Warehouse");
const InventoryTransaction = require("../models/InventoryTransaction");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const RESOURCE_TYPES = ["food", "water", "shelter", "medical", "electrical", "clothing"];
const COORDINATOR_ROLES = ["ward_committee", "ndrrma", "cluster_lead"];

// ---------------------------------------------------------------------
// POST /api/dropoffs - public, no login required. Anyone with relief
// material to give submits this, gets back the warehouse's address so
// they know where to physically bring it. This is a pledge only - it
// does NOT touch inventory yet, since nothing has actually arrived.
// ---------------------------------------------------------------------
router.post(
  "/",
  [
    body("warehouse").notEmpty().withMessage("Choose a drop-off location"),
    body("resourceType").isIn(RESOURCE_TYPES),
    body("subCategory").optional().isString().isLength({ max: 60 }),
    body("quantity").isFloat({ min: 1 }).withMessage("Enter how many units you're bringing"),
    body("donorName").trim().notEmpty().withMessage("Your name is required").isLength({ max: 80 }),
    body("donorPhone").trim().notEmpty().withMessage("Your phone number is required").isLength({ max: 20 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const warehouse = await Warehouse.findById(req.body.warehouse).populate("ward", "name district locality");
      if (!warehouse) return res.status(404).json({ message: "That drop-off location could not be found" });

      const pledge = await DropoffPledge.create({
        warehouse: warehouse._id,
        resourceType: req.body.resourceType,
        subCategory: req.body.subCategory || undefined,
        quantity: req.body.quantity,
        donorName: req.body.donorName,
        donorPhone: req.body.donorPhone,
      });

      res.status(201).json({ pledge, warehouse });
    } catch (err) {
      res.status(500).json({ message: "Could not submit your drop-off", error: err.message });
    }
  }
);

// ---------------------------------------------------------------------
// GET /api/dropoffs - coordinator roles only. Used on the warehouse
// inventory dashboard to see what's pending/received/cancelled.
// ---------------------------------------------------------------------
router.get("/", requireAuth, requireRole(...COORDINATOR_ROLES), async (req, res) => {
  try {
    const filter = {};
    if (req.query.warehouse) filter.warehouse = req.query.warehouse;
    if (req.query.status) filter.status = req.query.status;

    const pledges = await DropoffPledge.find(filter)
      .populate("warehouse", "name")
      .populate("confirmedBy", "name")
      .sort({ createdAt: -1 });
    res.json(pledges);
  } catch (err) {
    res.status(500).json({ message: "Could not load drop-offs", error: err.message });
  }
});

// ---------------------------------------------------------------------
// PATCH /api/dropoffs/:id/confirm - coordinator roles only. Called once a
// coordinator has physically received and counted the donation. This is
// the only place a pledge turns into real tracked stock: it writes an
// InventoryTransaction for the confirmed amount (which may differ from
// what was originally pledged).
// ---------------------------------------------------------------------
router.patch(
  "/:id/confirm",
  requireAuth,
  requireRole(...COORDINATOR_ROLES),
  [body("confirmedQuantity").optional().isFloat({ min: 0.01 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const pledge = await DropoffPledge.findById(req.params.id);
      if (!pledge) return res.status(404).json({ message: "Drop-off not found" });
      if (pledge.status !== "pending") {
        return res.status(409).json({ message: "This drop-off has already been reviewed" });
      }

      const confirmedQuantity = req.body.confirmedQuantity || pledge.quantity;

      pledge.status = "received";
      pledge.confirmedQuantity = confirmedQuantity;
      pledge.confirmedBy = req.user.id;
      pledge.confirmedAt = new Date();
      await pledge.save({ validateModifiedOnly: true });

      await InventoryTransaction.create({
        warehouse: pledge.warehouse,
        resourceType: pledge.resourceType,
        subCategory: pledge.subCategory || undefined,
        quantityChange: confirmedQuantity,
        reason: "dropoff_confirmed",
        relatedPledge: pledge._id,
        performedBy: req.user.id,
      });

      const populated = await pledge.populate([
        { path: "warehouse", select: "name" },
        { path: "confirmedBy", select: "name" },
      ]);
      res.json(populated);
    } catch (err) {
      res.status(500).json({ message: "Could not confirm this drop-off", error: err.message });
    }
  }
);

// ---------------------------------------------------------------------
// PATCH /api/dropoffs/:id/cancel - coordinator roles only. E.g. a pledge
// that never showed up. Never touches inventory.
// ---------------------------------------------------------------------
router.patch(
  "/:id/cancel",
  requireAuth,
  requireRole(...COORDINATOR_ROLES),
  [body("note").optional().isString().isLength({ max: 200 })],
  async (req, res) => {
    try {
      const pledge = await DropoffPledge.findById(req.params.id);
      if (!pledge) return res.status(404).json({ message: "Drop-off not found" });
      if (pledge.status !== "pending") {
        return res.status(409).json({ message: "This drop-off has already been reviewed" });
      }

      pledge.status = "cancelled";
      if (req.body.note) pledge.note = req.body.note;
      await pledge.save({ validateModifiedOnly: true });

      const populated = await pledge.populate("warehouse", "name");
      res.json(populated);
    } catch (err) {
      res.status(500).json({ message: "Could not cancel this drop-off", error: err.message });
    }
  }
);

module.exports = router;