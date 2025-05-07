const User = require("../models/User");
const fs = require("fs");
const path = require("path");

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

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    console.log("Update profile request received:", req.body);
    
    // Check if user is authenticated - can use either req.user or req.userId
    if (!req.user && !req.userId) {
      console.error("User not authenticated");
      return res.status(401).json({ message: "User not authenticated" });
    }
    
    // If req.user is available, use it directly, otherwise fetch from database
    let user;
    if (req.user) {
      user = req.user;
      console.log("Using user from request:", user._id);
    } else {
      const userId = req.userId;
      console.log("Fetching user from database with ID:", userId);
      
      // Get user from database
      user = await User.findById(userId);
      
      if (!user) {
        console.error("User not found in database:", userId);
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log("User found in database:", user._id);
    }
    
    // Update user fields
    const { firstName, lastName, email, phone, address, city, country, bio } = req.body;
    
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (address) user.address = address;
    if (city) user.city = city;
    if (country) user.country = country;
    if (bio) user.bio = bio;
    
    console.log("Updated user fields:", { firstName, lastName, email });
    
    // Handle profile image upload
    if (req.file) {
      console.log("Profile image uploaded:", req.file.filename);
      
      // If user already has a profile image, delete the old one
      if (user.profileImage) {
        try {
          const oldImagePath = path.join(__dirname, "../uploads/profiles", user.profileImage.split("/").pop());
          console.log("Checking for old image at:", oldImagePath);
          
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
            console.log("Old profile image deleted");
          }
        } catch (err) {
          console.error("Error deleting old profile image:", err);
          // Continue even if deleting old image fails
        }
      }
      
      // Set new profile image
      user.profileImage = `/uploads/profiles/${req.file.filename}`;
    }
    
    // Save updated user
    console.log("Saving updated user");
    await user.save();
    console.log("User saved successfully");
    
    // Return updated user without password
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.status(200).json({
      message: "Profile updated successfully",
      user: userResponse
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? '🥞' : error.stack
    });
  }
};

// Get user profile
exports.getProfile = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error("Error getting profile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
