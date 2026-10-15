const mongoose = require("mongoose");

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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

warehouseSchema.index({ location: "2dsphere" });
warehouseSchema.index({ ward: 1 });

module.exports = mongoose.model("Warehouse", warehouseSchema);