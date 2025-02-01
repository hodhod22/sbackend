const User = require("../models/User");

exports.getPendingPayments = async (req, res) => {
  try {
    // Find all users with pending payments
    const users = await User.find({}).select("name email pendingPayments");

    // Extract pending payments
    const pendingPayments = users.flatMap((user) =>
      user.pendingPayments.map((payment) => ({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        ...payment.toObject(),
      }))
    );

    res.json(pendingPayments);
  } catch (error) {
    console.error("Error fetching pending payments:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
