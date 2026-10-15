const mongoose = require("mongoose");

const RESOURCE_TYPES = ["food", "water", "shelter", "medical", "electrical", "clothing"];

// Every change to a warehouse's stock is recorded as its own entry here -
// a ledger, not a mutable running total (same event-log style as
// Distribution/NeedReport elsewhere in this app). Current stock for a
// warehouse + resourceType is computed by summing quantityChange, which
// keeps a single source of truth and gives a full audit trail of where
// every unit came from (a confirmed donor drop-off vs. a coordinator's
// manual correction vs. stock sent out).
const inventoryTransactionSchema = new mongoose.Schema(
  {
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    resourceType: { type: String, enum: RESOURCE_TYPES, required: true },
    subCategory: { type: String, trim: true, maxlength: 60 },

    // Positive = stock added, negative = stock removed.
    quantityChange: { type: Number, required: true },

    reason: {
      type: String,
      enum: ["dropoff_confirmed", "manual_add", "manual_remove", "distributed_out"],
      required: true,
    },
    note: { type: String, trim: true, maxlength: 200 },

    relatedPledge: { type: mongoose.Schema.Types.ObjectId, ref: "DropoffPledge" },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

inventoryTransactionSchema.index({ warehouse: 1, resourceType: 1, subCategory: 1 });

module.exports = mongoose.model("InventoryTransaction", inventoryTransactionSchema);