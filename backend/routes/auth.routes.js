const express = require("express");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const { signToken } = require("../middleware/auth");

const router = express.Router();

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------
// Screen 2: Responder login/signup
// Phone/Email toggle (one method at a time) + organization name + password
// ---------------------------------------------------------------------
router.post(
  "/responder/register",
  [
    body("organizationName").trim().notEmpty(),
    body("loginMethod").isIn(["phone", "email"]),
    body("password").isLength({ min: 6 }),
    body("phone").if(body("loginMethod").equals("phone")).notEmpty(),
    body("email").if(body("loginMethod").equals("email")).isEmail(),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    const { organizationName, loginMethod, phone, email, password } = req.body;

    try {
      const existing = await User.findOne(
        loginMethod === "phone" ? { phone } : { email }
      );
      if (existing) {
        return res.status(409).json({ message: "Account already exists" });
      }

      const user = new User({
        role: "responder",
        organizationName,
        loginMethod,
        phone: loginMethod === "phone" ? phone : undefined,
        email: loginMethod === "email" ? email : undefined,
      });
      await user.setPassword(password);
      await user.save();

      const token = signToken(user);
      res.status(201).json({ token, user: user.toSafeJSON() });
    } catch (err) {
      res.status(500).json({ message: "Registration failed", error: err.message });
    }
  }
);

router.post(
  "/responder/login",
  [
    body("loginMethod").isIn(["phone", "email"]),
    body("password").notEmpty(),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;
    const { loginMethod, phone, email, password } = req.body;

    try {
      const user = await User.findOne({
        role: "responder",
        ...(loginMethod === "phone" ? { phone } : { email }),
      });
      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = signToken(user);
      res.json({ token, user: user.toSafeJSON() });
    } catch (err) {
      res.status(500).json({ message: "Login failed", error: err.message });
    }
  }
);

// ---------------------------------------------------------------------
// Screen 8: Coordination login
// Role dropdown (Ward Disaster Committee / NDRRMA / Cluster Lead) + one field
// ---------------------------------------------------------------------
router.post(
  "/coordination/login",
  [
    body("role").isIn(["ward_committee", "ndrrma", "cluster_lead"]),
    body("email").isEmail(),
    body("password").notEmpty(),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;
    const { role, email, password } = req.body;

    try {
      const user = await User.findOne({ role, email });
      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = signToken(user);
      res.json({ token, user: user.toSafeJSON() });
    } catch (err) {
      res.status(500).json({ message: "Login failed", error: err.message });
    }
  }
);

// Convenience endpoint the seed script also uses to create a coordination
// account (no public "sign up" screen for these roles per the prototype).
router.post(
  "/coordination/register",
  [
    body("role").isIn(["ward_committee", "ndrrma", "cluster_lead"]),
    body("fullName").trim().notEmpty(),
    body("email").isEmail(),
    body("password").isLength({ min: 6 }),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;
    const { role, fullName, email, password } = req.body;

    try {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({ message: "Account already exists" });
      }
      const user = new User({ role, fullName, email, verified: true });
      await user.setPassword(password);
      await user.save();

      const token = signToken(user);
      res.status(201).json({ token, user: user.toSafeJSON() });
    } catch (err) {
      res.status(500).json({ message: "Registration failed", error: err.message });
    }
  }
);

module.exports = router;
