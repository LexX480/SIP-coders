const mongoose = require("mongoose");

// Maps to Screen 6 (Report a Need): resource type + optional subcategory +
// urgency pill + map pin. Reporter now gives their name and phone number so
// responders/coordinators know who to follow up with - these are required,
// but only ever returned to authenticated responder/coordinator requests
// (see GET / below), never on the public transparency feed.
const needReportSchema = new mongoose.Schema(
  {
    resourceType: {
      type: String,
      enum: ["food", "water", "shelter", "medical", "electrical", "clothing"],
      required: true,
    },

    // Same optional fine-grained item as Distribution.subCategory, kept as
    // a free string for the same reason.
    subCategory: { type: String, trim: true },

    // How much the reporter says they need. Pre-fills Distribution Volume
    // when a responder claims this need and logs relief against it - still
    // editable there, this is just a starting estimate from the ground.
    quantityNeeded: { type: Number, required: true, min: 1 },

    urgency: {
      type: String,
      enum: ["low", "medium", "urgent"],
      required: true,
    },

    ward: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ward",
      required: true,
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: { type: [Number], required: true },
    },

    reporterName: { type: String, required: true, trim: true },
    reporterPhone: { type: String, required: true, trim: true },

    // "open" -> "claimed" (a responder has picked this up) -> "addressed"
    // (relief has actually been logged against it).
    status: {
      type: String,
      enum: ["open", "claimed", "addressed"],
      default: "open",
    },

    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    claimedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

needReportSchema.index({ location: "2dsphere" });
needReportSchema.index({ ward: 1, status: 1 });

module.exports = mongoose.model("NeedReport", needReportSchema);