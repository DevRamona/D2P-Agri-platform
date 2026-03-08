const express = require("express");

const router = express.Router();

router.get("/", (_req, res) => {
  res.status(200).json({
    name: "D2P Agri Platform API",
    status: "ok",
    docs: "Documentation endpoint placeholder",
  });
});

module.exports = router;
