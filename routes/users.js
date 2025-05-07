const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authenticate = require("../middleware/authenticate");
const { updateProfile, getProfile } = require("../controllers/userController");

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/profiles");

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    // Use userId from the request or fallback to 'unknown'
    const userId = req.userId || "unknown";
    cb(null, `profile-${userId}-${uniqueSuffix}${ext}`);
  },
});

// File filter to only allow image uploads
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Get user profile
router.get("/profile", authenticate, getProfile);

// For the update route, we need to handle the file upload after authentication
// This ensures req.user is available when multer generates the filename
const handleProfileUpdate = (req, res, next) => {
  upload.single("profileImage")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      // An unknown error occurred
      return res.status(500).json({ message: `Unknown error: ${err.message}` });
    }
    // Everything went fine, proceed
    next();
  });
};

// Update user profile
router.put("/profile", authenticate, handleProfileUpdate, updateProfile);

module.exports = router;
