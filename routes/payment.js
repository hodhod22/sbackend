const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const User = require("../models/User");
const ZarinpalCheckout = require("zarinpal-checkout");
const authenticate = require("../middleware/authenticate");
const zarinpal = ZarinpalCheckout.create(
  "0e6a5ae7-897a-47f1-8bdc-f35405bdfb7f",
  true
);
// Deposit endpoint
router.post("/deposit", authenticate, async (req, res) => {
  const { amount, currency } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to smallest currency unit
      currency,
      confirm: true,
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({ error: "Failed to create payment intent." });
  }
});

// Confirm deposit and update user balance
router.post("/confirm-deposit", authenticate, async (req, res) => {
  const { amount, currency } = req.body;

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.balance[currency] = (user.balance[currency] || 0) + amount;
    await user.save();

    res.json({ message: "Deposit successful", balance: user.balance });
  } catch (error) {
    console.error("Error updating user balance:", error);
    res.status(500).json({ error: "Failed to update user balance." });
  }
});
//Zarinpal
router.post("/zarinpal", async (req, res) => {
  const { amount, description, callbackUrl } = req.body;

  try {
    const response = await zarinpal.PaymentRequest({
      Amount: amount, // Amount in Toman (not Rial)
      CallbackURL: callbackUrl,
      Description: description,
    });

    if (response.status === 100) {
      res.json({ url: response.url }); // Redirect the user to this URL
    } else {
      res.status(400).json({ error: "Payment request failed." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Callback endpoint to handle Zarinpal response
router.post("zarinpal-callback", async (req, res) => {
  const { Authority, Status, userId, currency } = req.body; // Access the request body
 
  if (!Authority || !Status || !userId || !currency) {
    return res.status(400).json({ message: "Missing required parameters" });
  }
  try {
    // Verify payment with Zarinpal
    const verificationResponse = await zarinpal.PaymentVerification({
      Amount: 10000, // Let Zarinpal handle the amount verification
      Authority,
    });

    if (verificationResponse.status === 100) {
      const verifiedAmount = verificationResponse.amount; // Verified amount
      const refId = verificationResponse.RefID; // Reference ID

      // Update user's balance in MongoDB
      await User.findByIdAndUpdate(
        userId,
        { $inc: { [`balance.${currency}`]: parseFloat(verifiedAmount) } },
        { new: true }
      );

      return res.status(200).json({
        message: "Payment verified successfully",
        verifiedAmount,
        refId,
      });
    } else {
      return res.status(400).json({
        message: "Payment verification failed.",
        status: verificationResponse.status,
      });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    return res
      .status(500)
      .json({ message: "Server error during payment verification." });
  }
});
//zarinpall-callback get method
 router.get("/zarinpal/callback", async (req, res) => {
   const { Authority, Status } = req.query;

   if (Status === "OK") {
     try {
       const amount = 10000; // Replace with the actual amount you used in the original payment request

       const response = await zarinpal.PaymentVerification({
         Amount: amount, // Amount in Toman
         Authority: Authority,
       });

       if (response.status === 100) {
         res.json({
           message: "Payment was successful!",
           refId: response.RefID,
           status: response.status,
           amount: amount,
         });
        
       } else {
         res.status(400).json({
           message: "Payment verification failed.",
           status: response.status,
         });
       }
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   } else {
     res.status(400).json({ message: "Payment was canceled by the user." });
   }
 });
module.exports = router;

