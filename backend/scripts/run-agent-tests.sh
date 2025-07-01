#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===================================================${NC}"
echo -e "${YELLOW}Running Agent Unit Tests${NC}"
echo -e "${YELLOW}===================================================${NC}"

# Navigate to the project root directory
cd "$(dirname "$0")/.."

# Run the agent-specific tests using Jest
npx jest src/chat/agents/tests --verbose

# Check if tests passed
if [ $? -eq 0 ]; then
  echo -e "\n${GREEN}✅ Agent Unit Tests PASSED${NC}"
else
  echo -e "\n${RED}❌ Agent Unit Tests FAILED${NC}"
  exit 1
fi
