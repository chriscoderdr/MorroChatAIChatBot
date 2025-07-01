#!/bin/bash
# Comprehensive Agent Testing Script
# This script tests all agents with real queries through the API

# Set terminal colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Display header
echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}  MorroChat Agent Functional Testing Suite  ${NC}"
echo -e "${BLUE}==================================================${NC}"

# Check if the server is running
if ! curl -s http://localhost:3000/health > /dev/null; then
  echo -e "${RED}Error: Server is not running on http://localhost:3000${NC}"
  echo -e "${YELLOW}Please start the server first with 'npm run start:dev'${NC}"
  exit 1
fi

# Ensure cookies file exists
touch cookies.txt

# Helper function to run a test query
run_test() {
  local description=$1
  local query=$2
  local expected_pattern=$3
  local timeout=${4:-30}
  
  echo -e "${BLUE}Testing:${NC} $description"
  echo -e "${YELLOW}Query:${NC} \"$query\""
  
  # Run the query with a timeout
  response=$(timeout $timeout curl -s -X POST http://localhost:3000/chat \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"$query\"}" \
    -b cookies.txt -c cookies.txt)
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}FAILED:${NC} Request timed out after ${timeout}s"
    echo ""
    return 1
  fi
  
  # Extract the reply from JSON
  reply=$(echo $response | grep -o '"reply":"[^"]*"' | cut -d':' -f2- | tr -d '"')
  
  # Check for expected pattern
  if echo "$reply" | grep -qi "$expected_pattern"; then
    echo -e "${GREEN}PASSED:${NC} Response contains expected pattern: '$expected_pattern'"
  else
    echo -e "${RED}FAILED:${NC} Expected pattern not found: '$expected_pattern'"
    echo -e "${YELLOW}Response:${NC} \"${reply:0:100}...\""
  fi
  
  # Check for thought process leaks
  if echo "$reply" | grep -qi "THOUGHT:\|ACTION:\|OBSERVATION:\|web_search\|Executing"; then
    echo -e "${RED}FAILED:${NC} Response contains agent thought process!"
  fi
  
  echo ""
}

echo -e "${YELLOW}Starting functional tests...${NC}"
echo ""

# Time Agent Tests
echo -e "${BLUE}=== Time Agent Tests ===${NC}"
run_test "Basic time query" "What time is it in Santo Domingo, Dominican Republic?" "time in Santo Domingo"
run_test "International time query" "What time is in Bangkok, Thailand?" "Bangkok"
run_test "Time comparison" "Tell me the current time in Santo Domingo and compare it with Buenos Aires" "Santo Domingo.*Buenos Aires|Buenos Aires.*Santo Domingo"

# Weather Agent Tests
echo -e "${BLUE}=== Weather Agent Tests ===${NC}"
run_test "Local weather query" "How's the weather in Santo Domingo, Dominican Republic?" "weather|temperature"
run_test "International weather query" "What's the weather like in Tokyo, Japan?" "Tokyo|Japan"

# Research Agent Tests
echo -e "${BLUE}=== Research Agent Tests ===${NC}"
run_test "Company founding query" "When was Soluciones GBH founded?" "2004|founded"
run_test "Founder follow-up query" "Who founded it?" "José|Bonetti|founder"
run_test "Location query" "Where is GBH located?" "Santo Domingo|Dominican"
run_test "Another company query" "When was Microsoft founded and by whom?" "Gates|Allen|1975"

# Topic Filtering Tests
TOPIC=$(grep "CHAT_DEFAULT_TOPIC" .env | cut -d '=' -f2- | tr -d '"')
if [ -n "$TOPIC" ]; then
  echo -e "${BLUE}=== Topic Filtering Tests (${TOPIC}) ===${NC}"
  run_test "Topic related query" "Talk me about $TOPIC" "$TOPIC"
  
  if [ "$TOPIC" == "Dominican Food" ]; then
    run_test "Specific topic query" "How do I cook mangú?" "plantain|plátano"
  fi
  
  # Determine an unrelated topic
  if [ "$TOPIC" == "Dominican Food" ]; then
    UNRELATED="beisbol"
  else
    UNRELATED="Quantum Physics"
  fi
  
  run_test "Unrelated topic query" "Talk me about $UNRELATED" "not related to|cannot assist with"
fi

# Check for PDF file for document tests
if [ -f "$(pwd)/sample_account_details.pdf" ]; then
  echo -e "${BLUE}=== Document Agent Tests ===${NC}"
  echo -e "${YELLOW}Uploading test PDF...${NC}"
  
  upload_result=$(curl -s -X POST http://localhost:3000/chat/upload \
    -F "file=@sample_account_details.pdf" \
    -F "message=What is this document about?" \
    -b cookies.txt -c cookies.txt)
  
  if echo "$upload_result" | grep -q "filename"; then
    echo -e "${GREEN}PDF uploaded successfully${NC}"
    
    run_test "Document content query" "What is this document about?" "account|bank"
    run_test "Document details query" "What details does it have?" "account|number"
    run_test "Document specific data query" "What is the ACH route in the file?" "routing|087654321"
    run_test "Document bank query" "What is the bank in the file?" "Test Bank|bank"
  else
    echo -e "${RED}PDF upload failed${NC}"
  fi
fi

echo -e "${BLUE}==================================================${NC}"
echo -e "${GREEN}Functional tests completed!${NC}"
echo -e "${BLUE}==================================================${NC}"
