const { failure } = require("../utils/response");

const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || "Unexpected server error";
  return res.status(status).json(failure("SERVER_ERROR", message));
};

module.exports = { errorHandler };
