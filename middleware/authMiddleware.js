const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).send("Access denied. No token provided.");
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.userId = decoded.id; // Attach userId to the request object
    next();
  } catch (err) {
    res.status(400).send("Invalid token.");
  }
};

module.exports = authMiddleware;
