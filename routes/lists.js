const express = require("express");
const { check } = require("express-validator");
const cardsController = require("../controllers/cards.js");
const auth = require("../middleware/auth");
const {
  createList,
  updateList,
  deleteList,
  reorderLists,
} = require("../controllers/list");

const router = express.Router();

// Protect all routes in this router
router.use(auth);

// @route   POST /api/lists
// @desc    Create a new list
// @access  Private
router.post(
  "/",
  [
    check("title", "Title is required").not().isEmpty(),
    check("title", "Title must be between 1 and 100 characters").isLength({
      min: 1,
      max: 100,
    }),
    check("boardId", "Board ID is required").not().isEmpty(),
  ],
  createList
);

// @route   PUT /api/lists/:id
// @desc    Update list
// @access  Private
router.put(
  "/:id",
  [
    check("title", "Title must be between 1 and 100 characters")
      .optional()
      .isLength({ min: 1, max: 100 }),
  ],
  updateList
);

// @route   DELETE /api/lists/:id
// @desc    Delete list
// @access  Private
router.delete("/:id", deleteList);

// @route   PUT /api/lists/reorder
// @desc    Reorder lists
// @access  Private
router.put(
  "/reorder",
  [
    check("lists", "Lists array is required").isArray(),
    check("lists.*.id", "List ID is required").not().isEmpty(),
    check("lists.*.position", "Position must be a number").isNumeric(),
  ],
  reorderLists
);

// @route   POST /api/lists/:listId/cards
// @desc    Create a new card in a list
// @access  Private
router.post(
  "/:listId/cards",
  [check("title", "Title is required").not().isEmpty()],
  cardsController.createCard
);

module.exports = router;
