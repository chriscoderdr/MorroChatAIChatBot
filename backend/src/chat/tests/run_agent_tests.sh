#!/bin/bash
# Agent Testing Script
# This script runs comprehensive tests for all agents in the system

# Display header
echo "============================================="
echo "  MorroChat Agent Integration Testing Suite  "
echo "============================================="

# Check if the server is running
if ! curl -s http://localhost:3000/health > /dev/null; then
  echo "Error: Server is not running on http://localhost:3000"
  echo "Please start the server first with 'npm run start:dev'"
  exit 1
fi

# Create the sample_account_details.pdf test file if it doesn't exist
if [ ! -f "$(pwd)/sample_account_details.pdf" ]; then
  echo "Creating sample PDF for testing..."
  
  # Simple way to create a test PDF - adjust based on available tools
  if command -v convert &> /dev/null; then
    # Using ImageMagick if available
    convert -size 612x792 -background white -fill black -pointsize 20 \
      -gravity center \
      label:'Sample Account Details\n\nAccount Number: 12345678\nRouting Number: 087654321\nBank Name: Test Bank\nAccount Type: Checking\nAccount Holder: Jane Doe' \
      "$(pwd)/sample_account_details.pdf"
  else
    # Alternative: create a simple text file with the content
    echo "Sample Account Details

Account Number: 12345678
Routing Number: 087654321
Bank Name: Test Bank
Account Type: Checking
Account Holder: Jane Doe" > "$(pwd)/sample_account_details.txt"
    
    echo "Note: Created text file instead of PDF. Install ImageMagick for PDF generation."
  fi
fi

# Run the test suite
echo "Running agent tests..."
NODE_ENV=test jest src/chat/tests/agent.spec.ts --detectOpenHandles --forceExit

# Output results
echo ""
echo "Test execution completed. Check the results above."
echo ""
echo "To run manual tests with curl, use:"
echo "curl -X POST http://localhost:3000/chat -H \"Content-Type: application/json\" -d '{\"message\": \"YOUR_TEST_QUESTION\"}' -b cookies.txt -c cookies.txt"
echo ""
echo "Sample test questions:"
echo "- How's the weather in Santo Domingo, Dominican Republic?"
echo "- What time is in Bangkok, Thailand?"
echo "- When was soluciones gbh founded?"
echo "- Tell me the current time in Santo Domingo, Dominican Republic and compare it with the current time in Buenos Aires, Argentina"
echo ""
