const Board = require("../models/Board");
const List = require("../models/List");
const Card = require("../models/Card");
const Template = require("../models/Template");
const User = require("../models/User");

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

    console.log("Creating board with owner:", req.user._id);

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

// @desc    Create a new board from a template
// @route   POST /api/boards/from-template
// @access  Private
exports.createBoardFromTemplate = async (req, res) => {
  try {
    const { templateName } = req.body;
    if (!templateName) {
      return res.status(400).json({ message: "Template name is required" });
    }
    const template = await Template.findOne({ name: templateName });
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    // Create the board
    const board = new Board({
      title: template.name,
      description: template.description,
      owner: req.user._id,
      members: [{ user: req.user._id, role: "admin" }],
    });
    await board.save();

    // Create lists (columns)
    const lists = [];
    for (let i = 0; i < template.columns.length; i++) {
      const list = new List({
        title: template.columns[i],
        board: board._id,
        position: i,
      });
      await list.save();
      lists.push(list);
      board.lists.push(list._id);
    }
    await board.save();

    // Create cards
    for (const cardTemplate of template.cards) {
      const list = lists.find((l) => l.title === cardTemplate.column);
      if (!list) continue;
      const card = new Card({
        title: cardTemplate.title,
        description: cardTemplate.description,
        list: list._id,
        board: board._id,
        position: list.cards.length,
        createdBy: req.user._id,
      });
      await card.save();
      list.cards.push(card._id);
      await list.save();
    }

    // Add board to user's boards array
    req.user.boards.push(board._id);
    await req.user.save();

    res.status(201).json({ boardId: board._id });
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
    const isOwner = board.owner.equals(req.user._id);
    const isMember = board.members.some((member) =>
      member.user.equals(req.user._id)
    );

    console.log("Board access check:", {
      boardId: board._id,
      userId: req.user._id,
      isOwner,
      isMember,
      ownerId: board.owner,
      memberIds: board.members.map((m) => m.user),
    });

    if (!isOwner && !isMember) {
      return res.status(403).json({
        message: "Not authorized to access this board",
        boardId: board._id,
        needsToJoin: true,
      });
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

// @desc    Invite user to board by email
// @route   POST /api/boards/:id/invite
// @access  Private
exports.inviteUser = async (req, res) => {
  try {
    const { email, role = "member" } = req.body;
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
        .json({ message: "Not authorized to invite users" });
    }

    // Find user by email
    const userToInvite = await User.findOne({ email });
    if (!userToInvite) {
      return res
        .status(404)
        .json({ message: "User not found with this email" });
    }

    // Check if user is already a member
    if (board.members.some((member) => member.user.equals(userToInvite._id))) {
      return res.status(400).json({ message: "User is already a member" });
    }

    // Add user to board members
    board.members.push({ user: userToInvite._id, role });
    await board.save();

    // Add activity log
    board.activity.push({
      type: "member_invite",
      user: req.user._id,
      description: `Invited ${userToInvite.name} to the board`,
    });

    await board.save();

    res.json({
      message: `Successfully invited ${userToInvite.name} to the board`,
      user: {
        _id: userToInvite._id,
        name: userToInvite.name,
        email: userToInvite.email,
        avatar: userToInvite.avatar,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Debug board access
// @route   GET /api/boards/:id/debug
// @access  Private
exports.debugBoardAccess = async (req, res) => {
  try {
    const board = await Board.findById(req.params.id)
      .populate("owner", "name email avatar")
      .populate("members.user", "name email avatar");

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    const isOwner = board.owner.equals(req.user._id);
    const isMember = board.members.some((member) =>
      member.user.equals(req.user._id)
    );

    res.json({
      boardId: board._id,
      boardTitle: board.title,
      currentUser: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
      },
      owner: {
        id: board.owner._id,
        name: board.owner.name,
        email: board.owner.email,
      },
      members: board.members.map((m) => ({
        id: m.user._id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
      access: {
        isOwner,
        isMember,
        hasAccess: isOwner || isMember,
      },
    });
  } catch (error) {
    console.error("Error in debugBoardAccess:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Join board via shared link
// @route   POST /api/boards/:id/join
// @access  Private (but automatically adds user as member)
exports.joinBoardViaLink = async (req, res) => {
  try {
    const board = await Board.findById(req.params.id)
      .populate("owner", "name email avatar")
      .populate("members.user", "name email avatar");

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    // Check if user is already a member
    const isMember = board.members.some((member) =>
      member.user.equals(req.user._id)
    );
    const isOwner = board.owner.equals(req.user._id);

    if (isOwner || isMember) {
      // User already has access, return the board with full data
      const fullBoard = await Board.findById(req.params.id)
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
      return res.json({
        message: "Already have access to board",
        board: fullBoard,
      });
    }

    // Add user as a member with default role
    board.members.push({
      user: req.user._id,
      role: "member",
      joinedAt: new Date(),
    });

    // Add activity log
    board.activity.push({
      type: "member_join_via_link",
      user: req.user._id,
      description: `${req.user.name} joined via shared link`,
      timestamp: new Date(),
    });

    await board.save();

    // Populate the board again to get the updated member info and full board data
    const updatedBoard = await Board.findById(req.params.id)
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

    console.log("User successfully joined board via link:", {
      boardId: board._id,
      userId: req.user._id,
      userName: req.user.name,
    });

    res.json({
      message: "Successfully joined the board",
      board: updatedBoard,
    });
  } catch (error) {
    console.error("Error in joinBoardViaLink:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
