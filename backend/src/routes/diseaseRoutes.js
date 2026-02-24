const express = require("express");
const { analyze, recommendations } = require("../controllers/diseaseController");
const { parseDiseaseImages } = require("../middleware/diseaseUpload");
const { createRateLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.post(
  "/analyze",
  createRateLimiter({ key: "disease-analyze", windowMs: 60_000, maxRequests: 20 }),
  parseDiseaseImages,
  analyze,
);

router.post(
  "/recommendations",
  createRateLimiter({ key: "disease-recommendations", windowMs: 60_000, maxRequests: 30 }),
  express.json({ limit: "256kb" }),
  recommendations,
);

module.exports = router;
