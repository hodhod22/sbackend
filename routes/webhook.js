// routes/webhook.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const axios = require("axios");
const verifyUserPayments = require("../controllers/paymentController");
console.log(verifyUserPayments); // Should log the function
// ZarinPal Webhook Route
router.post("/zarinpal-webhook", async (req, res) => {
  const { Authority, Status } = req.body;

  try {
    // Find the user with the pending payment
    const user = await User.findOne({ "pendingPayments.authority": Authority });
    if (!user) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Verify the payment using the refactored function
    await verifyUserPayments(user._id);

    res.status(200).json({ message: "Payment status updated" });
  } catch (error) {
    console.error("Error processing ZarinPal webhook:", error);
    res.status(500).json({ message: "Error processing payment", error });
  }
});

module.exports = router;
