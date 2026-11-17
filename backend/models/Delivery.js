const mongoose = require("mongoose");

const RESOURCE_TYPES = ["food", "water", "shelter", "medical", "electrical", "clothing"];

// A relief delivery that has been sent out but hasn't reached its location
// yet. It is NOT a public distribution record: the responder starts it here,
// and only when they press "Delivered" does the app log the real
// Distribution (public transparency feed, analytics, duplicate check).
//
//   in_transit -> delivered
//   in_transit -> cancelled   (it never went out / turned back)
const deliverySchema = new mongoose.Schema(
  {
    // The responder organization (User) that is carrying this out.
    responder: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    resourceType: { type: String, enum: RESOURCE_TYPES, required: true },
    subCategory: { type: String, trim: true, maxlength: 60 },
    quantity: { type: Number, required: true, min: 1 },

    ward: { type: mongoose.Schema.Types.ObjectId, ref: "Ward", required: true },
    // [lng, lat] of the drop-off point, same shape the distribution log uses.
    location: {
      coordinates: { type: [Number], required: true },
    },

    // Set when this delivery came from claiming a community need, so that
    // need can be closed out once the delivery actually arrives.
    need: { type: mongoose.Schema.Types.ObjectId, ref: "NeedReport" },

    status: { type: String, enum: ["in_transit", "delivered", "cancelled"], default: "in_transit" },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

deliverySchema.index({ responder: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Delivery", deliverySchema);