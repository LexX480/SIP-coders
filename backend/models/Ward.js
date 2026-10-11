const mongoose = require("mongoose");

// A ward is the smallest coordination unit (matches "ward-level granularity"
// from the proposal). Each ward has a centroid point for map pins + a
// polygon-free centroid so we can do quick geospatial grouping without
// needing full boundary shapefiles for the MVP.
const wardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Ward 7"
    district: { type: String, required: true, trim: true }, // e.g. "Gorkha"
    locality: { type: String, trim: true },
    population: { type: Number, default: 0 },
    damageSeverity: {
      // 0 (none) - 5 (catastrophic). Used by the allocation scoring model.
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    location: {
      // GeoJSON Point = ward centroid, used for map pins + geo queries
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
  },
  { timestamps: true }
);

wardSchema.index({ location: "2dsphere" });
wardSchema.index({ district: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Ward", wardSchema);
