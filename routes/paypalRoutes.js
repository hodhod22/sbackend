const express = require("express");
const {
  createOrder,
  captureOrder,
  createPaypalAccountPayout,
  createBankPayout,
  createCardPayout,
  getPayoutStatus,
} = require("../utils/paypal");
const User = require("../models/User"); // Import your User model
const { checkPendingPayouts } = require("../utils/payoutStatusChecker");
const router = express.Router();

// Create PayPal order
router.post("/create-paypal-order", async (req, res) => {
  const { amount, currency, userId } = req.body;

  try {
    const order = await createOrder(amount, currency);
    await User.findByIdAndUpdate(userId, {
      $push: {
        pendingPayments: {
          authority: order.id,
          amount,
          currency,
          status: "pending",
        },
      },
    });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Capture PayPal order
router.post("/capture-paypal-order", async (req, res) => {
  const { orderID, userId } = req.body;

  try {
    const captureData = await captureOrder(orderID);
    const payment = captureData.purchase_units[0].payments.captures[0];

    // Update user balance and payment status
    const user = await User.findById(userId);
    const currency = payment.amount.currency_code;
    const amount = parseFloat(payment.amount.value);

    user.balance[currency] += amount;
    user.pendingPayments = user.pendingPayments.map((payment) =>
      payment.authority === orderID
        ? { ...payment, status: "approved" }
        : payment
    );

    await user.save();
    res.json({ success: true, captureData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create PayPal payout (supports multiple methods)
router.post("/create-payout", async (req, res) => {
  const {
    amount,
    currency = "USD", // Default to USD if not provided
    payoutMethod,
    email,
    iban,
    cardNumber,
    recipientName,
    note,
    userId,
  } = req.body;

  try {
    // Log the incoming request
    console.log("Received payout request:", {
      amount,
      currency,
      payoutMethod,
      email: email ? "***" : undefined, // Hide full email for privacy
      iban: iban ? "***" : undefined, // Hide full IBAN for privacy
      cardNumber: cardNumber ? "***" : undefined, // Hide full card number for privacy
      recipientName,
      note,
      userId,
    });

    // Validate required fields
    if (!payoutMethod) {
      return res.status(400).json({ error: "Payout method is required" });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    // Find user and check balance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const parsedAmount = parseFloat(amount);
    if (!user.balance[currency] || user.balance[currency] < parsedAmount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    let payout;
    let payoutReference;

    // Process payout based on method
    const method = payoutMethod.toLowerCase();
    try {
      switch (method) {
        case "paypal":
          if (!email) {
            return res.status(400).json({ error: "PayPal email is required" });
          }
          // Clean and validate email
          const cleanEmail = email.trim().toLowerCase();
          if (!cleanEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({ error: "Invalid email format" });
          }

          payout = await createPaypalAccountPayout(
            cleanEmail,
            parsedAmount,
            currency,
            note
          );
          payoutReference = "PAYPAL-" + cleanEmail;
          break;

        case "bank":
          if (!iban || !recipientName) {
            return res
              .status(400)
              .json({ error: "IBAN and recipient name are required" });
          }

          const cleanIban = iban.trim().replace(/\s/g, "").toUpperCase();
          const cleanRecipientName = recipientName.trim();

          payout = await createBankPayout(
            cleanIban,
            parsedAmount,
            currency,
            cleanRecipientName,
            note
          );

          // For sandbox testing, we're using email method but storing IBAN reference
          payoutReference = payout.original_iban || cleanIban;
          break;

        case "card":
          if (!cardNumber || !recipientName) {
            return res
              .status(400)
              .json({ error: "Card number and recipient name are required" });
          }

          const cleanCardNumber = cardNumber.trim().replace(/\s/g, "");
          const cleanCardRecipientName = recipientName.trim();

          payout = await createCardPayout(
            cleanCardNumber,
            parsedAmount,
            currency,
            cleanCardRecipientName,
            note
          );

          // For sandbox testing, we're using email method but storing card reference
          payoutReference = payout.original_card_last4
            ? "CARD-" + payout.original_card_last4
            : "CARD-" + cleanCardNumber.slice(-4);
          break;

        default:
          return res
            .status(400)
            .json({ error: `Invalid payout method: ${method}` });
      }
    } catch (payoutError) {
      console.error(`${method} payout error:`, payoutError);
      return res.status(500).json({
        error: `${method} payout failed`,
        details: payoutError.message,
        debug: payoutError.details || [],
      });
    }

    // Check if payout was successful
    if (
      !payout ||
      !payout.batch_header ||
      !payout.batch_header.payout_batch_id
    ) {
      console.error("Invalid payout response:", payout);
      return res.status(500).json({
        error: "Invalid payout response from PayPal",
        details: "The payout response did not contain the expected fields",
      });
    }

    // Update user's balance and add to withdrawal history
    try {
      user.balance[currency] -= parsedAmount;

      // Create withdrawal history entry based on payout method
      const withdrawalEntry = {
        amount: parsedAmount,
        previousBalance: user.balance[currency] + parsedAmount,
        newBalance: user.balance[currency],
        description: note || `PayPal ${method} payout`,
        status: "pending",
        payoutBatchId: payout.batch_header.payout_batch_id,
        payoutMethod: method,
        recipientName: recipientName ? recipientName.trim() : undefined,
      };

      // Add method-specific fields
      switch (method) {
        case "paypal":
          withdrawalEntry.email = email.trim().toLowerCase();
          break;
        case "bank":
          withdrawalEntry.iban = payoutReference;
          break;
        case "card":
          withdrawalEntry.cardNumber = payoutReference;
          break;
      }

      user.withdrawalHistory.push(withdrawalEntry);

      await user.save();
      console.log("User balance updated successfully");
    } catch (dbError) {
      console.error("Database update error:", dbError);
      return res.status(500).json({
        error: "Failed to update user balance",
        details: dbError.message,
      });
    }

    console.log("Payout completed successfully:", {
      batchId: payout.batch_header.payout_batch_id,
      method,
      amount: parsedAmount,
      currency,
    });

    res.json(payout);
  } catch (error) {
    console.error("Payout error:", error);
    res.status(500).json({
      error: "Payout failed",
      details: error.message,
      debug: error.stack,
    });
  }
});

// Check payout status
router.get("/payout-status/:batchId", async (req, res) => {
  const { batchId } = req.params;

  try {
    const status = await getPayoutStatus(batchId);
    res.json(status);
  } catch (error) {
    console.error("Error checking payout status:", error);
    res.status(500).json({ error: error.message });
  }
});

// Manual check for all pending payout statuses
router.get("/check-pending-payouts", async (req, res) => {
  try {
    const stats = await checkPendingPayouts();
    res.json({
      success: true,
      message: "Payout status check completed",
      stats,
    });
  } catch (error) {
    console.error("Error checking pending payouts:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check pending payouts",
      message: error.message,
    });
  }
});

// Add this error handling middleware at the end of the file
router.use((err, req, res, next) => {
  console.error("Global Error Handler:", {
    message: err.message,
    stack: err.stack,
    originalError: err.originalError || null,
  });
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

module.exports = router;
