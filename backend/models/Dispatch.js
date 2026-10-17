const mongoose = require("mongoose");

const RESOURCE_TYPES = ["food", "water", "shelter", "medical", "electrical", "clothing"];

// A coordinator sending stock from a warehouse to cover a reported need.
// Creating one takes the units out of the warehouse's inventory right away
// (see InventoryTransaction reason "distributed_out"), so the same stock
// can't be promised twice, and puts a pickup task on the assigned
// responder organization's dashboard so they can send volunteers.
//
//   pending_pickup -> picked_up -> delivered
//   pending_pickup -> cancelled   (units go back into the warehouse)
const dispatchSchema = new mongoose.Schema(
  {
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", required: true },
    need: { type: mongoose.Schema.Types.ObjectId, ref: "NeedReport", required: true },

    // Destination ward, copied from the need so the pickup card can show it
    // without another lookup.
    ward: { type: mongoose.Schema.Types.ObjectId, ref: "Ward", required: true },

    resourceType: { type: String, enum: RESOURCE_TYPES, required: true },
    subCategory: { type: String, trim: true, maxlength: 60 },
    quantity: { type: Number, required: true, min: 1 },

    // The responder organization (a User with role "responder") that has to
    // collect and deliver this.
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    status: {
      type: String,
      enum: ["pending_pickup", "picked_up", "delivered", "cancelled"],
      default: "pending_pickup",
    },
    note: { type: String, trim: true, maxlength: 200 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    pickedUpAt: { type: Date },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

dispatchSchema.index({ assignedTo: 1, status: 1 });
dispatchSchema.index({ warehouse: 1, status: 1 });
dispatchSchema.index({ need: 1 });

module.exports = mongoose.model("Dispatch", dispatchSchema);