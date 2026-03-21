const express = require("express");
const swaggerUi = require("swagger-ui-express");
const { buildOpenApiSpec } = require("../docs/openapi");

const router = express.Router();

const getServerUrl = (req) => {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : String(forwardedProto || req.protocol || "http").split(",")[0].trim();
  const host = req.get("host") || `localhost:${process.env.PORT || 4000}`;
  return `${protocol}://${host}`;
};

router.get("/openapi.json", (req, res) => {
  res.status(200).json(
    buildOpenApiSpec({
      serverUrl: getServerUrl(req),
    }),
  );
});

router.use("/", swaggerUi.serve);

router.get(
  "/",
  swaggerUi.setup(null, {
    customSiteTitle: "D2P Agri Backend API Docs",
    explorer: true,
    swaggerOptions: {
      url: "/docs/openapi.json",
      persistAuthorization: true,
    },
  }),
);

module.exports = router;
