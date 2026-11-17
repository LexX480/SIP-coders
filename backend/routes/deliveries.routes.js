const express = require("express");
const { body, validationResult } = require("express-validator");
const Delivery = require("../models/Delivery");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const RESOURCE_TYPES = ["food", "water", "shelter", "medical", "electrical", "clothing"];

const withWard = (query) => query.populate("ward", "name district locality");

// Only the responder who started a delivery can change it.
const mine = (req) => ({ _id: req.params.id, responder: req.user.id });

// ---------------------------------------------------------------------
// POST /api/deliveries - responder organizations only. Starts a delivery:
// stock is on its way, nothing is logged publicly yet.
// ---------------------------------------------------------------------
router.post(
  "/",
  requireAuth,
  requireRole("responder"),
  [
    body("resourceType").isIn(RESOURCE_TYPES).withMessage("Choose a resource"),
    body("subCategory").optional({ nullable: true }).isString().isLength({ max: 60 }),
    // Whole units only - the same rule the distribution log enforces, so a
    // delivery can never be accepted here and then rejected on arrival.
    body("quantity").isInt({ min: 1 }).withMessage("Enter a whole number of units"),
    body("ward").isMongoId().withMessage("Choose a ward"),
    body("location.coordinates")
      .isArray({ min: 2, max: 2 })
      .withMessage("Pick the delivery location on the map"),
    body("location.coordinates.*").isFloat().withMessage("Invalid location"),
    body("need").optional({ nullable: true }).isMongoId(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const delivery = await Delivery.create({
        responder: req.user.id,
        resourceType: req.body.resourceType,
        subCategory: req.body.subCategory || undefined,
        quantity: parseInt(req.body.quantity, 10),
        ward: req.body.ward,
        location: { coordinates: req.body.location.coordinates.map(Number) },
        need: req.body.need || undefined,
      });
      res.status(201).json(await withWard(Delivery.findById(delivery._id)));
    } catch (err) {
      res.status(500).json({ message: "Could not start this delivery", error: err.message });
    }
  }
);

// ---------------------------------------------------------------------
// GET /api/deliveries/mine - this responder's deliveries that are still on
// the way, newest first.
// ---------------------------------------------------------------------
router.get("/mine", requireAuth, requireRole("responder"), async (req, res) => {
  try {
    const deliveries = await withWard(
      Delivery.find({ responder: req.user.id, status: "in_transit" }).sort({ createdAt: -1 })
    );
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ message: "Could not load your deliveries", error: err.message });
  }
});

// ---------------------------------------------------------------------
// PATCH /api/deliveries/:id/deliver - it reached the location. Returns the
// delivery so the app can log the real distribution from it. Moves the
// status in one atomic step, so pressing the button twice can't log it twice.
// ---------------------------------------------------------------------
router.patch("/:id/deliver", requireAuth, requireRole("responder"), async (req, res) => {
  try {
    const delivery = await withWard(
      Delivery.findOneAndUpdate(
        { ...mine(req), status: "in_transit" },
        { status: "delivered", deliveredAt: new Date() },
        { returnDocument: "after" }
      )
    );
    if (!delivery) {
      const exists = await Delivery.exists(mine(req));
      if (!exists) return res.status(404).json({ message: "Delivery not found" });
      return res.status(409).json({ message: "This delivery is no longer on its way" });
    }
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ message: "Could not mark this delivered", error: err.message });
  }
});

// ---------------------------------------------------------------------
// PATCH /api/deliveries/:id/revert - undo "deliver" when logging the
// distribution failed afterwards, so the delivery goes back to "on the way"
// and can be retried instead of being lost.
// ---------------------------------------------------------------------
router.patch("/:id/revert", requireAuth, requireRole("responder"), async (req, res) => {
  try {
    const delivery = await withWard(
      Delivery.findOneAndUpdate(
        { ...mine(req), status: "delivered" },
        { status: "in_transit", $unset: { deliveredAt: "" } },
        { returnDocument: "after" }
      )
    );
    if (!delivery) return res.status(404).json({ message: "Delivery not found" });
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ message: "Could not restore this delivery", error: err.message });
  }
});

// ---------------------------------------------------------------------
// PATCH /api/deliveries/:id/cancel - it never went out (or turned back).
// Nothing was logged, so there's nothing to undo.
// ---------------------------------------------------------------------
router.patch("/:id/cancel", requireAuth, requireRole("responder"), async (req, res) => {
  try {
    const delivery = await Delivery.findOneAndUpdate(
      { ...mine(req), status: "in_transit" },
      { status: "cancelled", cancelledAt: new Date() },
      { returnDocument: "after" }
    );
    if (!delivery) {
      const exists = await Delivery.exists(mine(req));
      if (!exists) return res.status(404).json({ message: "Delivery not found" });
      return res.status(409).json({ message: "This delivery is no longer on its way" });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Could not cancel this delivery", error: err.message });
  }
});

module.exports = router;