const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const { createServer } = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const { socketRateLimiter } = require("./middleware/rateLimit");

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Socket.io setup with CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || [
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST"],
  },
});

// Socket.io authentication middleware
const authenticateSocket = async (socket, next) => {
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
};

// Apply authentication middleware
io.use(authenticateSocket);

// Socket connection handling
io.on("connection", (socket) => {
  console.log(`User ${socket.user.name} connected: ${socket.id}`);

  // Join board room
  socket.on("join-board", (boardId) => {
    socket.join(`board-${boardId}`);
    socket.currentBoard = boardId;

    // Notify others that user joined
    socket.to(`board-${boardId}`).emit("user-joined", {
      userId: socket.user._id,
      name: socket.user.name,
      avatar: socket.user.avatar,
    });

    console.log(`User ${socket.user.name} joined board ${boardId}`);
  });

  // Leave board room
  socket.on("leave-board", (boardId) => {
    socket.leave(`board-${boardId}`);
    socket.currentBoard = null;

    // Notify others that user left
    socket.to(`board-${boardId}`).emit("user-left", {
      userId: socket.user._id,
      name: socket.user.name,
    });

    console.log(`User ${socket.user.name} left board ${boardId}`);
  });

  // Card events
  socket.on(
    "card-created",
    socketRateLimiter("card-created", 20, 60000),
    (data) => {
      socket.to(`board-${data.boardId}`).emit("card-created", {
        ...data,
        createdBy: {
          userId: socket.user._id,
          name: socket.user.name,
          avatar: socket.user.avatar,
        },
      });
    }
  );

  socket.on(
    "card-updated",
    socketRateLimiter("card-updated", 30, 60000),
    (data) => {
      socket.to(`board-${data.boardId}`).emit("card-updated", {
        ...data,
        updatedBy: {
          userId: socket.user._id,
          name: socket.user.name,
          avatar: socket.user.avatar,
        },
      });
    }
  );

  socket.on(
    "card-deleted",
    socketRateLimiter("card-deleted", 10, 60000),
    (data) => {
      socket.to(`board-${data.boardId}`).emit("card-deleted", {
        ...data,
        deletedBy: {
          userId: socket.user._id,
          name: socket.user.name,
          avatar: socket.user.avatar,
        },
      });
    }
  );

  socket.on(
    "card-moved",
    socketRateLimiter("card-moved", 50, 60000),
    (data) => {
      socket.to(`board-${data.boardId}`).emit("card-moved", {
        ...data,
        movedBy: {
          userId: socket.user._id,
          name: socket.user.name,
          avatar: socket.user.avatar,
        },
      });
    }
  );

  // List events
  socket.on("list-created", (data) => {
    socket.to(`board-${data.boardId}`).emit("list-created", {
      ...data,
      createdBy: {
        userId: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      },
    });
  });

  socket.on("list-updated", (data) => {
    socket.to(`board-${data.boardId}`).emit("list-updated", {
      ...data,
      updatedBy: {
        userId: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      },
    });
  });

  socket.on("list-deleted", (data) => {
    socket.to(`board-${data.boardId}`).emit("list-deleted", {
      ...data,
      deletedBy: {
        userId: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      },
    });
  });

  // Board events
  socket.on("board-updated", (data) => {
    socket.to(`board-${data.boardId}`).emit("board-updated", {
      ...data,
      updatedBy: {
        userId: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      },
    });
  });

  // User presence events
  socket.on("user-typing", (data) => {
    socket.to(`board-${data.boardId}`).emit("user-typing", {
      userId: socket.user._id,
      name: socket.user.name,
      avatar: socket.user.avatar,
      cardId: data.cardId,
    });
  });

  socket.on("user-stopped-typing", (data) => {
    socket.to(`board-${data.boardId}`).emit("user-stopped-typing", {
      userId: socket.user._id,
      cardId: data.cardId,
    });
  });

  // Disconnect handling
  socket.on("disconnect", () => {
    if (socket.currentBoard) {
      socket.to(`board-${socket.currentBoard}`).emit("user-left", {
        userId: socket.user._id,
        name: socket.user.name,
      });
    }
    console.log(`User ${socket.user.name} disconnected: ${socket.id}`);
  });
});

// Make io available to routes
app.set("io", io);

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
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
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

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/boards", require("./routes/boards"));
app.use("/api/lists", require("./routes/lists"));
app.use("/api/cards", require("./routes/cards"));

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
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Socket.io server ready for real-time collaboration`);
    });
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

startServer();
