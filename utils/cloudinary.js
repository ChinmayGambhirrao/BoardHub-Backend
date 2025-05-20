const cloudinary = require("cloudinary").v2;
const config = require("../config/config");

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

// Helper function to get public ID from URL
const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  const parts = url.split("/");
  const filename = parts[parts.length - 1];
  return filename.split(".")[0];
};

// Helper function to generate thumbnail URL
const generateThumbnailUrl = (url, width = 200) => {
  if (!url) return null;
  const publicId = getPublicIdFromUrl(url);
  if (!publicId) return null;
  return cloudinary.url(publicId, {
    width,
    height: width,
    crop: "fill",
    quality: "auto",
  });
};

module.exports = {
  cloudinary,
  getPublicIdFromUrl,
  generateThumbnailUrl,
};
