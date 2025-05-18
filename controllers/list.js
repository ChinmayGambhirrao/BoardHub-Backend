const List = require("../models/List");
const Board = require("../models/Board");
const Card = require("../models/Card");

// @desc    Create a new list
// @route   POST /api/lists
// @access  Private
exports.createList = async (req, res) => {
  try {
    const { title, position } = req.body;
    // Use boardId from params if present, else from body
    const boardId = req.params.boardId || req.body.boardId;

    // Check if board exists and user has access
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    if (
      !board.owner.equals(req.user._id) &&
      !board.members.some((member) => member.user.equals(req.user._id))
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to add lists to this board" });
    }

    // Create new list
    const list = new List({
      title,
      board: boardId,
      position: position || board.lists.length,
    });

    await list.save();

    // Add list to board
    board.lists.push(list._id);
    await board.save();

    // Add activity log
    board.activity.push({
      type: "list_create",
      user: req.user._id,
      description: `List "${title}" created`,
    });

    await board.save();

    res.status(201).json(list);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update list
// @route   PUT /api/lists/:id
// @access  Private
exports.updateList = async (req, res) => {
  try {
    const { title, position } = req.body;
    const list = await List.findById(req.params.id);

    if (!list) {
      return res.status(404).json({ message: "List not found" });
    }

    // Check if user has access to the board
    const board = await Board.findById(list.board);
    if (
      !board.owner.equals(req.user._id) &&
      !board.members.some((member) => member.user.equals(req.user._id))
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this list" });
    }

    // Update fields
    if (title) list.title = title;
    if (position !== undefined) list.position = position;

    await list.save();

    // Add activity log
    board.activity.push({
      type: "list_update",
      user: req.user._id,
      description: `List "${list.title}" updated`,
    });

    await board.save();

    res.json(list);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete list
// @route   DELETE /api/lists/:id
// @access  Private
exports.deleteList = async (req, res) => {
  try {
    const list = await List.findById(req.params.id);

    if (!list) {
      return res.status(404).json({ message: "List not found" });
    }

    // Check if user has access to the board
    const board = await Board.findById(list.board);
    if (
      !board.owner.equals(req.user._id) &&
      !board.members.some((member) => member.user.equals(req.user._id))
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this list" });
    }

    // Delete all cards in the list
    await Card.deleteMany({ list: list._id });

    // Remove list from board
    board.lists = board.lists.filter((listId) => !listId.equals(list._id));
    await board.save();

    // Add activity log
    board.activity.push({
      type: "list_delete",
      user: req.user._id,
      description: `List "${list.title}" deleted`,
    });

    await board.save();

    // Delete list
    await list.remove();

    res.json({ message: "List deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Reorder lists
// @route   PUT /api/lists/reorder
// @access  Private
exports.reorderLists = async (req, res) => {
  try {
    const { lists } = req.body;

    // Validate input
    if (!Array.isArray(lists)) {
      return res.status(400).json({ message: "Lists must be an array" });
    }

    // Update positions
    const updatePromises = lists.map(({ id, position }) =>
      List.findByIdAndUpdate(id, { position }, { new: true })
    );

    await Promise.all(updatePromises);

    // Get board ID from first list
    const firstList = await List.findById(lists[0].id);
    if (!firstList) {
      return res.status(404).json({ message: "List not found" });
    }

    // Add activity log
    const board = await Board.findById(firstList.board);
    board.activity.push({
      type: "lists_reorder",
      user: req.user._id,
      description: "Lists reordered",
    });

    await board.save();

    res.json({ message: "Lists reordered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
