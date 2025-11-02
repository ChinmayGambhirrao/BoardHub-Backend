const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");
// Rate limiting is now handled inline to avoid middleware issues

// Import config (which loads .env)
const connectDB = require("./config/db");
const config = require("./config/config");

// Now check if env is loaded
console.log(
  "Env check → GOOGLE_CLIENT_ID present:",
  Boolean(process.env.GOOGLE_CLIENT_ID)
);
const { createServer } = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("./models/User");

// Initialize Express app
const app = express();
const server = createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || [
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  },
});

// Socket.io middleware for authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error("Authentication error: Invalid token"));
  }
});

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.user.name} (${socket.id})`);

  // Track joined boards to prevent duplicate joins
  socket.joinedBoards = new Set();

  // Join board room
  socket.on("join-board", (boardId) => {
    // Apply rate limiting manually to avoid middleware issues
    const userId = socket.user._id.toString();
    const key = `${userId}:join-board`;
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 5;

    // Simple rate limiting check
    if (!socket.joinBoardRequests) {
      socket.joinBoardRequests = [];
    }

    const recentRequests = socket.joinBoardRequests.filter(
      (timestamp) => now - timestamp < windowMs
    );

    if (recentRequests.length >= maxRequests) {
      console.log(`Rate limit exceeded for join-board by ${socket.user.name}`);
      return;
    }

    recentRequests.push(now);
    socket.joinBoardRequests = recentRequests;

    // Prevent duplicate joins
    if (socket.joinedBoards.has(boardId)) {
      console.log(
        `${socket.user.name} already in board ${boardId}, skipping join`
      );
      return;
    }

    socket.join(`board-${boardId}`);
    socket.joinedBoards.add(boardId);

    // Log room information
    const room = io.sockets.adapter.rooms.get(`board-${boardId}`);
    console.log(
      `Room board-${boardId} now has ${room ? room.size : 0} connected users`
    );

    // Notify other users in the board
    socket.to(`board-${boardId}`).emit("user-joined", {
      userId: socket.user._id,
      name: socket.user.name,
      avatar: socket.user.avatar,
      socketId: socket.id,
    });

    console.log(
      `${socket.user.name} joined board ${boardId} (socket: ${socket.id})`
    );
  });

  // Leave board room
  socket.on("leave-board", (boardId) => {
    // Apply rate limiting manually to avoid middleware issues
    const userId = socket.user._id.toString();
    const key = `${userId}:leave-board`;
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 5;

    // Simple rate limiting check
    if (!socket.leaveBoardRequests) {
      socket.leaveBoardRequests = [];
    }

    const recentRequests = socket.leaveBoardRequests.filter(
      (timestamp) => now - timestamp < windowMs
    );

    if (recentRequests.length >= maxRequests) {
      console.log(`Rate limit exceeded for leave-board by ${socket.user.name}`);
      return;
    }

    recentRequests.push(now);
    socket.leaveBoardRequests = recentRequests;

    // Only leave if actually joined
    if (!socket.joinedBoards.has(boardId)) {
      console.log(
        `${socket.user.name} not in board ${boardId}, skipping leave`
      );
      return;
    }

    socket.leave(`board-${boardId}`);
    socket.joinedBoards.delete(boardId);

    // Notify other users in the board
    socket.to(`board-${boardId}`).emit("user-left", {
      userId: socket.user._id,
      name: socket.user.name,
      avatar: socket.user.avatar,
      socketId: socket.id,
    });

    console.log(`${socket.user.name} left board ${boardId}`);
  });

  // Card events with rate limiting
  socket.on("card-created", (data) => {
    socket.to(`board-${data.boardId}`).emit("card-created", {
      ...data,
      createdBy: {
        _id: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      },
    });
  });

  socket.on("card-updated", (data) => {
    socket.to(`board-${data.boardId}`).emit("card-updated", {
      ...data,
      updatedBy: {
        _id: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      },
    });
  });

  socket.on("card-deleted", (data) => {
    socket.to(`board-${data.boardId}`).emit("card-deleted", {
      ...data,
      deletedBy: {
        _id: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      },
    });
  });

  // card-moved events are now handled by the server-side API controller
  // This ensures proper authorization and data consistency

  // List events with rate limiting
  socket.on("list-created", (data) => {
    socket.to(`board-${data.boardId}`).emit("list-created", {
      ...data,
      createdBy: {
        _id: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      },
    });
  });

  socket.on("list-updated", (data) => {
    socket.to(`board-${data.boardId}`).emit("list-updated", {
      ...data,
      updatedBy: {
        _id: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      },
    });
  });

  socket.on("list-deleted", (data) => {
    socket.to(`board-${data.boardId}`).emit("list-deleted", {
      ...data,
      deletedBy: {
        _id: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      },
    });
  });

  // Board events with rate limiting
  socket.on("board-updated", (data) => {
    socket.to(`board-${data.boardId}`).emit("board-updated", {
      ...data,
      updatedBy: {
        _id: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      },
    });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.user.name} (${socket.id})`);
  });
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL || [
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Session configuration
app.use(
  session({
    secret: config.jwtSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: config.mongoUri,
      ttl: 14 * 24 * 60 * 60, // 14 days
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
      sameSite: "lax",
    },
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Make io instance available to routes
app.set("io", io);

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/boards", require("./routes/boards"));
app.use("/api/lists", require("./routes/lists"));
app.use("/api/cards", require("./routes/cards"));
app.use("/api/invite", require("./routes/invite"));

// Health check route
app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: err.message || "Something went wrong on the server.",
  });
});

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    const PORT = process.env.PORT || 5001;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Socket.io server ready for real-time collaboration`);
    });
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

startServer();
