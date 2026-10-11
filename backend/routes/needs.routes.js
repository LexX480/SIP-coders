const express = require("express");
const { body, validationResult } = require("express-validator");
const NeedReport = require("../models/NeedReport");
const { optionalAuth, requireAuth } = require("../middleware/auth");

const router = express.Router();

const RESOURCE_TYPES = ["food", "water", "shelter", "medical", "electrical", "clothing"];

// ---------------------------------------------------------------------
// POST /api/needs  (Screen 6: Report a Need)
// Public - anyone (ward rep, volunteer, citizen) can submit, no login wall.
// Reporter's name + phone are now required so responders/coordinators know
// who to follow up with.
// ---------------------------------------------------------------------
router.post(
  "/",
  [
    body("resourceType").isIn(RESOURCE_TYPES),
    body("subCategory").optional().isString().isLength({ max: 60 }),
    body("quantityNeeded").isFloat({ min: 1 }).withMessage("Enter how many units are needed"),
    body("urgency").isIn(["low", "medium", "urgent"]),
    body("ward").notEmpty(),
    body("location.coordinates").isArray({ min: 2, max: 2 }),
    body("reporterName").trim().notEmpty().withMessage("Your name is required").isLength({ max: 80 }),
    body("reporterPhone").trim().notEmpty().withMessage("Your phone number is required").isLength({ max: 20 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const report = await NeedReport.create({
        resourceType: req.body.resourceType,
        subCategory: req.body.subCategory || undefined,
        quantityNeeded: req.body.quantityNeeded,
        urgency: req.body.urgency,
        ward: req.body.ward,
        location: { type: "Point", coordinates: req.body.location.coordinates },
        reporterName: req.body.reporterName,
        reporterPhone: req.body.reporterPhone,
      });
      res.status(201).json(report);
    } catch (err) {
      res.status(500).json({ message: "Could not submit report", error: err.message });
    }
  }
);

// ---------------------------------------------------------------------
// GET /api/needs - used by the coordination dashboard, responder dashboard,
// the allocation engine, and the public transparency page.
//
// `optionalAuth` decodes a token if one is present but never rejects the
// request, so this route stays public. Reporter name/phone are only
// included when the request is authenticated (a logged-in responder or
// ward coordinator) - anonymous/public callers (e.g. the public
// transparency page) never receive reporter identity.
// ---------------------------------------------------------------------
router.get("/", optionalAuth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.ward) filter.ward = req.query.ward;
    if (req.query.status) filter.status = req.query.status;

    let query = NeedReport.find(filter).populate("ward", "name district locality").sort({ createdAt: -1 });
    if (req.user) {
      query = query.populate("claimedBy", "name");
    } else {
      query = query.select("-reporterName -reporterPhone");
    }

    const reports = await query;
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: "Could not load needs", error: err.message });
  }
});

// ---------------------------------------------------------------------
// POST /api/needs/:id/claim - a logged-in responder/coordinator picks up
// an open need to handle themself. Only one person can hold a claim at a
// time; claiming an already-claimed need is rejected (409) rather than
// silently stealing it, so two responders don't both show up for the
// same report.
// ---------------------------------------------------------------------
router.post("/:id/claim", requireAuth, async (req, res) => {
  try {
    const report = await NeedReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Need report not found" });

    if (report.status === "claimed" && String(report.claimedBy) !== String(req.user.id)) {
      return res.status(409).json({ message: "Someone else is already handling this need" });
    }

    report.status = "claimed";
    report.claimedBy = req.user.id;
    report.claimedAt = new Date();
    await report.save();

    const populated = await report.populate([
      { path: "ward", select: "name district locality" },
      { path: "claimedBy", select: "name" },
    ]);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: "Could not claim this need", error: err.message });
  }
});

// ---------------------------------------------------------------------
// POST /api/needs/:id/unclaim - release a need back to "open", e.g. if a
// responder can no longer follow through. Only the person who claimed it
// (or a ward coordinator) can release it.
// ---------------------------------------------------------------------
router.post("/:id/unclaim", requireAuth, async (req, res) => {
  try {
    const report = await NeedReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Need report not found" });

    const isOwner = String(report.claimedBy) === String(req.user.id);
    const isCoordinator = ["ward_committee", "ndrrma", "cluster_lead"].includes(req.user.role);
    if (report.status === "claimed" && !isOwner && !isCoordinator) {
      return res.status(403).json({ message: "Only the responder handling this (or a coordinator) can release it" });
    }

    report.status = "open";
    report.claimedBy = null;
    report.claimedAt = null;
    await report.save();

    const populated = await report.populate({ path: "ward", select: "name district locality" });
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: "Could not release this need", error: err.message });
  }
});
// ---------------------------------------------------------------------
// PATCH /api/needs/:id/addressed - called right after a responder submits
// a Distribution that was logged against a claimed need, closing the loop:
// the need stops showing up as open/claimed anywhere it's listed.
// ---------------------------------------------------------------------
router.patch("/:id/addressed", requireAuth, async (req, res) => {
  try {
    const report = await NeedReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Need report not found" });

    report.status = "addressed";
    await report.save();

    const populated = await report.populate({ path: "ward", select: "name district locality" });
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: "Could not update this need", error: err.message });
  }
});

module.exports = router;