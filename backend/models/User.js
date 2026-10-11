const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Single User model covers both sides of the prototype:
//  - "responder"  -> vermilion accent screens (org registry + logging)
//  - coordination roles ("ward_committee" | "ndrrma" | "cluster_lead")
//    -> indigo accent screens (oversight console)
const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["responder", "ward_committee", "ndrrma", "cluster_lead"],
      required: true,
    },

    // --- Responder / signup fields (screen 2: Responder login/signup) ---
    organizationName: { type: String, trim: true }, // required if role === 'responder'
    loginMethod: { type: String, enum: ["phone", "email"] },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },

    // --- Coordination login fields (screen 8) ---
    fullName: { type: String, trim: true },

    passwordHash: { type: String, required: true },

    // Verification workflow (Section 7 of the proposal: org verification,
    // kept lightweight so small local/grassroots groups aren't excluded)
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { sparse: true, unique: true });
userSchema.index({ phone: 1 }, { sparse: true, unique: true });

userSchema.methods.setPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(plainPassword, salt);
};

userSchema.methods.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
