# BoardHub Server

This is the backend for BoardHub, a Trello clone built with Node.js, Express, and MongoDB.

## Environment Setup

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Update the values in `.env` with your actual credentials:

   - Get Google OAuth credentials from [Google Cloud Console](https://console.cloud.google.com)
   - Get GitHub OAuth credentials from [GitHub Developer Settings](https://github.com/settings/developers)
   - Set up MongoDB URI (local or Atlas)
   - Generate a secure JWT secret

3. Never commit the `.env` file to version control!

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB installed locally or a MongoDB Atlas account

### Installation

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the root of the server directory with the following variables:

```
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
NODE_ENV=development
```

### Running the Server

#### Development mode:

```bash
npm run dev
```

#### Production mode:

```bash
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login a user
- `GET /api/auth/me` - Get current user info (requires authentication)

### Boards

- `GET /api/boards` - Get all boards for the current user
- `GET /api/boards/:id` - Get a specific board
- `POST /api/boards` - Create a new board
- `PUT /api/boards/:id` - Update a board
- `DELETE /api/boards/:id` - Delete a board

### Lists

- `POST /api/boards/:boardId/lists` - Create a new list
- `PUT /api/lists/:id` - Update a list
- `DELETE /api/lists/:id` - Delete a list
- `PUT /api/boards/:boardId/lists/reorder` - Reorder lists

### Cards

- `POST /api/lists/:listId/cards` - Create a new card
- `PUT /api/cards/:id` - Update a card
- `DELETE /api/cards/:id` - Delete a card
- `PUT /api/cards/:id/move` - Move a card between lists

## Project Structure

- `server.js` - Entry point
- `config/` - Configuration files
- `routes/` - API routes
- `controllers/` - Route controllers
- `models/` - Database models
- `middleware/` - Custom middleware
- `utils/` - Utility functions
