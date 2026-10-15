const mongoose = require("mongoose");

const RESOURCE_TYPES = ["food", "water", "shelter", "medical", "electrical", "clothing"];

// A public "I'm bringing X to a warehouse" submission - anyone can create
// one, no login required (same spirit as NeedReport). It starts as
// "pending" and only becomes real tracked stock once a coordinator
// physically receives it and confirms via PATCH /:id/confirm, which is
// what actually writes an InventoryTransaction. Confirming (or cancelling)
// never deletes the pledge - it stays as a record of what was promised vs.
// what actually showed up.
const dropoffPledgeSchema = new mongoose.Schema(
  {
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    resourceType: { type: String, enum: RESOURCE_TYPES, required: true },
    subCategory: { type: String, trim: true, maxlength: 60 },
    quantity: { type: Number, required: true, min: 1 },

    donorName: { type: String, required: true, trim: true, maxlength: 80 },
    donorPhone: { type: String, required: true, trim: true, maxlength: 20 },

    status: {
      type: String,
      enum: ["pending", "received", "cancelled"],
      default: "pending",
    },

    // Filled in only once a coordinator confirms - the amount actually
    // counted on arrival, which may differ from what was pledged.
    confirmedQuantity: { type: Number },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    confirmedAt: { type: Date },
    note: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

dropoffPledgeSchema.index({ warehouse: 1, status: 1 });

module.exports = mongoose.model("DropoffPledge", dropoffPledgeSchema);