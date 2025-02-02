const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const User = require("../models/User");

// Create a payout
exports.createPayout = async (req, res) => {
  const { userId, amount, currency, iban } = req.body;

  try {
    // Fetch the user from the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the currency is IRR (not supported by Stripe)
    if (currency === "IRR") {
      return res
        .status(400)
        .json({ message: "IRR payouts is not supported by Stripe" });
    }

    // Check if the user has sufficient balance
    if (user.balance[currency] < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Create a payout using Stripe
    const payout = await stripe.payouts.create({
      amount: amount * 100, // Stripe uses cents, so multiply by 100
      currency: currency.toLowerCase(),
      method: "instant", // or "standard" for slower payouts
      destination: iban,
    });

    // Update the user's balance
    user.balance[currency] -= amount;
    await user.save();

    // Add the payout to the user's withdrawal history
    user.withdrawalHistory.push({
      amount,
      iban,
      previousBalance: user.balance[currency] + amount,
      newBalance: user.balance[currency],
      status: "approved", // Assuming the payout is successful
    });
    await user.save();

    res.status(200).json({ message: "Payout successful", payout });
  } catch (error) {
    console.error("Error creating payout:", error);
    res.status(500).json({ message: "Payout failed", error: error.message });
  }
};
