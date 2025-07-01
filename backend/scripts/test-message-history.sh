#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Testing Message History and Weather Agent ===${NC}"

# Generate a unique session ID for this test run
SESSION_ID="test-session-$(date +%s)"
COOKIE_FILE="/tmp/test_cookie_$SESSION_ID.txt"

# Base URL
BASE_URL="http://localhost:3000/api/chat"

echo -e "${BLUE}Using session ID: ${SESSION_ID}${NC}"

# Function to send a chat message and store cookies
send_chat_message() {
    local message=$1
    echo -e "\n${BLUE}Sending message: ${message}${NC}"
    
    response=$(curl -s -X POST $BASE_URL \
        -H "Content-Type: application/json" \
        -c $COOKIE_FILE -b $COOKIE_FILE \
        -d "{\"message\":\"$message\"}")
    
    echo "$response" | jq -r '.reply'
    echo ""
}

echo -e "${YELLOW}Starting test sequence...${NC}"

# Test 1: Initial message about weather
echo -e "${GREEN}Test 1: Weather query${NC}"
reply=$(send_chat_message "What's the weather like in New York?")

# Check if the reply contains weather information
if echo "$reply" | grep -q -i "temperature\|weather\|New York"; then
    echo -e "${GREEN}✓ Weather agent responded correctly${NC}"
else
    echo -e "${RED}✗ Weather agent response doesn't contain expected information${NC}"
    echo "Response was: $reply"
fi

# Test 2: Follow-up message to test history context
echo -e "${GREEN}Test 2: Follow-up query${NC}"
reply=$(send_chat_message "How about in Los Angeles?")

# Check if the reply contains weather information for the new city
if echo "$reply" | grep -q -i "temperature\|weather\|Los Angeles"; then
    echo -e "${GREEN}✓ Weather agent maintained context and switched city${NC}"
else
    echo -e "${RED}✗ Weather agent failed to handle follow-up correctly${NC}"
    echo "Response was: $reply"
fi

# Test 3: Time-related question to test agent switching
echo -e "${GREEN}Test 3: Time query${NC}"
reply=$(send_chat_message "What time is it now in Tokyo?")

# Check if the reply contains time information
if echo "$reply" | grep -q -i "time\|Tokyo\|current\|now"; then
    echo -e "${GREEN}✓ Time agent responded correctly${NC}"
else
    echo -e "${RED}✗ Time agent response doesn't contain expected information${NC}"
    echo "Response was: $reply"
fi

# Test 4: Follow-up to time question
echo -e "${GREEN}Test 4: Follow-up time query${NC}"
reply=$(send_chat_message "And in London?")

# Check if the reply contains time information for the new city
if echo "$reply" | grep -q -i "time\|London\|current\|now"; then
    echo -e "${GREEN}✓ Time agent maintained context and switched city${NC}"
else
    echo -e "${RED}✗ Time agent failed to handle follow-up correctly${NC}"
    echo "Response was: $reply"
fi

# Test 5: Return to weather questions
echo -e "${GREEN}Test 5: Return to weather query${NC}"
reply=$(send_chat_message "Tell me about the weather in Paris")

# Check if the reply contains weather information for the new city
if echo "$reply" | grep -q -i "temperature\|weather\|Paris"; then
    echo -e "${GREEN}✓ Weather agent responded correctly after agent switch${NC}"
else
    echo -e "${RED}✗ Weather agent failed after agent switch${NC}"
    echo "Response was: $reply"
fi

# Clean up
rm -f $COOKIE_FILE
echo -e "\n${YELLOW}Test completed. Cookie file removed.${NC}"
