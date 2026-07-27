# CareerTracker Backend

Production-ready REST API for CareerTracker application.

## Tech Stack

- Node.js & Express
- TypeScript
- MongoDB & Mongoose
- Redis & BullMQ
- JWT Authentication
- Swagger Documentation

## Architecture

- Clean Architecture
- SOLID Principles
- Repository Pattern
- Service Layer Architecture
- DTO Pattern
- Comprehensive Error Handling

## Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   ├── controllers/      # Request handlers
│   ├── database/         # Database connection
│   ├── jobs/             # Background jobs (BullMQ)
│   ├── middlewares/      # Express middlewares
│   ├── models/           # Mongoose models
│   ├── repositories/     # Data access layer
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   ├── types/            # TypeScript types
│   ├── utils/            # Utility functions
│   ├── validators/       # Zod schemas
│   ├── app.ts            # Express app setup
│   └── server.ts         # Server entry point
├── dist/                 # Compiled JavaScript
├── uploads/              # Uploaded files
└── logs/                 # Application logs
```

## Setup

### Prerequisites

- Node.js 18+
- MongoDB
- Redis

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp ../.env.example .env

# Update .env with your values

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Lint code
- `npm run lint:fix` - Lint and fix code
- `npm run format` - Format code with Prettier
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run typecheck` - Type check without emitting

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:5000/api-docs

## Environment Variables

See `.env.example` in the root directory for all required environment variables.

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## Docker

```bash
# Build image
docker build -t career-tracker-backend .

# Run container
docker run -p 5000:5000 career-tracker-backend
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `POST /api/auth/verify-email` - Verify email
- `GET /api/auth/google` - Google OAuth
- `GET /api/auth/me` - Get current user

### Applications
- `GET /api/applications` - Get all applications
- `GET /api/applications/:id` - Get application by ID
- `POST /api/applications` - Create application
- `PUT /api/applications/:id` - Update application
- `DELETE /api/applications/:id` - Delete application

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

### Reports
- `GET /api/reports` - Get reports
- `POST /api/reports/export/pdf` - Export to PDF
- `POST /api/reports/export/csv` - Export to CSV

### Reminders
- `GET /api/reminders` - Get all reminders
- `POST /api/reminders` - Create reminder

### Notifications
- `GET /api/notifications` - Get all notifications
- `PUT /api/notifications/:id/read` - Mark as read

### Admin
- `GET /api/admin/users` - Get all users
- `GET /api/admin/logs` - Get system logs

## Security Features

- Helmet.js for security headers
- Rate limiting
- Input validation with Zod
- MongoDB injection prevention
- XSS protection
- Password hashing with bcrypt
- JWT authentication
- Refresh token rotation
- CORS configuration

## License

MIT
