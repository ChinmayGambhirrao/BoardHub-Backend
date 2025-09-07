const Card = require("../models/Card");
const List = require("../models/List");
const Board = require("../models/Board");
const Attachment = require("../models/Attachment");
const Comment = require("../models/Comment");
const cloudinary = require("../utils/cloudinary");

// @desc    Create a new card
// @route   POST /api/cards
// @access  Private
exports.createCard = async (req, res) => {
  try {
    const { title, listId, position, description } = req.body;

    // Check if list exists and user has access
    const list = await List.findById(listId);
    if (!list) {
      return res.status(404).json({ message: "List not found" });
    }

    const board = await Board.findById(list.board);
    if (
      !board.owner.equals(req.user._id) &&
      !board.members.some((member) => member.user.equals(req.user._id))
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to add cards to this list" });
    }

    // Create new card
    const card = new Card({
      title,
      list: listId,
      position: position || list.cards.length,
      description,
      createdBy: req.user._id,
    });

    await card.save();

    // Add card to list
    list.cards.push(card._id);
    await list.save();

    // Add activity log
    board.activity.push({
      type: "card_create",
      user: req.user._id,
      description: `Card "${title}" created in list "${list.title}"`,
    });

    await board.save();

    res.status(201).json(card);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update card
// @route   PUT /api/cards/:id
// @access  Private
exports.updateCard = async (req, res) => {
  try {
    const { title, description, dueDate, position, listId } = req.body;
    const card = await Card.findById(req.params.id);

    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }

    // Check if user has access to the board
    const list = await List.findById(card.list);
    const board = await Board.findById(list.board);
    if (
      !board.owner.equals(req.user._id) &&
      !board.members.some((member) => member.user.equals(req.user._id))
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this card" });
    }

    // Update fields
    if (title) card.title = title;
    if (description !== undefined) card.description = description;
    if (dueDate !== undefined) card.dueDate = dueDate;
    if (position !== undefined) card.position = position;
    if (listId && listId !== card.list.toString()) {
      // Remove from old list
      const oldList = await List.findById(card.list);
      oldList.cards = oldList.cards.filter((c) => !c.equals(card._id));
      await oldList.save();

      // Add to new list
      const newList = await List.findById(listId);
      newList.cards.push(card._id);
      await newList.save();

      card.list = listId;
    }

    await card.save();

    // Add activity log
    board.activity.push({
      type: "card_update",
      user: req.user._id,
      description: `Card "${card.title}" updated`,
    });

    await board.save();

    res.json(card);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete card
// @route   DELETE /api/cards/:id
// @access  Private
exports.deleteCard = async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);

    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }

    // Check if user has access to the board
    const list = await List.findById(card.list);
    const board = await Board.findById(list.board);
    if (
      !board.owner.equals(req.user._id) &&
      !board.members.some((member) => member.user.equals(req.user._id))
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this card" });
    }

    // Remove card from list
    list.cards = list.cards.filter((c) => !c.equals(card._id));
    await list.save();

    // Delete all attachments
    await Attachment.deleteMany({ card: card._id });

    // Delete all comments
    await Comment.deleteMany({ card: card._id });

    // Add activity log
    board.activity.push({
      type: "card_delete",
      user: req.user._id,
      description: `Card "${card.title}" deleted`,
    });

    await board.save();

    // Delete card
    await card.remove();

    res.json({ message: "Card deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Add member to card
// @route   POST /api/cards/:id/members
// @access  Private
exports.addCardMember = async (req, res) => {
  try {
    const { userId } = req.body;
    const card = await Card.findById(req.params.id);

    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }

    // Check if user has access to the board
    const list = await List.findById(card.list);
    const board = await Board.findById(list.board);
    if (
      !board.owner.equals(req.user._id) &&
      !board.members.some((member) => member.user.equals(req.user._id))
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to modify this card" });
    }

    // Check if user is already a member
    if (card.members.includes(userId)) {
      return res
        .status(400)
        .json({ message: "User is already a member of this card" });
    }

    card.members.push(userId);
    await card.save();

    // Add activity log
    board.activity.push({
      type: "card_member_add",
      user: req.user._id,
      description: `Member added to card "${card.title}"`,
    });

    await board.save();

    res.json(card);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Remove member from card
// @route   DELETE /api/cards/:id/members/:userId
// @access  Private
exports.removeCardMember = async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);

    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }

    // Check if user has access to the board
    const list = await List.findById(card.list);
    const board = await Board.findById(list.board);
    if (
      !board.owner.equals(req.user._id) &&
      !board.members.some((member) => member.user.equals(req.user._id))
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to modify this card" });
    }

    card.members = card.members.filter(
      (member) => !member.equals(req.params.userId)
    );
    await card.save();

    // Add activity log
    board.activity.push({
      type: "card_member_remove",
      user: req.user._id,
      description: `Member removed from card "${card.title}"`,
    });

    await board.save();

    res.json(card);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Add attachment to card
// @route   POST /api/cards/:id/attachments
// @access  Private
exports.addAttachment = async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);

    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }

    // Check if user has access to the board
    const list = await List.findById(card.list);
    const board = await Board.findById(list.board);
    if (
      !board.owner.equals(req.user._id) &&
      !board.members.some((member) => member.user.equals(req.user._id))
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to modify this card" });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Create attachment record
    const attachment = new Attachment({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: req.file.path,
      card: card._id,
      uploadedBy: req.user._id,
      isImage: req.file.mimetype.startsWith("image/"),
      thumbnailUrl: req.file.mimetype.startsWith("image/") ? req.file.path : "",
    });

    await attachment.save();

    card.attachments.push(attachment._id);
    await card.save();

    // Add activity log
    board.activity.push({
      type: "card_attachment_add",
      user: req.user._id,
      description: `Attachment "${attachment.originalName}" added to card "${card.title}"`,
    });

    await board.save();

    res.status(201).json(attachment);
  } catch (error) {
    console.error("Attachment upload error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Remove attachment from card
// @route   DELETE /api/cards/:id/attachments/:attachmentId
// @access  Private
exports.removeAttachment = async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    const attachment = await Attachment.findById(req.params.attachmentId);

    if (!card || !attachment) {
      return res.status(404).json({ message: "Card or attachment not found" });
    }

    // Check if user has access to the board
    const list = await List.findById(card.list);
    const board = await Board.findById(list.board);
    if (
      !board.owner.equals(req.user._id) &&
      !board.members.some((member) => member.user.equals(req.user._id))
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to modify this card" });
    }

    // Remove attachment from Cloudinary
    try {
      const publicId = attachment.url.split("/").slice(-1)[0].split(".")[0];
      await cloudinary.uploader.destroy(publicId);
    } catch (cloudinaryError) {
      console.error("Cloudinary deletion error:", cloudinaryError);
      // Continue with deletion even if Cloudinary deletion fails
    }

    // Remove attachment from card
    card.attachments = card.attachments.filter(
      (a) => !a.equals(attachment._id)
    );
    await card.save();

    // Delete attachment record
    await attachment.deleteOne();

    // Add activity log
    board.activity.push({
      type: "card_attachment_remove",
      user: req.user._id,
      description: `Attachment removed from card "${card.title}"`,
    });

    await board.save();

    res.json({ message: "Attachment removed" });
  } catch (error) {
    console.error("Attachment removal error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Add comment to card
// @route   POST /api/cards/:id/comments
// @access  Private
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    const card = await Card.findById(req.params.id);

    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }

    // Check if user has access to the board
    const list = await List.findById(card.list);
    const board = await Board.findById(list.board);
    if (
      !board.owner.equals(req.user._id) &&
      !board.members.some((member) => member.user.equals(req.user._id))
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to modify this card" });
    }

    const comment = new Comment({
      text,
      card: card._id,
      user: req.user._id,
    });

    await comment.save();

    card.comments.push(comment._id);
    await card.save();

    // Add activity log
    board.activity.push({
      type: "card_comment_add",
      user: req.user._id,
      description: `Comment added to card "${card.title}"`,
    });

    await board.save();

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Remove comment from card
// @route   DELETE /api/cards/:id/comments/:commentId
// @access  Private
exports.removeComment = async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    const comment = await Comment.findById(req.params.commentId);

    if (!card || !comment) {
      return res.status(404).json({ message: "Card or comment not found" });
    }

    // Check if user has access to the board
    const list = await List.findById(card.list);
    const board = await Board.findById(list.board);
    if (
      !board.owner.equals(req.user._id) &&
      !board.members.some((member) => member.user.equals(req.user._id))
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to modify this card" });
    }

    // Only allow comment author or board owner to delete
    if (
      !comment.user.equals(req.user._id) &&
      !board.owner.equals(req.user._id)
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this comment" });
    }

    card.comments = card.comments.filter((c) => !c.equals(comment._id));
    await card.save();

    await comment.remove();

    // Add activity log
    board.activity.push({
      type: "card_comment_remove",
      user: req.user._id,
      description: `Comment removed from card "${card.title}"`,
    });

    await board.save();

    res.json({ message: "Comment removed" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update checklist item
// @route   PUT /api/cards/:id/checklist/:itemId
// @access  Private
exports.updateChecklistItem = async (req, res) => {
  try {
    const { completed } = req.body;
    const card = await Card.findById(req.params.id);

    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }

    // Check if user has access to the board
    const list = await List.findById(card.list);
    const board = await Board.findById(list.board);
    if (
      !board.owner.equals(req.user._id) &&
      !board.members.some((member) => member.user.equals(req.user._id))
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to modify this card" });
    }

    const checklistItem = card.checklist.id(req.params.itemId);
    if (!checklistItem) {
      return res.status(404).json({ message: "Checklist item not found" });
    }

    checklistItem.completed = completed;
    await card.save();

    // Add activity log
    board.activity.push({
      type: "card_checklist_update",
      user: req.user._id,
      description: `Checklist item updated in card "${card.title}"`,
    });

    await board.save();

    res.json(card);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Move card between lists
// @route   PUT /api/cards/:id/move
// @access  Private
exports.moveCard = async (req, res) => {
  try {
    const { destinationListId, position } = req.body;
    const card = await Card.findById(req.params.id);

    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }

    // Check if user has access to both lists
    const sourceList = await List.findById(card.list);
    const destinationList = await List.findById(destinationListId);

    if (!sourceList || !destinationList) {
      return res.status(404).json({ message: "List not found" });
    }

    const board = await Board.findById(sourceList.board);
    if (
      !board.owner.equals(req.user._id) &&
      !board.members.some((member) => member.user.equals(req.user._id))
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to move this card" });
    }

    // Get original position before removing
    const originalIndex = sourceList.cards.findIndex((c) => c.equals(card._id));

    // Remove from old list
    sourceList.cards = sourceList.cards.filter((c) => !c.equals(card._id));
    await sourceList.save();

    // Add to new list
    destinationList.cards.splice(position, 0, card._id);
    await destinationList.save();

    // Update card
    card.list = destinationListId;
    card.position = position;
    await card.save();

    // Add activity log
    board.activity.push({
      type: "card_move",
      user: req.user._id,
      description: `Card "${card.title}" moved from "${sourceList.title}" to "${destinationList.title}"`,
    });

    await board.save();

    // Emit real-time event to all users in the board
    const io = req.app.get("io");
    console.log("Attempting to emit card-moved event...");
    console.log("IO instance available:", !!io);
    console.log("Board ID:", board._id);
    console.log("Room name:", `board-${board._id}`);

    if (io) {
      const eventData = {
        // Normalize all IDs to strings for reliable client comparisons
        boardId: String(board._id),
        cardId: String(card._id),
        sourceListId: String(sourceList._id),
        destinationListId: String(destinationList._id),
        sourceIndex: originalIndex,
        destinationIndex: position,
        movedBy: {
          _id: String(req.user._id),
          name: req.user.name,
          avatar: req.user.avatar,
        },
      };

      console.log("Emitting card-moved event with data:", eventData);

      io.to(`board-${String(board._id)}`).emit("card-moved", eventData);

      // Also log the room information
      const room = io.sockets.adapter.rooms.get(`board-${String(board._id)}`);
      console.log(
        `Room board-${board._id} has ${room ? room.size : 0} connected users`
      );

      console.log("✅ Card-moved event emitted successfully");
    } else {
      console.error("❌ IO instance not available for card-moved emission");
    }

    res.json(card);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
