// routes/account.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const User = require("../models/User"); // Adjust the path to your User model

const EXCHANGE_API_URL =
  "https://v6.exchangerate-api.com/v6/66ea934339525ffdefdf2378/latest";

router.post("/convert", async (req, res) => {
  const { userId, fromCurrency, toCurrency, amount } = req.body;
  
  try {
    // Fetch exchange rates
    const { data } = await axios.get(`${EXCHANGE_API_URL}/${fromCurrency}`);
    if (!data || data.result !== "success") {
      return res.status(400).json({ error: "Failed to fetch exchange rates." });
    }
    const rates = data.conversion_rates;

    if (!rates[toCurrency]) {
      return res
        .status(400)
        .json({ error: "Invalid target currency provided." });
    }

    // Calculate converted amount
    const convertedAmount = amount * rates[toCurrency];

    // Update user's balance
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (user.balance[fromCurrency] < amount) {
      return res.status(400).json({ error: "Insufficient balance." });
    }

    user.balance[fromCurrency] -= amount; // Deduct amount in the source currency
    user.balance[toCurrency] += convertedAmount; // Add converted amount to the target currency

    await user.save();

    res.json({
      message: "Currency converted successfully.",
      balance: user.balance,
    });
  } catch (error) {
    console.error("Currency conversion error:", error.message);
    res.status(500).json({ error: "Failed to convert currency." });
  }
});

module.exports = router;
