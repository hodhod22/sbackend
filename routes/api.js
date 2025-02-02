const express = require("express");

const {
  requestPayout,
  verifyPayout,
} = require("../controllers/payoutController");
const { createPayout } = require("../controllers/stripePayoutController");
const { verifyUserPayments } = require("../controllers/paymentController");
const { getPendingPayments } = require("../controllers/adminsController");
const { getWithdrawalHistory } = require("../controllers/userController");
const router = express.Router();
// Verify user payments
router.post("/verify-payments", async (req, res) => {
  const { userId } = req.body;

  try {
    const result = await verifyUserPayments(userId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error verifying payments:", error);
    res.status(500).json({ message: "Error verifying payments", error });
  }
});
// Admin routes
router.get("/admin/pending-payments", getPendingPayments);

// User routes

router.post("/stripe/create-payout", createPayout);
router.get("/user/withdrawal-history/:userId", getWithdrawalHistory);

router.post("/request-payout", requestPayout);
router.get("/verify-payout", verifyPayout);

// Fetch payout history for a user

module.exports = router;
