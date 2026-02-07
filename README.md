# RWA Lending Protocol Backend

Backend services for the Real World Asset (RWA) Lending Protocol.

## Architecture

This backend service provides:
- RESTful API endpoints for frontend communication
- Database operations for user, asset, and loan management
- Blockchain integration for Sui network
- Authentication and authorization services
- Real-time notifications and updates
- Asset verification and valuation services

## Directory Structure

```
backend/
├── src/
│   ├── controllers/     # API route handlers
│   ├── services/       # Business logic services
│   ├── models/         # Database models
│   ├── middleware/     # Express middleware
│   ├── config/         # Configuration files
│   ├── utils/          # Server-side utilities
│   └── types/          # Backend-specific types
├── tests/              # Backend tests
└── scripts/            # Utility scripts
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- MongoDB
- Redis
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration values.

4. Build the shared types:
```bash
cd ../shared-types && npm run build
```

5. Start the development server:
```bash
npm run dev
```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run type-check` - Run TypeScript type checking
- `npm run lint` - Run ESLint

## API Documentation

API documentation will be available at `/api/docs` when the server is running.

## Environment Variables

See `.env.example` for all required environment variables.

## Testing

Run the test suite:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Deployment

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

## Contributing

1. Follow the existing code structure and patterns
2. Write tests for new functionality
3. Update documentation as needed
4. Ensure all tests pass before submitting changes