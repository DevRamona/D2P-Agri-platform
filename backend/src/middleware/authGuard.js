const { failure } = require("../utils/response");
const { verifyAccessToken } = require("../utils/token");

const authGuard = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json(failure("UNAUTHORIZED", "Missing access token"));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch (error) {
    return res.status(401).json(failure("UNAUTHORIZED", "Invalid or expired access token"));
  }
};

module.exports = { authGuard };
