const jwt = require("jsonwebtoken");
const User = require("../models/User");
const config = require("../config/config");

// Middleware to protect routes
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header("Authorization");
    console.log("Auth header:", authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Invalid authorization header format" });
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("Extracted token:", token);

    if (!token) {
      return res
        .status(401)
        .json({ message: "No authentication token, access denied" });
    }

    if (!config.jwtSecret) {
      console.error("JWT secret is not configured. Set JWT_SECRET or config.jwtSecret.");
      return res.status(500).json({ message: "Server configuration error" });
    }

    // Verify token
    console.log("Verifying token with configured JWT secret");
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError);
      return res.status(401).json({
        message: "Token verification failed",
        error:
          jwtError.name === "TokenExpiredError"
            ? "Token has expired"
            : "Invalid token",
      });
    }
    console.log("Decoded token:", decoded);

    // Find user
    const user = await User.findById(decoded.userId);
    console.log("Found user:", user ? "Yes" : "No");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Update last active timestamp
    user.lastActive = new Date();
    await user.save();

    // Add user to request object
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res
      .status(401)
      .json({ message: "Authentication failed", error: error.message });
  }
};

module.exports = auth;
