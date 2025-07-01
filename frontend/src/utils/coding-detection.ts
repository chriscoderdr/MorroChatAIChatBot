/**
 * Utility functions for detecting coding-related content in messages
 */

// Keywords that suggest coding-related queries
const CODING_KEYWORDS = [
  // Programming languages (excluding common English words like 'go', 'c', 'r')
  'javascript', 'typescript', 'python', 'java', 'php', 'ruby', 'rust', 'swift', 'kotlin',
  'golang', 'c++', 'c#', 'cpp',
  
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

// Patterns that suggest code blocks or technical content
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

/**
 * Detects if a message is likely coding-related based on keywords and patterns
 */
export function isCodingRelated(message: string): boolean {
  if (!message || typeof message !== 'string') {
    return false;
  }

  const lowerMessage = message.toLowerCase();
  
  // Check for explicit coding keywords with word boundaries for more precise matching
  const hasKeywords = CODING_KEYWORDS.some(keyword => {
    const keywordRegex = new RegExp(`\\b${keyword.replace(/[+]/g, '\\+')}\\b`, 'i');
    return keywordRegex.test(message);
  });
  
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
  
  // Check for common coding phrases - using word boundaries for more precise matching
  const codingPhrases = [
    /\bhow to code\b/,
    /\bwrite a program\b/,
    /\bcreate a function\b/,
    /\bsolve this problem\b/,
    /\balgorithm for\b/,
    /\bdata structure\b/,
    /\btime complexity\b/,
    /\bspace complexity\b/,
    /\boptimize this\b/,
    /\brefactor this\b/,
    /\bdebug this\b/,
    /\bfix this bug\b/,
    /\bprogramming help\b/,
    /\bcoding help\b/,
    /\bsoftware development\b/,
    /\bweb development\b/,
    /\bcode review\b/,
    /\breview.{0,10}code\b/,
    /\banalyze.{0,10}code\b/,
    /\boptimize.{0,10}code\b/,
    // Specific programming language contexts
    /\bgo programming\b/,
    /\bgo language\b/,
    /\blearn go\b/,
    /\bgo tutorial\b/,
    /\bc programming\b/,
    /\bc language\b/,
    /\blearn c\b/
  ];
  
  const hasCodingPhrases = codingPhrases.some(pattern => 
    pattern.test(lowerMessage)
  );
  
  return hasCodingPhrases;
}

/**
 * Detects if a response likely contains code based on its content
 */
export function responseContainsCode(response: string): boolean {
  if (!response || typeof response !== 'string') {
    return false;
  }
  
  // Check for code blocks
  if (/```[\s\S]*?```/.test(response)) {
    return true;
  }
  
  // Check for multiple inline code snippets
  const inlineCodeMatches = response.match(/`[^`]+`/g);
  if (inlineCodeMatches && inlineCodeMatches.length >= 3) {
    return true;
  }
  
  // Check for programming-related content indicators
  const codeIndicators = [
    'function',
    'const ',
    'let ',
    'var ',
    'class ',
    'import ',
    'export ',
    'return ',
    'console.log',
    'print(',
    'def ',
    'if (',
    'for (',
    'while (',
    '#!/'
  ];
  
  const hasCodeIndicators = codeIndicators.some(indicator => 
    response.includes(indicator)
  );
  
  return hasCodeIndicators;
}
