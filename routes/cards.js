const express = require("express");
const { check } = require("express-validator");
const auth = require("../middleware/auth");
const {
  createCard,
  updateCard,
  deleteCard,
  moveCard,
  addCardMember,
  removeCardMember,
  addAttachment,
  removeAttachment,
  addComment,
  removeComment,
  updateChecklistItem,
} = require("../controllers/card");

const router = express.Router();

// Protect all routes in this router
router.use(auth);

// @route   POST /api/cards
// @desc    Create a new card
// @access  Private
router.post(
  "/",
  [
    check("title", "Title is required").not().isEmpty(),
    check("title", "Title must be between 1 and 100 characters").isLength({
      min: 1,
      max: 100,
    }),
    check("listId", "List ID is required").not().isEmpty(),
  ],
  createCard
);

// @route   PUT /api/cards/:id
// @desc    Update card
// @access  Private
router.put(
  "/:id",
  [
    check("title", "Title must be between 1 and 100 characters")
      .optional()
      .isLength({ min: 1, max: 100 }),
  ],
  updateCard
);

// @route   DELETE /api/cards/:id
// @desc    Delete card
// @access  Private
router.delete("/:id", deleteCard);

// @route   PUT /api/cards/:id/move
// @desc    Move a card between lists
// @access  Private
router.put(
  "/:id/move",
  [
    check("destinationListId", "Destination list ID is required")
      .not()
      .isEmpty(),
    check("position", "Position is required").isNumeric(),
  ],
  moveCard
);

// @route   POST /api/cards/:id/members
// @desc    Add member to card
// @access  Private
router.post(
  "/:id/members",
  [check("userId", "User ID is required").not().isEmpty()],
  addCardMember
);

// @route   DELETE /api/cards/:id/members/:userId
// @desc    Remove member from card
// @access  Private
router.delete("/:id/members/:userId", removeCardMember);

// @route   POST /api/cards/:id/attachments
// @desc    Add attachment to card
// @access  Private
router.post(
  "/:id/attachments",
  [
    check("name", "Name is required").not().isEmpty(),
    check("url", "URL is required").not().isEmpty(),
    check("type", "Type is required").not().isEmpty(),
  ],
  addAttachment
);

// @route   DELETE /api/cards/:id/attachments/:attachmentId
// @desc    Remove attachment from card
// @access  Private
router.delete("/:id/attachments/:attachmentId", removeAttachment);

// @route   POST /api/cards/:id/comments
// @desc    Add comment to card
// @access  Private
router.post(
  "/:id/comments",
  [check("text", "Comment text is required").not().isEmpty()],
  addComment
);

// @route   DELETE /api/cards/:id/comments/:commentId
// @desc    Remove comment from card
// @access  Private
router.delete("/:id/comments/:commentId", removeComment);

// @route   PUT /api/cards/:id/checklist/:itemId
// @desc    Update checklist item
// @access  Private
router.put(
  "/:id/checklist/:itemId",
  [check("completed", "Completed status is required").isBoolean()],
  updateChecklistItem
);

module.exports = router;
