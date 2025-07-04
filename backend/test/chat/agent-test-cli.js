#!/usr/bin/env node
/**
 * Agent Test CLI
 * 
 * This script provides a command-line interface for testing MorroChat agents.
 * It can be used to quickly test individual agents or the complete chat flow.
 * 
 * Usage:
 *   node agent-test-cli.js [command] [options]
 * 
 * Commands:
 *   time      - Test the time agent
 *   weather   - Test the weather agent
 *   research  - Test the research agent
 *   document  - Test the document agent
 *   topic     - Test topic filtering
 *   all       - Run all tests (default)
 * 
 * Options:
 *   --verbose     - Show detailed output
 *   --cookies=<file> - Use a specific cookies file
 *   --host=<url>  - API host (default: http://localhost:3000)
 * 
 * Examples:
 *   node agent-test-cli.js time
 *   node agent-test-cli.js weather --verbose
 *   node agent-test-cli.js research --cookies=cookies_new.txt
 *   node agent-test-cli.js all --host=http://api.example.com
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');

// Default configuration
const config = {
  host: 'http://localhost:3000',
  cookiesFile: path.join(__dirname, '..', '..', 'cookies_test.txt'),
  verbose: false,
  command: 'all'
};

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length > 0) {
  // First non-flag argument is the command
  const commandArg = args.find(arg => !arg.startsWith('--'));
  if (commandArg) {
    config.command = commandArg;
    
    // Remove the command from args for further processing
    args.splice(args.indexOf(commandArg), 1);
  }
  
  // Process flags
  args.forEach(arg => {
    if (arg === '--verbose') {
      config.verbose = true;
    } else if (arg.startsWith('--cookies=')) {
      config.cookiesFile = path.resolve(arg.replace('--cookies=', ''));
    } else if (arg.startsWith('--host=')) {
      config.host = arg.replace('--host=', '');
    }
  });
}

// Test cases for different agents
const tests = {
  time: [
    { name: 'Basic Time Query', message: 'What time is it in Santo Domingo?' },
    { name: 'Time Comparison', message: 'Compare time between New York and Tokyo' },
  ],
  weather: [
    { name: 'Basic Weather Query', message: 'What\'s the weather in Santo Domingo?' },
    { name: 'Specific Weather Detail', message: 'Is it raining in London right now?' },
  ],
  research: [
    { name: 'Company Founding', message: 'When was Soluciones GBH founded?' },
    { name: 'Founder Query', message: 'Who founded Soluciones GBH?' },
    { name: 'Follow-up Query', message: 'Where are they located?' },
  ],
  document: [
    { name: 'Document Upload', type: 'upload', file: 'sample_account_details.pdf', message: 'What is this document about?' },
    { name: 'Document Question', message: 'What details does the document have?' },
    { name: 'Specific Data Extraction', message: 'What is the ACH route in the file?' },
    { name: 'Bank Information', message: 'What is the bank in the file?' },
  ],
  topic: [
    { name: 'On-Topic Query', message: 'Tell me about Dominican food' }, // Assuming CHAT_DEFAULT_TOPIC="Dominican Food"
    { name: 'Off-Topic Query', message: 'Talk me about baseball' },
    { name: 'On-Topic Recipe', message: 'How do I cook mangú?' },
  ],
  profanity: [
    { name: 'Profane Query', message: 'fuck you' },
    { name: 'Another Profane Query', message: 'what the fuck' },
  ],
  nonsense: [
    { name: 'Nonsense Query', message: 'asdfasdfasdf' },
    { name: 'Another Nonsense Query', message: '23452345' },
  ]
};

// Helper for colored console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Helper function to load cookies
function loadCookies() {
  try {
    if (fs.existsSync(config.cookiesFile)) {
      const content = fs.readFileSync(config.cookiesFile, 'utf8');
      const match = content.match(/browserSessionId=([^;]+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch (error) {
    console.error(`${colors.red}Error loading cookies: ${error.message}${colors.reset}`);
  }
  return null;
}

// Helper function to save cookies
function saveCookies(cookies) {
  try {
    if (cookies) {
      const match = cookies.match(/browserSessionId=([^;]+)/);
      if (match && match[1]) {
        fs.writeFileSync(config.cookiesFile, `browserSessionId=${match[1]}`);
        return match[1];
      }
    }
  } catch (error) {
    console.error(`${colors.red}Error saving cookies: ${error.message}${colors.reset}`);
  }
  return null;
}

// Helper function for API calls
async function makeRequest(endpoint, method = 'GET', body = null, includeSessionId = true) {
  const url = `${config.host}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  // Add session cookie if available and requested
  if (includeSessionId) {
    const sessionId = loadCookies();
    if (sessionId) {
      options.headers.Cookie = `browserSessionId=${sessionId}`;
    }
  }
  
  // Add body for POST requests
  if (method === 'POST' && body) {
    options.body = JSON.stringify(body);
  }
  
  if (config.verbose) {
    console.log(`${colors.dim}Request: ${method} ${url}${colors.reset}`);
    if (body) console.log(`${colors.dim}Body: ${JSON.stringify(body)}${colors.reset}`);
  }
  
  try {
    const response = await fetch(url, options);
    
    // Save cookies from response if present
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      saveCookies(setCookie);
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`${colors.red}API Error: ${error.message}${colors.reset}`);
    return null;
  }
}

// Helper function for file uploads
async function uploadFile(filePath, message) {
  const url = `${config.host}/chat/upload`;
  const form = new FormData();
  
  try {
    // Add file to form data
    const fileBuffer = fs.readFileSync(filePath);
    form.append('file', fileBuffer, {
      filename: path.basename(filePath),
      contentType: 'application/pdf'
    });
    
    // Add message if provided
    if (message) {
      form.append('message', message);
    }
    
    // Add session cookie if available
    const sessionId = loadCookies();
    const headers = form.getHeaders();
    if (sessionId) {
      headers.Cookie = `browserSessionId=${sessionId}`;
    }
    
    if (config.verbose) {
      console.log(`${colors.dim}Uploading ${filePath} to ${url}${colors.reset}`);
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: form
    });
    
    // Save cookies from response if present
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      saveCookies(setCookie);
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`${colors.red}Upload Error: ${error.message}${colors.reset}`);
    return null;
  }
}

// Helper function to test a chat message
async function testChatMessage(message, testName) {
  console.log(`${colors.cyan}Testing: ${colors.bright}${testName}${colors.reset}`);
  console.log(`${colors.blue}Message: "${message}"${colors.reset}`);
  
  try {
    const response = await makeRequest('/chat', 'POST', { message });
    
    if (response && response.reply) {
      console.log(`${colors.green}Response: "${response.reply}"${colors.reset}`);
      
      // Check for telltale signs of exposed agent internals
      const internalPatterns = [
        /THOUGHT:/i, /ACTION:/i, /OBSERVATION:/i, /web_search/i,
        /According to (the|my) (search|) results/i
      ];
      
      const hasInternalPatterns = internalPatterns.some(pattern => 
        pattern.test(response.reply)
      );
      
      if (hasInternalPatterns) {
        console.log(`${colors.red}Warning: Response may contain exposed agent internals${colors.reset}`);
      }
      
      return response.reply;
    } else {
      console.log(`${colors.red}Error: Invalid response${colors.reset}`);
      return null;
    }
  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    return null;
  }
}

// Helper function to test file upload
async function testDocumentUpload(filePath, message, testName) {
  console.log(`${colors.cyan}Testing: ${colors.bright}${testName}${colors.reset}`);
  console.log(`${colors.blue}Uploading: ${filePath}${colors.reset}`);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log(`${colors.red}Error: File not found: ${filePath}${colors.reset}`);
    return null;
  }
  
  try {
    const response = await uploadFile(filePath, message);
    
    if (response) {
      console.log(`${colors.green}Upload successful: ${response.filename}${colors.reset}`);
      
      if (response.answer) {
        console.log(`${colors.green}Answer: "${response.answer}"${colors.reset}`);
      }
      
      return response;
    } else {
      console.log(`${colors.red}Error: Invalid upload response${colors.reset}`);
      return null;
    }
  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    return null;
  }
}

// Function to create a new session
async function createNewSession() {
  console.log(`${colors.cyan}Creating new session...${colors.reset}`);
  
  try {
    const response = await makeRequest('/chat/new', 'POST', {}, false);
    
    if (response && response.success) {
      console.log(`${colors.green}New session created successfully${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}Error creating new session${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    return false;
  }
}

// Function to check session history
async function checkHistory() {
  console.log(`${colors.cyan}Checking session history...${colors.reset}`);
  
  try {
    const response = await makeRequest('/chat/history');
    
    if (response && Array.isArray(response)) {
      console.log(`${colors.green}History found: ${response.length} messages${colors.reset}`);
      if (config.verbose && response.length > 0) {
        console.log(response);
      }
      return response;
    } else {
      console.log(`${colors.yellow}No history or invalid response${colors.reset}`);
      return [];
    }
  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    return [];
  }
}

// Function to run a test sequence
async function runTestSequence(testKey) {
  console.log(`\n${colors.bright}${colors.magenta}Running ${testKey} tests${colors.reset}\n`);
  
  const testList = tests[testKey];
  if (!testList) {
    console.error(`${colors.red}No tests defined for ${testKey}${colors.reset}`);
    return;
  }
  
  for (const test of testList) {
    if (test.type === 'upload') {
      const filePath = path.resolve(process.cwd(), test.file);
      await testDocumentUpload(filePath, test.message, test.name);
    } else {
      await testChatMessage(test.message, test.name);
    }
    console.log(); // Add a blank line between tests
    await new Promise(resolve => setTimeout(resolve, 1000)); // Short delay between tests
  }
}

// Main function
async function main() {
  console.log(`\n${colors.bright}${colors.yellow}=== MorroChat Agent Test CLI ===${colors.reset}`);
  console.log(`${colors.yellow}Host: ${config.host}${colors.reset}`);
  console.log(`${colors.yellow}Cookies: ${config.cookiesFile}${colors.reset}`);
  console.log(`${colors.yellow}Command: ${config.command}${colors.reset}\n`);
  
  // Create a new session
  await createNewSession();
  
  // Check initial history
  await checkHistory();
  
  // Run tests based on command
  if (config.command === 'all') {
    // Run all test sequences in order
    for (const testKey of Object.keys(tests)) {
      await runTestSequence(testKey);
    }
  } else if (tests[config.command]) {
    // Run specific test sequence
    await runTestSequence(config.command);
  } else {
    console.error(`${colors.red}Unknown command: ${config.command}${colors.reset}`);
    console.log(`${colors.yellow}Available commands: ${Object.keys(tests).join(', ')}, all${colors.reset}`);
  }
  
  // Check final history
  await checkHistory();
  
  console.log(`\n${colors.bright}${colors.green}Testing complete!${colors.reset}\n`);
}

// Run the main function
main().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});
