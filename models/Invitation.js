const mongoose = require("mongoose");
const crypto = require("crypto");

const InvitationSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomBytes(32).toString("hex"),
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
      required: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "member"],
      default: "member",
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "expired"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      index: { expireAfterSeconds: 0 },
    },
    acceptedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
InvitationSchema.index({ email: 1, board: 1 });
InvitationSchema.index({ token: 1 });
InvitationSchema.index({ status: 1 });

module.exports = mongoose.model("Invitation", InvitationSchema);




