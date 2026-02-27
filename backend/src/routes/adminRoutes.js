const express = require("express");
const { authGuard } = require("../middleware/authGuard");
const { roleGuard } = require("../middleware/roleGuard");
const {
  getAdminOverview,
  getAdminEscrowAudit,
  getAdminHubDisputes,
  releaseAdminBatchPayouts,
  createAdminDispute,
  reviewAdminDispute,
} = require("../controllers/adminController");

const router = express.Router();

router.use(authGuard);
router.use(roleGuard("ADMIN"));

router.get("/overview", getAdminOverview);
router.get("/escrow-audit", getAdminEscrowAudit);
router.post("/escrow-audit/release-batch-payouts", releaseAdminBatchPayouts);
router.get("/hubs-disputes", getAdminHubDisputes);
router.post("/disputes", createAdminDispute);
router.patch("/disputes/:id/review", reviewAdminDispute);

module.exports = router;
