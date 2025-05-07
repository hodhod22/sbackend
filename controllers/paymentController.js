// controllers/paymentController.js
const User = require("../models/User");
const axios = require("axios");
// controllers/paymentController.js


exports.verifyUserPayments = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    for (const payment of user.pendingPayments) {
      if (payment.status === "pending") {
        const verifyResponse = await axios.post(
          "https://sandbox.zarinpal.com/pg/v4/payment/verify.json",
          {
            merchant_id: process.env.ZARINPAL_MERCHANT_ID,
            authority: payment.authority,
            amount: payment.amount,
          }
        );

        const { code, ref_id } = verifyResponse.data.data;

        if (code === 100) {
          // Payment was successful
          payment.status = "approved";
          user.balance.IRR -= payment.amount;

          // Add to withdrawal history
          user.withdrawalHistory.push({
            amount: payment.amount,
            iban: "user_iban", // Replace with actual IBAN
            previousBalance: user.balance.IRR + payment.amount,
            newBalance: user.balance.IRR,
            phone: user.phone,
            email: user.email,
            description: "Withdrawal via Zarinpal",
            status: "approved",
          });
        } else {
          // Payment failed
          payment.status = "rejected";
        }

        await user.save();
      }
    }

    return { message: "Payments verified successfully", user };
  } catch (error) {
    console.error("Error verifying user payments:", error);
    throw error; // Re-throw the error for the caller to handle
  }
};

