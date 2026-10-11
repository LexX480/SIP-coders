const express = require("express");
const Distribution = require("../models/Distribution");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const COORD_ROLES = ["ward_committee", "ndrrma", "cluster_lead"];

// GET /api/analytics/volume-over-time -> chart card 1 on Screen 11
router.get("/volume-over-time", requireAuth, requireRole(...COORD_ROLES), async (req, res) => {
  try {
    const data = await Distribution.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$loggedAt" } },
          totalQuantity: { $sum: "$quantity" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json(data.map((d) => ({ date: d._id, totalQuantity: d.totalQuantity, count: d.count })));
  } catch (err) {
    res.status(500).json({ message: "Could not load analytics", error: err.message });
  }
});

// GET /api/analytics/by-category -> chart card 2 on Screen 11
router.get("/by-category", requireAuth, requireRole(...COORD_ROLES), async (req, res) => {
  try {
    const data = await Distribution.aggregate([
      {
        $group: {
          _id: "$resourceType",
          totalQuantity: { $sum: "$quantity" },
          count: { $sum: 1 },
        },
      },
    ]);
    res.json(data.map((d) => ({ resourceType: d._id, totalQuantity: d.totalQuantity, count: d.count })));
  } catch (err) {
    res.status(500).json({ message: "Could not load analytics", error: err.message });
  }
});

module.exports = router;
