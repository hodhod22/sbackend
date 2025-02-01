// routes/account.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/authenticate");

router.get("/balance/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ balance: user.balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transfer Money Route
router.post("/transfer", async (req, res) => {
  try {
    const { senderId, receiverAccountNumber, amount, currency } = req.body;

    // Find sender and receiver
    const sender = await User.findById(senderId);
    if (!sender) return res.status(404).json({ message: "Sender not found" });

    const receiver = await User.findOne({
      accountNumber: receiverAccountNumber,
    });
    if (!receiver)
      return res.status(404).json({ message: "Receiver not found" });

    // Prevent self-transfer
    if (sender.accountNumber === receiverAccountNumber) {
      return res
        .status(400)
        .json({ message: "You cannot send money to yourself." });
    }

    // Check if sender has enough balance
    if (!sender.balance[currency] || sender.balance[currency] < amount) {
      return res.status(400).json({ message: "Insufficient balance." });
    }

    // Transfer money
    sender.balance[currency] -= amount;
    receiver.balance[currency] = (receiver.balance[currency] || 0) + amount;

    await sender.save();
    await receiver.save();

    res.json({ message: "Transfer successful", amount, currency });
  } catch (error) {
    console.error("Money Transfer Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin: Get all users (alternative route under /accounts for separation)
router.get("/all-users", async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
