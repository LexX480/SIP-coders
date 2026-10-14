const express = require("express");
const DuplicationAlert = require("../models/DuplicationAlert");
const Distribution = require("../models/Distribution");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const COORDINATOR_ROLES = ["ward_committee", "ndrrma", "cluster_lead"];

// ---------------------------------------------------------------------
// GET /api/alerts - list, optionally filtered by status. Covers both
// kind: "distribution" and kind: "need" alerts on the same list.
// ---------------------------------------------------------------------
router.get("/", requireAuth, requireRole(...COORDINATOR_ROLES), async (req, res) => {
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
// GET /api/alerts/:id - detail view. Populates whichever of
// distributions/needs applies to this alert's kind.
// ---------------------------------------------------------------------
router.get("/:id", requireAuth, requireRole(...COORDINATOR_ROLES), async (req, res) => {
  try {
    const alert = await DuplicationAlert.findById(req.params.id)
      .populate("ward", "name district")
      .populate({
        path: "distributions",
        populate: [
          { path: "organization", select: "organizationName" },
          { path: "ward", select: "name" },
        ],
      })
      .populate({
        path: "needs",
        populate: { path: "ward", select: "name" },
      });

    if (!alert) return res.status(404).json({ message: "Alert not found" });
    res.json(alert);
  } catch (err) {
    res.status(500).json({ message: "Could not load alert", error: err.message });
  }
});

router.post("/:id/confirm", requireAuth, requireRole(...COORDINATOR_ROLES), async (req, res) => {
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

router.post("/:id/dismiss", requireAuth, requireRole(...COORDINATOR_ROLES), async (req, res) => {
  try {
    const alert = await DuplicationAlert.findByIdAndUpdate(
      req.params.id,
      { status: "dismissed", reviewedBy: req.user.id, reviewedAt: new Date() },
      { new: true }
    );
    if (!alert) return res.status(404).json({ message: "Alert not found" });

    // Dismissing a distribution-kind alert clears the duplicate flag off
    // the underlying distributions. Need-kind alerts never mutate the
    // underlying NeedReport documents, so there's nothing to clear there.
    if (alert.kind === "distribution" && alert.distributions.length) {
      await Distribution.updateMany(
        { _id: { $in: alert.distributions } },
        { $set: { status: "confirmed" }, $unset: { duplicateNote: "" } }
      );
    }

    res.json(alert);
  } catch (err) {
    res.status(500).json({ message: "Could not update alert", error: err.message });
  }
});

module.exports = router;