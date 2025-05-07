const express = require("express");
const axios = require("axios");
const User = require("../models/User");
const router = express.Router();

const ZARINPAL_REQUEST_URL =
  "https://sandbox.zarinpal.com/pg/v4/payment/request.json";
const ZARINPAL_VERIFY_URL =
  "https://sandbox.zarinpal.com/pg/v4/payment/verify.json";
const ZARINPAL_STARTPAY_URL = "https://sandbox.zarinpal.com/pg/StartPay/";

// Automatic Payout Route
router.post("/payout", async (req, res) => {
  try {
    const { userId, amount, iban, phone, email, description } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.balance.IRR < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Call Zarinpal API for payout request
    const payoutResponse = await axios.post(ZARINPAL_REQUEST_URL, {
      merchant_id: "0e6a5ae7-897a-47f1-8bdc-f35405bdfb7f",
      amount,
      description,
      callback_url: "https://yourwebsite.com/api/payout/verify",
    });

    if (payoutResponse.data.data && payoutResponse.data.data.authority) {
      const authority = payoutResponse.data.data.authority;

      // Deduct balance and save transaction
      const newBalance = user.balance.IRR - amount;
      user.balance.IRR = newBalance;

      const withdrawal = {
        amount,
        iban,
        previousBalance: user.balance.IRR + amount,
        newBalance,
        phone,
        email,
        description,
        status: "pending",
      };

      user.withdrawalHistory.push(withdrawal);
      await user.save();

      return res.json({
        message: "Payout request submitted",
        payment_url: `${ZARINPAL_STARTPAY_URL}${authority}`,
      });
    } else {
      return res.status(400).json({ message: "Payout request failed" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Payout Verification Route
router.post("/payout/verify", async (req, res) => {
  try {
    const { authority, status } = req.body;
    if (status !== "OK") {
      return res.status(400).json({ message: "Transaction failed" });
    }

    const verificationResponse = await axios.post(ZARINPAL_VERIFY_URL, {
      merchant_id: "YOUR_MERCHANT_ID",
      authority,
    });

    if (verificationResponse.data.data.code === 100) {
      const user = await User.findOne({
        "withdrawalHistory.authority": authority,
      });
      if (!user) return res.status(404).json({ message: "User not found" });

      user.withdrawalHistory = user.withdrawalHistory.map((w) =>
        w.authority === authority ? { ...w, status: "approved" } : w
      );
      await user.save();

      return res.json({ message: "Payout successful" });
    } else {
      return res.status(400).json({ message: "Payout verification failed" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
