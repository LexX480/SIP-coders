const express = require("express");
const DuplicationAlert = require("../models/DuplicationAlert");
const Distribution = require("../models/Distribution");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const COORD_ROLES = ["ward_committee", "ndrrma", "cluster_lead"];

// GET /api/alerts - used for the "Active Duplication Alerts" stat +
// coordination dashboard alert list. Coordination roles only.
router.get("/", requireAuth, requireRole(...COORD_ROLES), async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const alerts = await DuplicationAlert.find(filter)
      .populate("ward", "name district")
      .sort({ createdAt: -1 });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: "Could not load alerts", error: err.message });
  }
});

// ---------------------------------------------------------------------
// GET /api/alerts/:id  (Screen 10: Duplication Alert Detail)
// "3 organizations reported delivering tents here"
// ---------------------------------------------------------------------
router.get("/:id", requireAuth, requireRole(...COORD_ROLES), async (req, res) => {
  try {
    const alert = await DuplicationAlert.findById(req.params.id)
      .populate("ward", "name district")
      .populate({
        path: "distributions",
        populate: [
          { path: "organization", select: "organizationName" },
          { path: "ward", select: "name" },
        ],
      });

    if (!alert) return res.status(404).json({ message: "Alert not found" });
    res.json(alert);
  } catch (err) {
    res.status(500).json({ message: "Could not load alert", error: err.message });
  }
});

// POST /api/alerts/:id/confirm  ("Confirm Duplicate" button)
router.post("/:id/confirm", requireAuth, requireRole(...COORD_ROLES), async (req, res) => {
  try {
    const alert = await DuplicationAlert.findByIdAndUpdate(
      req.params.id,
      { status: "confirmed", reviewedBy: req.user.id, reviewedAt: new Date() },
      { new: true }
    );
    if (!alert) return res.status(404).json({ message: "Alert not found" });
    res.json(alert);
  } catch (err) {
    res.status(500).json({ message: "Could not update alert", error: err.message });
  }
});

// POST /api/alerts/:id/dismiss  ("Dismiss Alert" button)
router.post("/:id/dismiss", requireAuth, requireRole(...COORD_ROLES), async (req, res) => {
  try {
    const alert = await DuplicationAlert.findByIdAndUpdate(
      req.params.id,
      { status: "dismissed", reviewedBy: req.user.id, reviewedAt: new Date() },
      { new: true }
    );
    if (!alert) return res.status(404).json({ message: "Alert not found" });

    // Dismissing clears the duplicate flag off the underlying distributions
    await Distribution.updateMany(
      { _id: { $in: alert.distributions } },
      { $set: { status: "confirmed" }, $unset: { duplicateNote: "" } }
    );

    res.json(alert);
  } catch (err) {
    res.status(500).json({ message: "Could not update alert", error: err.message });
  }
});

module.exports = router;
