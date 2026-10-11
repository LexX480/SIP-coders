const express = require("express");
const Distribution = require("../models/Distribution");
const NeedReport = require("../models/NeedReport");
const DuplicationAlert = require("../models/DuplicationAlert");
const Ward = require("../models/Ward");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// ---------------------------------------------------------------------
// GET /api/dashboard/responder  (Screen 3: three stat cards)
// "Distributions Logged," "Wards Reached," "Active Alerts"
// ---------------------------------------------------------------------
router.get("/responder", requireAuth, requireRole("responder"), async (req, res) => {
  try {
    const orgDistributions = await Distribution.find({ organization: req.user.id });
    const distributionsLogged = orgDistributions.length;
    const wardsReached = new Set(orgDistributions.map((d) => d.ward.toString())).size;
    const activeAlerts = orgDistributions.filter((d) => d.status === "possible_duplicate").length;

    res.json({ distributionsLogged, wardsReached, activeAlerts });
  } catch (err) {
    res.status(500).json({ message: "Could not load dashboard", error: err.message });
  }
});

// ---------------------------------------------------------------------
// GET /api/dashboard/coordination  (Screen 9: three stat cards)
// "Unmet Needs," "Active Duplication Alerts," "Wards Covered"
// ---------------------------------------------------------------------
router.get(
  "/coordination",
  requireAuth,
  requireRole("ward_committee", "ndrrma", "cluster_lead"),
  async (req, res) => {
    try {
      const unmetNeeds = await NeedReport.countDocuments({ status: "open" });
      const activeDuplicationAlerts = await DuplicationAlert.countDocuments({ status: "pending" });
      const wardsCoveredAgg = await Distribution.distinct("ward");
      const wardsCovered = wardsCoveredAgg.length;
      const totalWards = await Ward.countDocuments();

      res.json({ unmetNeeds, activeDuplicationAlerts, wardsCovered, totalWards });
    } catch (err) {
      res.status(500).json({ message: "Could not load dashboard", error: err.message });
    }
  }
);

module.exports = router;
