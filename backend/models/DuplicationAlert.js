const mongoose = require("mongoose");

// Maps to Screen 10 (Duplication Alert Detail): "3 organizations reported
// delivering tents here" + Confirm Duplicate / Dismiss Alert actions.
// Created/updated automatically by utils/duplicationEngine.js whenever a
// new distribution is logged.
const duplicationAlertSchema = new mongoose.Schema(
  {
    ward: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ward",
      required: true,
    },
    resourceType: {
      type: String,
      enum: ["food", "water", "shelter", "medical"],
      required: true,
    },

    // All distribution logs that were clustered together as likely
    // duplicates (same ward + resource type + overlapping time window)
    distributions: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Distribution" },
    ],

    organizationCount: { type: Number, required: true },

    status: {
      type: String,
      enum: ["pending", "confirmed", "dismissed"],
      default: "pending",
    },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

duplicationAlertSchema.index({ ward: 1, resourceType: 1, status: 1 });

module.exports = mongoose.model("DuplicationAlert", duplicationAlertSchema);
