# MorroChat Backend

A NestJS backend for the MorroChat application, a chatbot specialized in Dominican food that uses Google's Gemini API.

## Technologies

- NestJS 11.x - A progressive Node.js framework
- MongoDB - NoSQL database for storing chat history
- Google Gemini - AI model for generating responses
- LangChain - Framework for working with LLMs
- Mongoose - ODM for MongoDB
- Swagger - API documentation

## Project Structure

```
backend/
├── src/
│   ├── chat/                 # Chat feature module
│   │   ├── controllers/      # Route controllers
│   │   ├── dto/              # Data Transfer Objects
│   │   ├── interfaces/       # TypeScript interfaces
│   │   ├── repositories/     # Data access layer
│   │   ├── schemas/          # Mongoose schemas
│   │   ├── services/         # Business logic
│   │   └── chat.module.ts    # Module definition
│   ├── common/               # Common utilities and filters
│   ├── config/               # Application configuration
│   │   ├── app.config.ts     # App-specific config
│   │   ├── database.config.ts# Database connection config
│   │   ├── openai.config.ts  # AI config
│   │   └── config.module.ts  # Module definition
│   ├── app.controller.ts     # Main app controller
│   ├── app.module.ts         # Root module
│   ├── app.service.ts        # App service
│   └── main.ts               # Application entry point
├── test/                     # Tests
├── .env                      # Environment variables
├── .gitignore                # Git ignore file
├── nest-cli.json             # NestJS CLI config
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript config
└── README.md                 # Project documentation
```

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB running locally or a MongoDB Atlas account
- Google Gemini API key

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:

```
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://localhost:27017/morro_chat
GEMINI_API_KEY=your_gemini_api_key
CHAT_DEFAULT_TOPIC=Dominican Food
```

### Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

### API Documentation

API documentation is available at `/api/docs` when the application is running.

## Features

- Chat with an AI assistant specialized in Dominican food
- Persistent chat history
- Rate limiting to prevent abuse
- Error handling and logging
- Swagger API documentation

## License

This project is licensed under the MIT License.
