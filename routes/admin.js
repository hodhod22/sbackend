// routes/admin.js
const express = require("express");
const roleAuth = require("../middleware/roleAuth");
const User = require("../models/User");
const router = express.Router();

// Example: Get all users (Admin-only route)
router.get("/users", roleAuth(["admin"]), async (req, res) => {
  try {
    const users = await User.find({}, "-password"); // Exclude passwords from results
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
