const jwt = require("jsonwebtoken");
const User = require("../models/User");

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

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not set in environment variables");
      return res.status(500).json({ message: "Server configuration error" });
    }

    // Verify token
    console.log("Verifying token with JWT_SECRET");
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
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
