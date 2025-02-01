const User = require("../models/User");

exports.getWithdrawalHistory = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId).select("withdrawalHistory");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user.withdrawalHistory);
  } catch (error) {
    console.error("Error fetching withdrawal history:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
