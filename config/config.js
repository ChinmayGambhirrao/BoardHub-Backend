require("dotenv").config();

module.exports = {
  port: process.env.PORT || 5001,
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/boardhub",
  jwtSecret: process.env.JWT_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  githubClientId: process.env.GITHUB_CLIENT_ID,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
  // cloudinary: {
  //   cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  //   apiKey: process.env.CLOUDINARY_API_KEY,
  //   apiSecret: process.env.CLOUDINARY_API_SECRET,
  // },
};
