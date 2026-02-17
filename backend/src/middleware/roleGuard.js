const { failure } = require("../utils/response");

const roleGuard = (...allowed) => (req, res, next) => {

  if (!req.user || !allowed.includes(req.user.role)) {
    // Try case-insensitive check
    const upperRole = req.user?.role?.toUpperCase();
    if (allowed.includes(upperRole)) {
      return next();
    }
    return res.status(403).json(failure("FORBIDDEN", `Insufficient role. Required: ${allowed}, Got: ${req.user.role}`));
  }
  return next();
};

module.exports = { roleGuard };
