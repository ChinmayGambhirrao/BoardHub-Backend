const Board = require("../models/Board");
const List = require("../models/List");
const Card = require("../models/Card");

// @desc    Create a new board
// @route   POST /api/boards
// @access  Private
exports.createBoard = async (req, res) => {
  try {
    const { title, description, background, backgroundImage } = req.body;

    const board = new Board({
      title,
      description,
      background,
      backgroundImage,
      owner: req.user._id,
      members: [{ user: req.user._id, role: "admin" }],
    });

    await board.save();

    // Create a default list
    const list = new List({
      title: "To-Do",
      board: board._id,
      position: 0,
    });
    await list.save();

    // Add list to board
    board.lists.push(list._id);
    await board.save();

    // Add board to user's boards array
    req.user.boards.push(board._id);
    await req.user.save();

    res.status(201).json(board);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all boards for current user
// @route   GET /api/boards
// @access  Private
exports.getBoards = async (req, res) => {
  try {
    const boards = await Board.find({
      $or: [{ owner: req.user._id }, { "members.user": req.user._id }],
    })
      .populate("owner", "name email avatar")
      .populate("members.user", "name email avatar")
      .sort({ updatedAt: -1 });

    res.json(boards);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get board by ID
// @route   GET /api/boards/:id
// @access  Private
exports.getBoard = async (req, res) => {
  try {
    const board = await Board.findById(req.params.id)
      .populate("owner", "name email avatar")
      .populate("members.user", "name email avatar")
      .populate({
        path: "lists",
        populate: {
          path: "cards",
          populate: [
            { path: "members", select: "name email avatar" },
            { path: "attachments" },
            {
              path: "comments",
              populate: { path: "author", select: "name email avatar" },
            },
          ],
        },
      });

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    // Check if user has access to the board
    if (
      !board.owner.equals(req.user._id) &&
      !board.members.some((member) => member.user.equals(req.user._id))
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to access this board" });
    }

    res.json(board);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update board
// @route   PUT /api/boards/:id
// @access  Private
exports.updateBoard = async (req, res) => {
  try {
    const { title, description, background, backgroundImage, settings } =
      req.body;
    const board = await Board.findById(req.params.id);

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    // Check if user is owner or admin
    if (
      !board.owner.equals(req.user._id) &&
      !board.members.some(
        (member) => member.user.equals(req.user._id) && member.role === "admin"
      )
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this board" });
    }

    // Update fields
    if (title) board.title = title;
    if (description !== undefined) board.description = description;
    if (background) board.background = background;
    if (backgroundImage !== undefined) board.backgroundImage = backgroundImage;
    if (settings) board.settings = { ...board.settings, ...settings };

    await board.save();

    // Add activity log
    board.activity.push({
      type: "update",
      user: req.user._id,
      description: "Board updated",
    });

    await board.save();

    res.json(board);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete board
// @route   DELETE /api/boards/:id
// @access  Private
exports.deleteBoard = async (req, res) => {
  try {
    const board = await Board.findById(req.params.id);

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    // Check if user is owner
    if (!board.owner.equals(req.user._id)) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this board" });
    }

    // Delete all lists and cards
    await List.deleteMany({ board: board._id });
    await Card.deleteMany({ board: board._id });

    // Remove board from user's boards array
    req.user.boards = req.user.boards.filter(
      (boardId) => !boardId.equals(board._id)
    );
    await req.user.save();

    // Delete board
    await board.remove();

    res.json({ message: "Board deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Add member to board
// @route   POST /api/boards/:id/members
// @access  Private
exports.addMember = async (req, res) => {
  try {
    const { userId, role = "member" } = req.body;
    const board = await Board.findById(req.params.id);

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    // Check if user is owner or admin
    if (
      !board.owner.equals(req.user._id) &&
      !board.members.some(
        (member) => member.user.equals(req.user._id) && member.role === "admin"
      )
    ) {
      return res.status(403).json({ message: "Not authorized to add members" });
    }

    // Check if user is already a member
    if (board.members.some((member) => member.user.equals(userId))) {
      return res.status(400).json({ message: "User is already a member" });
    }

    board.members.push({ user: userId, role });
    await board.save();

    // Add activity log
    board.activity.push({
      type: "member_add",
      user: req.user._id,
      description: "Member added to board",
    });

    await board.save();

    res.json(board);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Remove member from board
// @route   DELETE /api/boards/:id/members/:userId
// @access  Private
exports.removeMember = async (req, res) => {
  try {
    const board = await Board.findById(req.params.id);

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    // Check if user is owner or admin
    if (
      !board.owner.equals(req.user._id) &&
      !board.members.some(
        (member) => member.user.equals(req.user._id) && member.role === "admin"
      )
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to remove members" });
    }

    // Cannot remove owner
    if (board.owner.equals(req.params.userId)) {
      return res.status(400).json({ message: "Cannot remove board owner" });
    }

    board.members = board.members.filter(
      (member) => !member.user.equals(req.params.userId)
    );
    await board.save();

    // Add activity log
    board.activity.push({
      type: "member_remove",
      user: req.user._id,
      description: "Member removed from board",
    });

    await board.save();

    res.json(board);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
