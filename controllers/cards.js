const { validationResult } = require("express-validator");
const Card = require("../models/Card");
const List = require("../models/List");
const Board = require("../models/Board");

// @desc    Create a new card
// @route   POST /api/lists/:listId/cards
// @access  Private
exports.createCard = async (req, res) => {
  // Validate request data
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { title, description } = req.body;
  const listId = req.params.listId;

  try {
    // Check if list exists
    const list = await List.findById(listId);

    if (!list) {
      return res.status(404).json({ message: "List not found" });
    }

    // Check if user owns the board the list belongs to
    const board = await Board.findById(list.board);

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    if (board.owner.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // Find the highest position value among existing cards for this list
    const cards = await Card.find({ list: listId });
    const highestPosition =
      cards.length > 0 ? Math.max(...cards.map((card) => card.position)) : -1;

    // Create a new card
    const newCard = new Card({
      title,
      description: description || "",
      list: listId,
      board: list.board,
      position: highestPosition + 1,
    });

    const card = await newCard.save();
    console.log(`Card created: ${card._id} for list ${listId}`);

    // Add card to list
    list.cards.push(card._id);
    await list.save();
    console.log(`Card ${card._id} added to list ${listId}`);

    res.status(201).json(card);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "List not found" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Update a card
// @route   PUT /api/cards/:id
// @access  Private
exports.updateCard = async (req, res) => {
  // Validate request data
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { title, description, dueDate, labels } = req.body;

  try {
    let card = await Card.findById(req.params.id);

    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }

    // Check if user owns the board the card belongs to
    const board = await Board.findById(card.board);

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    if (board.owner.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // Update card
    card.title = title || card.title;
    if (description !== undefined) card.description = description;
    if (dueDate !== undefined) card.dueDate = dueDate;
    if (labels !== undefined) card.labels = labels;

    await card.save();
    res.json(card);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Card not found" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Delete a card
// @route   DELETE /api/cards/:id
// @access  Private
exports.deleteCard = async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);

    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }

    // Check if user owns the board the card belongs to
    const board = await Board.findById(card.board);

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    if (board.owner.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // Remove card from list
    const list = await List.findById(card.list);
    if (list) {
      list.cards = list.cards.filter(
        (cardId) => cardId.toString() !== card._id.toString()
      );
      await list.save();
    }

    // Delete card
    await card.remove();

    res.json({ message: "Card removed" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Card not found" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Move a card between lists
// @route   PUT /api/cards/:id/move
// @access  Private
exports.moveCard = async (req, res) => {
  const { destinationListId, position } = req.body;

  console.log("Server received moveCard request:", {
    cardId: req.params.id,
    destinationListId,
    position,
  });

  if (!destinationListId || position === undefined) {
    console.error("Missing required fields for moveCard:", req.body);
    return res
      .status(400)
      .json({ message: "Please provide all required fields" });
  }

  try {
    // Find the card
    const card = await Card.findById(req.params.id);

    if (!card) {
      console.error("Card not found:", req.params.id);
      return res.status(404).json({ message: "Card not found" });
    }

    // Check if user owns the board
    const board = await Board.findById(card.board);

    if (!board) {
      console.error("Board not found for card:", card.board);
      return res.status(404).json({ message: "Board not found" });
    }

    if (board.owner.toString() !== req.user._id.toString()) {
      console.error("User not authorized:", {
        owner: board.owner.toString(),
        user: req.user._id.toString(),
      });
      return res.status(401).json({ message: "Not authorized" });
    }

    // Find source and destination lists
    const sourceList = await List.findById(card.list);
    const destinationList = await List.findById(destinationListId);

    if (!sourceList || !destinationList) {
      console.error("Source or destination list not found:", {
        sourceListId: card.list,
        destinationListId,
      });
      return res.status(404).json({ message: "List not found" });
    }

    console.log("Moving card:", {
      card: card._id,
      from: sourceList.title,
      to: destinationList.title,
      position,
    });

    // Remove card from source list
    sourceList.cards = sourceList.cards.filter(
      (cardId) => cardId.toString() !== card._id.toString()
    );
    await sourceList.save();
    console.log("Card removed from source list");

    // Add card to destination list
    destinationList.cards.push(card._id);
    await destinationList.save();
    console.log("Card added to destination list");

    // Update card with new list and position
    card.list = destinationListId;
    card.position = position;
    await card.save();
    console.log("Card updated with new list and position");

    res.json(card);
  } catch (err) {
    console.error("Error in moveCard:", err);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Card or list not found" });
    }
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
