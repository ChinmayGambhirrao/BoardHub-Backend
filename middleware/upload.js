const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const config = require("../config/config");

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

// Configure storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "boardhub",
    allowed_formats: [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "pdf",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "txt",
    ],
    resource_type: "auto",
    transformation: [
      { width: 1000, height: 1000, crop: "limit" }, // Limit image size
      { quality: "auto" }, // Optimize quality
    ],
  },
});

// Create multer upload instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only images, PDFs, documents, and text files are allowed."
        )
      );
    }
  },
});

module.exports = upload;
