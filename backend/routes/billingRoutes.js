const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { createCheckoutSession, createPortalSession, getBillingStatus, syncCheckoutSession } = require("../controllers/billingController");

router.post("/billing/create-checkout-session", protect, createCheckoutSession);
router.post("/billing/portal", protect, createPortalSession);
router.get("/billing/status", protect, getBillingStatus);
router.post("/billing/sync-checkout-session", protect, syncCheckoutSession);

module.exports = router;
