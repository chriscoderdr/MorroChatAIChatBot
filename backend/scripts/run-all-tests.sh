#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===================================================${NC}"
echo -e "${YELLOW}Running Comprehensive Agent Testing Suite${NC}"
echo -e "${YELLOW}===================================================${NC}"

# Navigate to the project root directory
cd "$(dirname "$0")/.."

# Run unit tests first
echo -e "\n${BLUE}Step 1: Running Agent Unit Tests${NC}"
./scripts/run-agent-tests.sh
UNIT_TEST_RESULT=$?

# Run functional tests
echo -e "\n${BLUE}Step 2: Running Functional API Tests${NC}"
./scripts/run-functional-tests.sh
FUNCTIONAL_TEST_RESULT=$?

# Print overall summary
echo -e "\n${YELLOW}===================================================${NC}"
echo -e "${YELLOW}Overall Test Results:${NC}"

if [ $UNIT_TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}✅ Unit Tests: PASSED${NC}"
else
  echo -e "${RED}❌ Unit Tests: FAILED${NC}"
fi

if [ $FUNCTIONAL_TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}✅ Functional Tests: PASSED${NC}"
else
  echo -e "${RED}❌ Functional Tests: FAILED${NC}"
fi

# Final result
if [ $UNIT_TEST_RESULT -eq 0 ] && [ $FUNCTIONAL_TEST_RESULT -eq 0 ]; then
  echo -e "\n${GREEN}✅ ALL TESTS PASSED${NC}"
  exit 0
else
  echo -e "\n${RED}❌ SOME TESTS FAILED${NC}"
  exit 1
fi
