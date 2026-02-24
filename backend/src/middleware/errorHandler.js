const { failure } = require("../utils/response");

const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const code = err.code || "SERVER_ERROR";
  const message = err.message || "Unexpected server error";
  return res.status(status).json(failure(code, message, err.details));
};

module.exports = { errorHandler };
