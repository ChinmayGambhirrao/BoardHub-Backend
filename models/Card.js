const mongoose = require("mongoose");

const ChecklistItemSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  completedAt: {
    type: Date,
  },
});

const ChecklistSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  items: [ChecklistItemSchema],
  position: {
    type: Number,
    default: 0,
  },
});

const CardSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    list: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "List",
      required: true,
    },
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
      required: true,
    },
    position: {
      type: Number,
      default: 0,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    labels: [
      {
        color: {
          type: String,
        },
        text: {
          type: String,
        },
      },
    ],
    dueDate: {
      type: Date,
    },
    checklists: [ChecklistSchema],
    attachments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Attachment",
      },
    ],
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
    coverImage: {
      type: String,
      default: "",
    },
    archived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Add text index for search functionality
CardSchema.index({ title: "text", description: "text" });

module.exports = mongoose.model("Card", CardSchema);
