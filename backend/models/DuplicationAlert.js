const mongoose = require("mongoose");

const RESOURCE_TYPES = ["food", "water", "shelter", "medical", "electrical", "clothing"];

// Maps to Screen 10 (Duplication Alert Detail): "3 organizations reported
// delivering tents here" + Confirm Duplicate / Dismiss Alert actions.
//
// Two different engines create/update these:
//  - utils/duplicationEngine.js (kind: "distribution") - 2+ distinct
//    organizations logging the same resourceType in the same ward within a
//    rolling time window.
//  - utils/needDuplicationEngine.js (kind: "need") - 2+ open need reports
//    for the same resourceType in the same ward within a rolling time
//    window (e.g. several neighbors, or several members of the same
//    family, each separately reporting what is really one household's
//    need).
const duplicationAlertSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["distribution", "need"],
      default: "distribution",
    },

    ward: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ward",
      required: true,
    },

    // Widened from the original 4 values to match Distribution's and
    // NeedReport's full resourceType enum - electrical/clothing alerts
    // were failing to save against the old, narrower enum here.
    resourceType: {
      type: String,
      enum: RESOURCE_TYPES,
      required: true,
    },

    // All distribution logs clustered together as likely duplicates.
    // Populated only for kind: "distribution".
    distributions: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Distribution" },
    ],
    organizationCount: { type: Number },

    // All need reports clustered together as likely duplicates.
    // Populated only for kind: "need".
    needs: [{ type: mongoose.Schema.Types.ObjectId, ref: "NeedReport" }],
    reportCount: { type: Number },

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

duplicationAlertSchema.index({ kind: 1, ward: 1, resourceType: 1, status: 1 });

module.exports = mongoose.model("DuplicationAlert", duplicationAlertSchema);