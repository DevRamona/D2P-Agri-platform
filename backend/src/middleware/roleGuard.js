const { failure } = require("../utils/response");

const roleGuard = (...allowed) => (req, res, next) => {
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json(failure("FORBIDDEN", "Insufficient role"));
  }
  return next();
};

module.exports = { roleGuard };
