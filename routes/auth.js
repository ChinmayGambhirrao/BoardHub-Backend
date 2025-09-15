const express = require("express");
const { check } = require("express-validator");
const authController = require("../controllers/auth");
const auth = require("../middleware/auth");
const config = require("../config/config");

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register user
// @access  Public
router.post(
  "/register",
  [
    check("name", "Name is required").not().isEmpty(),
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password must be at least 6 characters").isLength({
      min: 6,
    }),
  ],
  authController.register
);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post(
  "/login",
  [
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password is required").exists(),
  ],
  authController.login
);

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get("/me", auth, authController.getCurrentUser);

// @route   GET /api/auth/google
// @desc    Google OAuth login
// @access  Public
router.get("/google", (req, res) => {
  const redirectUri = `${
    process.env.SERVER_URL || "http://localhost:5001"
  }/api/auth/google/callback`;

  // Log the redirect URI for debugging
  console.log("Redirect URI:", redirectUri);

  const scope = encodeURIComponent("openid email profile");
  // Diagnostic: ensure env is visible in this route
  console.log(
    "[Auth Route] GOOGLE_CLIENT_ID present:",
    Boolean(process.env.GOOGLE_CLIENT_ID)
  );

  const rawClientId =
    config.googleClientId || process.env.GOOGLE_CLIENT_ID || "";
  if (!rawClientId) {
    console.error(
      "Missing GOOGLE_CLIENT_ID env var; cannot start Google OAuth"
    );
    return res.status(500).json({
      message: "Server misconfiguration: GOOGLE_CLIENT_ID is not set",
    });
  }
  const clientId = encodeURIComponent(rawClientId);
  const encodedRedirect = encodeURIComponent(redirectUri);
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodedRedirect}&` +
    `response_type=code&` +
    `scope=${scope}&` +
    `access_type=offline&` +
    `prompt=consent`;

  res.redirect(authUrl);
});

// @route   GET /api/auth/google/callback
// @desc    Google OAuth callback
// @access  Public
router.get("/google/callback", async (req, res) => {
  try {
    const { code } = req.query;
    // Log the received code for debugging
    console.log("Received auth code from Google:", code);

    if (!code) {
      console.error("No code received from Google OAuth");
      return res.redirect(
        `${
          process.env.CLIENT_URL || "http://localhost:5173"
        }/login?error=no_code`
      );
    }

    // Encode the code properly to prevent URL issues
    const encodedCode = encodeURIComponent(code);
    console.log(
      "Redirecting to client with encoded code, length:",
      encodedCode.length
    );

    res.redirect(
      `${
        process.env.CLIENT_URL || "http://localhost:5173"
      }/oauth-success?provider=google&code=${encodedCode}`
    );
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    res.redirect(
      `${
        process.env.CLIENT_URL || "http://localhost:5173"
      }/login?error=oauth_failed`
    );
  }
});

// @route   POST /api/auth/google
// @desc    Process Google auth token
// @access  Public
router.post("/google", authController.googleAuth);

module.exports = router;
