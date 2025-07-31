const rateLimit = require("express-rate-limit");

// Rate limiting for Socket.io events
const socketRateLimit = new Map();

const socketRateLimiter = (eventName, maxRequests = 10, windowMs = 60000) => {
  return (socket, next) => {
    const userId = socket.user._id.toString();
    const key = `${userId}:${eventName}`;

    const now = Date.now();
    const windowStart = now - windowMs;

    if (!socketRateLimit.has(key)) {
      socketRateLimit.set(key, []);
    }

    const requests = socketRateLimit.get(key);

    // Remove old requests outside the window
    const recentRequests = requests.filter(
      (timestamp) => timestamp > windowStart
    );

    if (recentRequests.length >= maxRequests) {
      return next(new Error(`Rate limit exceeded for ${eventName}`));
    }

    // Add current request
    recentRequests.push(now);
    socketRateLimit.set(key, recentRequests);

    next();
  };
};

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, requests] of socketRateLimit.entries()) {
    const recentRequests = requests.filter(
      (timestamp) => now - timestamp < 60000
    );
    if (recentRequests.length === 0) {
      socketRateLimit.delete(key);
    } else {
      socketRateLimit.set(key, recentRequests);
    }
  }
}, 60000); // Clean up every minute

module.exports = { socketRateLimiter };
