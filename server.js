const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const { createServer } = require("http");
const {Server} = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("./models/User.js");
const { socketRateLimiter } = require("./middleware/rateLimit.js");

// Load environment variables
dotenv.config();

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
      return next(new Error("Authentication error"));
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

  // Join board room
  socket.io("join-board", (boardId) => {
    socket.join(`board-${boardId}`);

    // Notify other users in the board
    socket.io(`board-${boardId}`).emit("user-joined", {
      userId: socket.user._id,
      name: socket.user.name,
      avatar: socket.user.avatar,
      socketId: socket.id,
    });
    console.log(`${socket.user.name} joined board ${boardId}`);
  });

  // Leave board room
  socket.on("leave-board", (boardId) => {
    socket.leave(`board-${boardId}`);

    // Notify other users in the board
    socket.to(`board-${boardId}`).emit("user-left", {
      userId: socket.user._id,
      name: socket.user.name,
      avatar: socket.user.avatar,
      socketId: socket.id,
    })

    console.log(`${socket.user.name} left board ${boardId}`);
  })

  // Card events with rate limiting
  socket.on("card-created", socketRateLimiter("card-updated", 30), (data) => {
    socket.to(`board-${data.boardId}`).emit("card-updated", {
      ...data,
      updatedBy: {
        _id: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      }
    })
  })

  socket.on("card-deleted", socketRateLimiter("card-deleted", 10), (data) => {
    socket.to(`board-${data.boardId}`).emit("card-deleted", {
      ...data,
      deletedBy: {
        _id: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      }
    })
  })

  socket.on("card-moved", socketRateLimiter("card-moved", 50), (data) => {
    socket.to(`board-${data.boardId}`).emit("card-moved", {
      ...data,
      movedBy: {
        _id: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      }
    })
  })

  // List events with rate limiting
  socket.on("list-created", socketRateLimiter("list-created", 15), (data) => {
    socket.to(`board-${data.boardId}`).emit("list-created", {
      ...data,
      createdBy: {
        _id: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      }
    })
  })

  socket.on("list-updated", socketRateLimiter("list-updated", 15), (data) => {
    socket.to(`board-${data.boardId}`).emit("list-updated", {
      ...data,
      updatedBy: {
        _id: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      }
    })
  })

  socket.on("list-deleted", socketRateLimiter("list-deleted", 15), (data) => {
    socket.to(`board-${data.boardId}`).emit("list-deleted", {
      ...data,
      deletedBy: {
        _id: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      }
    })
  })
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
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

startServer();
