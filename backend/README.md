# MorroChat Backend

A NestJS backend for the MorroChat application, a chatbot specialized in Dom### Chat API

- `POST /chat` - Send a message to the chatbot
  - Sessions are automatically managed using the browser's session ID
  - No separate chat session management needed
  - The backend handles all session tracking transparently
  - Returns just the AI response with no implementation details exposed

- `GET /chat/history` - Retrieve chat history for the current user
- `GET /history` - Alternative endpoint to retrieve chat historyd that uses Google's Gemini API.

## Technologies

- NestJS 11.x - A progressive Node.js framework
- MongoDB - NoSQL database for storing chat history
- Google Gemini - AI model for generating responses
- LangChain - Framework for working with LLMs
- Mongoose - ODM for MongoDB
- Swagger - API documentation

## Project Structure

```
# Throttle (rate limiting)
THROTTLE_TTL=30
THROTTLE_LIMIT=100

# AWS CloudWatch Logging (optional)
# CLOUDWATCH_LOG_GROUP=morrochat-logs
# CLOUDWATCH_LOG_STREAM=app
# AWS_REGION=eu-central-1
# AWS_ACCESS_KEY_ID=your_aws_access_key_id
# AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
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
# MongoDB connection options (use this for local Docker Compose)
MONGO_URI=mongodb://root:example@mongo:27017/morrochat?authSource=admin
MONGO_MAX_POOL_SIZE=10
MONGO_MIN_POOL_SIZE=2
MONGO_SOCKET_TIMEOUT_MS=45000
MONGO_CONNECT_TIMEOUT_MS=10000
MONGO_BUFFER_COMMANDS=false
GEMINI_API_KEY=your_gemini_api_key
CHAT_DEFAULT_TOPIC=Dominican Food
# Throttle (rate limiting)
THROTTLE_TTL=30
THROTTLE_LIMIT=100
```

### Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

### Running Tests

```bash
# Run agent unit tests
npm run test:agents

# Run functional API tests (requires running server)
npm run test:functional

# Run all tests
npm run test:all
```

See [TESTING.md](TESTING.md) for detailed information about the testing infrastructure.

### API Documentation

API documentation is available at `/api/docs` when the application is running.

## Features

- Chat with an AI assistant specialized in Dominican food
- Persistent chat history
- Rate limiting to prevent abuse (configurable via `THROTTLE_TTL` and `THROTTLE_LIMIT` in `.env`)
- Error handling and logging
- Swagger API documentation

## API Endpoints

### Chat API

- `POST /chat` - **Unified intelligent chat endpoint**
  - Automatically routes to the appropriate agent based on message content
  - **Code Analysis:** Send code in ```code``` blocks for analysis and optimization
  - **Research:** Ask questions requiring web search and summarization  
  - **Document Q&A:** Ask questions about uploaded PDFs
  - **Time/Weather:** Get current time and weather information
  - **General Chat:** Regular conversation and topic-specific questions
  - Sessions are automatically managed through cookies
  - No need for the frontend to track or pass session IDs
  - The session is created automatically on first request
  - Returns the AI response with intelligent agent selection

- `GET /chat/history` - Retrieve chat history for the current session (using cookie)
- `POST /chat/upload` - Upload PDF documents for analysis and Q&A

### Request Examples

```json
// Code Analysis
// POST /chat
{
  "message": "Optimize this function:\n```javascript\nfunction fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n-1) + fibonacci(n-2);\n}\n```"
}

// Research Question  
// POST /chat
{
  "message": "What are the latest developments in AI?"
}

// Document Question
// POST /chat  
{
  "message": "What are the key points in my uploaded PDF?"
}

// General Chat
// POST /chat
{
  "message": "Tell me about mangú"
}
```

### Response Example

```json
{
  "reply": "Based on code analysis, this fibonacci function uses recursion which can be optimized using dynamic programming..."
}
```

## License

This project is licensed under the MIT License.
