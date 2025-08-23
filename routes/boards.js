const express = require("express");
const { check } = require("express-validator");
const auth = require("../middleware/auth");
const {
  createBoard,
  getBoards,
  getBoard,
  updateBoard,
  deleteBoard,
  addMember,
  removeMember,
  createBoardFromTemplate,
  inviteUser,
  debugBoardAccess,
} = require("../controllers/board");
const { createList, reorderLists } = require("../controllers/list");

const router = express.Router();

// Protect all routes in this router
router.use(auth);

// @route   GET /api/boards
// @desc    Get all boards for current user
// @access  Private
router.get("/", getBoards);

// @route   GET /api/boards/:id
// @desc    Get a specific board
// @access  Private
router.get("/:id", getBoard);

// @route   GET /api/boards/:id/debug
// @desc    Debug board access
// @access  Private
router.get("/:id/debug", debugBoardAccess);

// @route   POST /api/boards
// @desc    Create a new board
// @access  Private
router.post(
  "/",
  [
    check("title", "Title is required").not().isEmpty(),
    check("title", "Title must be between 1 and 100 characters").isLength({
      min: 1,
      max: 100,
    }),
  ],
  createBoard
);

// @route   PUT /api/boards/:id
// @desc    Update a board
// @access  Private
router.put(
  "/:id",
  [
    check("title", "Title must be between 1 and 100 characters")
      .optional()
      .isLength({ min: 1, max: 100 }),
  ],
  updateBoard
);

// @route   DELETE /api/boards/:id
// @desc    Delete a board
// @access  Private
router.delete("/:id", deleteBoard);

// @route   POST /api/boards/from-template
// @desc    Create a new board from a template
// @access  Private
router.post("/from-template", createBoardFromTemplate);

// @route   POST /api/boards/:boardId/lists
// @desc    Create a new list in a board
// @access  Private
router.post(
  "/:boardId/lists",
  [check("title", "Title is required").not().isEmpty()],
  createList
);

// @route   PUT /api/boards/:boardId/lists/reorder
// @desc    Reorder lists
// @access  Private
router.put("/:boardId/lists/reorder", reorderLists);

// @route   POST /api/boards/:id/members
// @desc    Add member to board
// @access  Private
router.post(
  "/:id/members",
  [
    check("userId", "User ID is required").not().isEmpty(),
    check("role", "Role must be either admin or member")
      .optional()
      .isIn(["admin", "member"]),
  ],
  addMember
);

// @route   DELETE /api/boards/:id/members/:userId
// @desc    Remove member from board
// @access  Private
router.delete("/:id/members/:userId", removeMember);

// @route   POST /api/boards/:id/invite
// @desc    Invite user to board by email
// @access  Private
router.post(
  "/:id/invite",
  [
    check("email", "Email is required").isEmail(),
    check("role", "Role must be either admin or member")
      .optional()
      .isIn(["admin", "member"]),
  ],
  inviteUser
);

module.exports = router;
