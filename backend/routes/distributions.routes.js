const express = require("express");
const { body, validationResult } = require("express-validator");
const Distribution = require("../models/Distribution");
const { requireAuth, requireRole } = require("../middleware/auth");
const { checkForDuplication } = require("../utils/duplicationEngine");

const router = express.Router();

const RESOURCE_TYPES = ["food", "water", "shelter", "medical", "electrical", "clothing"];

router.post(
  "/",
  requireAuth,
  requireRole("responder"),
  [
    body("resourceType").isIn(RESOURCE_TYPES),
    body("subCategory").optional().isString().isLength({ max: 60 }),
    body("quantity").isInt({ min: 1 }),
    body("ward").notEmpty(),
    body("location.coordinates").isArray({ min: 2, max: 2 }),
    body("entryType").optional().isIn(["logged", "planned"]),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const distribution = await Distribution.create({
        organization: req.user.id,
        resourceType: req.body.resourceType,
        subCategory: req.body.subCategory || undefined,
        quantity: req.body.quantity,
        ward: req.body.ward,
        location: { type: "Point", coordinates: req.body.location.coordinates },
        entryType: req.body.entryType || "logged",
      });

      const dupResult = await checkForDuplication(distribution);

      const fresh = await Distribution.findById(distribution._id).populate(
        "ward",
        "name district"
      );

      res.status(201).json({ distribution: fresh, duplication: dupResult });
    } catch (err) {
      res.status(500).json({ message: "Could not log distribution", error: err.message });
    }
  }
);

router.get("/mine", requireAuth, requireRole("responder"), async (req, res) => {
  try {
    const distributions = await Distribution.find({ organization: req.user.id })
      .populate("ward", "name district")
      .sort({ loggedAt: -1 });
    res.json(distributions);
  } catch (err) {
    res.status(500).json({ message: "Could not load distributions", error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.resourceType) filter.resourceType = req.query.resourceType;
    if (req.query.ward) filter.ward = req.query.ward;

    const distributions = await Distribution.find(filter)
      .populate("ward", "name district")
      .populate("organization", "organizationName")
      .sort({ loggedAt: -1 })
      .limit(500);

    const publicSafe = distributions.map((d) => ({
      _id: d._id,
      resourceType: d.resourceType,
      subCategory: d.subCategory,
      quantity: d.quantity,
      ward: d.ward,
      organizationName: d.organization?.organizationName,
      location: d.location,
      status: d.status,
      loggedAt: d.loggedAt,
    }));

    res.json(publicSafe);
  } catch (err) {
    res.status(500).json({ message: "Could not load distributions", error: err.message });
  }
});

module.exports = router;