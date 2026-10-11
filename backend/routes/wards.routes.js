const express = require("express");
const Ward = require("../models/Ward");
const { computeWardPriorities } = require("../utils/allocationEngine");

const router = express.Router();

// GET /api/wards - used to populate map pins / dropdowns across the app
router.get("/", async (req, res) => {
  try {
    const wards = await Ward.find().sort({ district: 1, name: 1 });
    res.json(wards);
  } catch (err) {
    res.status(500).json({ message: "Could not load wards", error: err.message });
  }
});

// ---------------------------------------------------------------------
// GET /api/wards/priority  (Screen 9: Coordination Dashboard priority list)
// "priority-ranked list of wards by unmet need (from the allocation model)"
// ---------------------------------------------------------------------
router.get("/priority", async (req, res) => {
  try {
    const ranked = await computeWardPriorities();
    res.json(ranked);
  } catch (err) {
    res.status(500).json({ message: "Could not compute priorities", error: err.message });
  }
});

module.exports = router;
