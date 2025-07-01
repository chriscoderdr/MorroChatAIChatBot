// Test script for coding detection
const fs = require('fs');

// Read the TypeScript file and convert to JavaScript for testing
const tsContent = fs.readFileSync('./src/utils/coding-detection.ts', 'utf8');

// Extract the constants and function
const CODING_KEYWORDS = [
  // Programming languages
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin',
  
  // Programming concepts
  'code', 'function', 'method', 'class', 'algorithm', 'loop', 'array', 'object', 'variable',
  'syntax', 'debug', 'error', 'exception', 'compile', 'runtime', 'performance', 'optimize',
  
  // Code-related actions
  'refactor', 'review', 'analyze', 'fix', 'implement', 'develop', 'program', 'script',
  
  // Technical terms
  'api', 'database', 'query', 'framework', 'library', 'package', 'module', 'import',
  'async', 'await', 'promise', 'callback', 'recursion', 'iteration', 'regex', 'json',
  
  // Performance and complexity
  'complexity', 'big o', 'o(n)', 'memory', 'cpu', 'benchmark', 'efficient', 'slow', 'fast',
  
  // Development tools
  'git', 'npm', 'node', 'react', 'vue', 'angular', 'express', 'django', 'flask'
];

const CODE_PATTERNS = [
  /```[\s\S]*?```/g,           // Code blocks
  /`[^`]+`/g,                  // Inline code
  /\b[a-zA-Z_][a-zA-Z0-9_]*\(/g, // Function calls
  /\b(const|let|var|function|class|if|else|for|while|return)\b/g, // JS keywords
  /\b(def|import|from|class|if|else|for|while|return)\b/g, // Python keywords
  /\{[\s\S]*?\}/g,             // Code-like braces
  /\[[\s\S]*?\]/g,             // Array-like brackets
  /[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*/g, // Method calls
];

function isCodingRelated(message) {
  if (!message || typeof message !== 'string') {
    return false;
  }

  const lowerMessage = message.toLowerCase();
  
  // Check for explicit coding keywords
  const hasKeywords = CODING_KEYWORDS.some(keyword => 
    lowerMessage.includes(keyword.toLowerCase())
  );
  
  if (hasKeywords) {
    return true;
  }
  
  // Check for code patterns
  const hasCodePatterns = CODE_PATTERNS.some(pattern => 
    pattern.test(message)
  );
  
  if (hasCodePatterns) {
    return true;
  }
  
  // Check for common coding phrases
  const codingPhrases = [
    'how to code',
    'write a program',
    'create a function',
    'solve this problem',
    'algorithm for',
    'data structure',
    'time complexity',
    'space complexity',
    'optimize this',
    'refactor this',
    'debug this',
    'fix this bug',
    'programming help',
    'coding help',
    'software development',
    'web development'
  ];
  
  const hasCodingPhrases = codingPhrases.some(phrase => 
    lowerMessage.includes(phrase)
  );
  
  return hasCodingPhrases;
}

// Test the problematic message
console.log('=== TESTING CODING DETECTION ===');
const testMessage = 'what is the current time in santo domingo?';
console.log('Testing message:', testMessage);
console.log('isCodingRelated result:', isCodingRelated(testMessage));

// Test some coding messages
console.log('\n=== TESTING CODING MESSAGES ===');
const codingMessages = [
  'function test()',
  'optimize this code',
  'analyze this algorithm',
  'what is the time complexity?',
  'how to debug this?',
  'refactor this function',
  'review my JavaScript code'
];

codingMessages.forEach(msg => {
  console.log(`"${msg}": ${isCodingRelated(msg)}`);
});

// Test some non-coding messages
console.log('\n=== TESTING NON-CODING MESSAGES ===');
const nonCodingMessages = [
  'what is the current time in santo domingo?',
  'what is the weather like?',
  'tell me about machine learning',
  'plan a trip to paris',
  'what are the best restaurants?',
  'how is the economy doing?'
];

nonCodingMessages.forEach(msg => {
  console.log(`"${msg}": ${isCodingRelated(msg)}`);
});
