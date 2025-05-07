// routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { verifyUserPayments } = require("../controllers/paymentController");
const router = express.Router();
// Register
// Register with automatic account number and initial balance
const generateAccountNumber = async () => {
  let accountNumber;
  let exists = true;

  while (exists) {
    // Generate a random 10-digit account number
    accountNumber = Math.floor(
      1000000000 + Math.random() * 9000000000
    ).toString();

    // Check if account number already exists
    const existingUser = await User.findOne({ accountNumber });
    exists = !!existingUser; // If found, loop continues
  }

  return accountNumber;
};
//

// Call this function after successful login
//

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Generate unique account number
    const accountNumber = await generateAccountNumber();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      accountNumber,
    });

    await newUser.save();

    // Generate token and send response
    const token = jwt.sign(
      { id: newUser._id, role: newUser.role },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        accountNumber: newUser.accountNumber,
        role: newUser.role,
        balance: newUser.balance,
      },
    });
  } catch (error) {
    console.error("Error registering user: ", error);
    res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
});
// Admin: Get all user information
router.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: "User not found" });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );
    // Step 4: Verify pending payments for the user (in the background)
    verifyUserPayments(user._id)
      .then(() => {
        console.log("Payments verified for user:", user._id);
      })
      .catch((error) => {
        console.error("Error verifying payments:", error);
      });
    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role, // Include role
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
