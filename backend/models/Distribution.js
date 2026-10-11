const mongoose = require("mongoose");

const distributionSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Broad category. Expanded from the original 4 (food/water/shelter/
    // medical) to also cover electrical & lighting items and clothing.
    resourceType: {
      type: String,
      enum: ["food", "water", "shelter", "medical", "electrical", "clothing"],
      required: true,
    },

    // Optional finer-grained item within resourceType (e.g. "batteries"
    // under "electrical", "infant_nutrition" under "food"). Free string
    // rather than its own enum so the frontend's subcategory lists can
    // evolve without a migration; length-capped in the route layer instead.
    subCategory: { type: String, trim: true },

    quantity: { type: Number, required: true, min: 1 },

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

    status: {
      type: String,
      enum: ["confirmed", "possible_duplicate"],
      default: "confirmed",
    },

    duplicateNote: { type: String },

    entryType: {
      type: String,
      enum: ["logged", "planned"],
      default: "logged",
    },

    loggedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

distributionSchema.index({ location: "2dsphere" });
distributionSchema.index({ ward: 1, resourceType: 1, loggedAt: -1 });

module.exports = mongoose.model("Distribution", distributionSchema);