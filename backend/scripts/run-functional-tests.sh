#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if the server is running
check_server() {
  curl -s http://localhost:3000/health > /dev/null
  return $?
}

# Save the session cookie
COOKIE_FILE="/tmp/morro_chat_tests_cookie.txt"
rm -f $COOKIE_FILE

echo -e "${YELLOW}===================================================${NC}"
echo -e "${YELLOW}Running Functional API Tests for Chat Agents${NC}"
echo -e "${YELLOW}===================================================${NC}"

# Check if the server is running
if ! check_server; then
  echo -e "${RED}Error: Server is not running. Start the server with 'npm run start:dev' first.${NC}"
  exit 1
fi

# Track test status
PASSED_TESTS=0
FAILED_TESTS=0
TOTAL_TESTS=0

# Function to run a test
run_test() {
  local agent_name=$1
  local message=$2
  local expected_pattern=$3
  local follow_up=${4:-false}
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  echo -e "\n${BLUE}Testing $agent_name agent...${NC}"
  echo -e "${BLUE}Message:${NC} $message"
  
  # Create the request payload
  local payload="{\"message\":\"$message\"}"
  
  # Send the request and save the response
  local response
  if [ "$follow_up" = "true" ]; then
    response=$(curl -s -X POST http://localhost:3000/api/chat \
      -H "Content-Type: application/json" \
      -b $COOKIE_FILE -c $COOKIE_FILE \
      -d "$payload")
  else
    response=$(curl -s -X POST http://localhost:3000/api/chat \
      -H "Content-Type: application/json" \
      -c $COOKIE_FILE \
      -d "$payload")
  fi
  
  # Extract the response message
  local message_response=$(echo $response | grep -o '"message":"[^"]*"' | sed 's/"message":"//;s/"$//')
  
  # Check if the response contains the expected pattern
  if echo "$message_response" | grep -q "$expected_pattern"; then
    echo -e "${GREEN}✅ $agent_name agent test PASSED${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    echo -e "${RED}❌ $agent_name agent test FAILED${NC}"
    echo -e "${RED}Expected pattern:${NC} $expected_pattern"
    echo -e "${RED}Actual response:${NC} $message_response"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
}

# Test time agent
run_test "Time" "What time is it?" "current time"

# Test weather agent
run_test "Weather" "What's the weather like in New York?" "temperature|weather|forecast"

# Test research agent
run_test "Research" "Who is the current president of the United States?" "Biden|President"

# Test document agent with PDF handling
run_test "Document" "Can you summarize my last uploaded PDF?" "document|summarize|PDF"

# Test follow-up question capability
run_test "Follow-up" "Can you tell me more about that?" "additional information|more details" "true"

# Test topic filtering
run_test "Topic Filtering" "Tell me a joke about politics" "cannot discuss politics|steer away from"

# Print summary
echo -e "\n${YELLOW}===================================================${NC}"
echo -e "${YELLOW}Test Summary:${NC}"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo -e "${BLUE}Total: $TOTAL_TESTS${NC}"

# Return appropriate exit code
if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "\n${GREEN}✅ All Functional API Tests PASSED${NC}"
  exit 0
else
  echo -e "\n${RED}❌ Some Functional API Tests FAILED${NC}"
  exit 1
fi
