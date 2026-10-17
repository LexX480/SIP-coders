const mongoose = require("mongoose");

// One entry per weekday. `day` follows JS getDay(): 0 = Sunday ... 6 = Saturday.
// Times are plain "HH:MM" strings in Nepal local time (24-hour), so there's
// no timezone conversion to get wrong when they're shown back to donors.
const hoursEntrySchema = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true },
    closed: { type: Boolean, default: false },
    open: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    close: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  { _id: false }
);

// A physical drop-off/storage point where anyone can bring relief
// materials in person. Coordinators (ward_committee/ndrrma/cluster_lead)
// create and manage these; the exact map point + human-readable address
// are what the public Drop Off Materials form shows someone once they've
// pledged a donation, so they know where to physically go.
const warehouseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    ward: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ward",
      required: true,
    },
    address: { type: String, required: true, trim: true, maxlength: 200 },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        // [longitude, latitude]
        type: [Number],
        required: true,
      },
    },
    contactPhone: { type: String, trim: true, maxlength: 20 },

    // Max total units this storage unit can hold. Optional - when unset the
    // warehouse is treated as unlimited. Current stock is never stored here;
    // it's computed from the InventoryTransaction ledger.
    capacity: { type: Number, min: 1 },

    // Empty array = hours not set (shown as nothing, treated as always
    // accepting). Otherwise exactly one entry per weekday.
    openingHours: { type: [hoursEntrySchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

warehouseSchema.index({ location: "2dsphere" });
warehouseSchema.index({ ward: 1 });

module.exports = mongoose.model("Warehouse", warehouseSchema);