const jwt = require("jsonwebtoken");

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

// Verifies the token and attaches { id, role } to req.user
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing or invalid Authorization header" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Like requireAuth, but never blocks the request. If a valid token is
// present, req.user is set ({ id, role }) same as requireAuth. If there's
// no token, or it's invalid/expired, req.user is just left undefined and
// the request continues as an anonymous/public request. Use this on routes
// that must stay public but want to return extra data to logged-in users
// (e.g. GET /api/needs showing reporter contact info only to authenticated
// responders/coordinators).
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return next();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role }
  } catch (err) {
    // Invalid/expired token on a public route - just treat as anonymous
    // rather than failing the request.
  }
  next();
}

// Restricts a route to specific roles, e.g. requireRole('ward_committee','ndrrma','cluster_lead')
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Not authorized for this action" });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, optionalAuth, requireRole };