#!/bin/bash

# Create a .env file from example.env if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from example.env..."
    cp example.env .env
    echo "Please update the .env file with your actual configuration before running the application."
    exit 1
fi

# Get the AI provider from .env
AI_PROVIDER=$(grep "AI_PROVIDER=" .env | cut -d= -f2)
AI_PROVIDER=${AI_PROVIDER:-gemini}  # Default to gemini if not specified

# Check API keys based on the provider
if [ "$AI_PROVIDER" = "gemini" ]; then
    if ! grep -q "GEMINI_API_KEY=" .env || grep -q "GEMINI_API_KEY=$" .env || grep -q "GEMINI_API_KEY=your_gemini_api_key" .env; then
        echo "Error: GEMINI_API_KEY is not properly set in your .env file."
        echo "Please update the .env file with your actual Gemini API key and try again."
        exit 1
    fi
elif [ "$AI_PROVIDER" = "openai" ]; then
    if ! grep -q "OPENAI_API_KEY=" .env || grep -q "OPENAI_API_KEY=$" .env || grep -q "OPENAI_API_KEY=your_openai_api_key" .env; then
        echo "Error: OPENAI_API_KEY is not properly set in your .env file."
        echo "Please update the .env file with your actual OpenAI API key and try again."
        exit 1
    fi
else
    echo "Warning: Unknown AI_PROVIDER value: $AI_PROVIDER"
    echo "Supported providers are 'gemini' and 'openai'. Please check your .env file."
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Make sure required packages are installed
echo "Checking for required packages..."
required_packages=("zod" "uuid" "class-validator" "class-transformer" "@nestjs/swagger")
for pkg in "${required_packages[@]}"; do
    if ! grep -q "\"$pkg\":" node_modules/package.json 2>/dev/null; then
        echo "Installing missing package: $pkg"
        npm install --save $pkg
    fi
done

# Check if MongoDB URI is set to a local connection and if MongoDB is running
MONGO_URI=$(grep "MONGO_URI=" .env | cut -d= -f2)
if [[ $MONGO_URI == *"mongodb://localhost"* || $MONGO_URI == *"mongodb://127.0.0.1"* ]]; then
    echo "Checking if MongoDB is running locally..."
    # Try to connect to MongoDB using nc (netcat)
    if command -v nc &> /dev/null; then
        nc -z localhost 27017 &> /dev/null
        if [ $? -ne 0 ]; then
            echo "Warning: MongoDB does not appear to be running on localhost:27017."
            echo "Please start MongoDB before running the application, or update the MONGO_URI in .env to point to your MongoDB instance."
            read -p "Do you want to continue anyway? (y/n) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        else
            echo "MongoDB is running on localhost:27017."
        fi
    fi
fi

# Start the application in development mode
echo "Starting MorroChat backend in development mode..."
npm run start:dev
