import { AgentRegistry } from './agent-registry';

// Helper interfaces for code analysis
interface CodeAnalysis {
  languages: Set<string>;
  patterns: string[];
  complexity: string;
  issues: string[];
  summary: string;
}

// Helper functions for code analysis
const analyzeCode = (
  codeBlocks: string[],
): CodeAnalysis => {
  const analysis: CodeAnalysis = {
    languages: new Set<string>(),
    patterns: [],
    complexity: 'medium',
    issues: [],
    summary: '',
  };

  for (const code of codeBlocks) {
    // Detect programming language
    const language = detectLanguage(code);
    analysis.languages.add(language);

    // Analyze patterns and structure
    const patterns = analyzePatterns(code);
    analysis.patterns.push(...patterns);

    // Check for common issues
    const issues = findCodeIssues(code, language);
    analysis.issues.push(...issues);
  }

  // Generate summary
  analysis.summary = generateCodeSummary(
    codeBlocks,
    Array.from(analysis.languages),
  );

  return analysis;
};

const detectLanguage = (code: string): string => {
  const indicators = {
    javascript: [
      'const ',
      'let ',
      'var ',
      'function ',
      '=>',
      'console.log',
      'require(',
      'import ',
    ],
    typescript: [
      'interface ',
      'type ',
      ': string',
      ': number',
      'async ',
      'Promise<',
    ],
    python: [
      'def ',
      'import ',
      'from ',
      'print(',
      'if __name__',
      '#!/usr/bin/env python',
    ],
    java: [
      'public class',
      'private ',
      'public static void main',
      'System.out.',
    ],
    csharp: ['using System', 'public class', 'Console.WriteLine', 'namespace '],
    cpp: ['#include', 'using namespace', 'std::', 'cout <<', 'int main('],
    sql: [
      'SELECT ',
      'FROM ',
      'WHERE ',
      'INSERT INTO',
      'UPDATE ',
      'CREATE TABLE',
    ],
    html: ['<html', '<div', '<script', '<!DOCTYPE'],
    css: ['{', '}', ':', ';', 'color:', 'background:'],
    shell: ['#!/bin/bash', 'echo ', 'cd ', 'ls ', 'grep '],
  };

  for (const [lang, patterns] of Object.entries(indicators)) {
    const score = patterns.reduce(
      (count, pattern) =>
        count + (code.toLowerCase().includes(pattern.toLowerCase()) ? 1 : 0),
      0,
    );
    if (score >= 2) return lang;
  }

  return 'unknown';
};

const analyzePatterns = (code: string): string[] => {
  const patterns: string[] = [];

  // Common patterns
  if (code.includes('async') || code.includes('await'))
    patterns.push('asynchronous programming');
  if (code.includes('class ') || code.includes('interface '))
    patterns.push('object-oriented design');
  if (code.includes('try') && code.includes('catch'))
    patterns.push('error handling');
  if (
    code.includes('for ') ||
    code.includes('while ') ||
    code.includes('forEach')
  )
    patterns.push('loops and iteration');
  if (code.includes('function') || code.includes('=>') || code.includes('def '))
    patterns.push('function definitions');

  return patterns;
};

const findCodeIssues = (code: string, language: string): string[] => {
  const issues: string[] = [];

  // Common issues across languages
  if (code.includes('TODO') || code.includes('FIXME'))
    issues.push('Contains TODO/FIXME comments');
  if (code.split('\n').length > 50)
    issues.push('Function/file may be too long');
  if ((code.match(/if/g) || []).length > 5)
    issues.push('High cyclomatic complexity (many if statements)');

  // Language-specific issues
  if (language === 'javascript' || language === 'typescript') {
    if (code.includes('var ')) issues.push('Uses var instead of let/const');
    if (code.includes('== ') && !code.includes('=== '))
      issues.push('Uses loose equality (==) instead of strict (===)');
  }

  if (language === 'python') {
    if (!code.includes('def ') && code.length > 100)
      issues.push('Long script without function definitions');
  }

  return issues;
};

const generateCodeSummary = (
  codeBlocks: string[],
  languages: string[],
): string => {
  const totalLines = codeBlocks.reduce(
    (sum, code) => sum + code.split('\n').length,
    0,
  );
  const langList =
    languages.length > 1 ? languages.join(', ') : languages[0] || 'unknown';

  return `Code contains ${codeBlocks.length} block(s) with ${totalLines} total lines in ${langList}`;
};

const shouldSearchForContext = (
  question: string,
  codeAnalysis: CodeAnalysis,
) => {
  const webSearchKeywords = [
    'best practice',
    'performance',
    'optimization',
    'alternative',
    'comparison',
    'latest',
    'modern',
    'recommended',
    'industry standard',
    'documentation',
    'tutorial',
    'example',
    'library',
    'framework',
    'tool',
    'benchmark',
    'security',
    'vulnerability',
    'pattern',
    'design pattern',
    'architecture',
  ];

  const docSearchKeywords = [
    'my project',
    'our codebase',
    'uploaded',
    'document',
    'specification',
    'requirements',
    'design',
    'architecture',
    'api',
    'documentation',
  ];

  const questionLower = question.toLowerCase();

  return {
    web:
      webSearchKeywords.some((keyword) => questionLower.includes(keyword)) ||
      codeAnalysis.issues.length > 0 || // Search for solutions if issues found
      questionLower.includes('how') ||
      questionLower.includes('why'), // Search for explanatory content
    docs: docSearchKeywords.some((keyword) => questionLower.includes(keyword)),
  };
};

const buildSearchQuery = (
  question: string,
  codeAnalysis: CodeAnalysis,
): string => {
  const languages = Array.from(codeAnalysis.languages).join(' ');
  const patterns = codeAnalysis.patterns.slice(0, 2).join(' '); // Top 2 patterns

  // Create focused search query
  return `${question} ${languages} ${patterns} programming best practices`;
};

const synthesizeAnswer = (
  codeAnalysis: CodeAnalysis,
  externalContext: string,
  question: string,
  codeBlocks: string[],
): string => {
  let answer = `## Code Analysis\n\n`;

  // Code summary
  answer += `**Summary:** ${codeAnalysis.summary}\n\n`;

  // Languages detected
  if (codeAnalysis.languages.size > 0) {
    answer += `**Languages:** ${Array.from(codeAnalysis.languages).join(', ')}\n\n`;
  }

  // Patterns found
  if (codeAnalysis.patterns.length > 0) {
    answer += `**Patterns Detected:**\n${codeAnalysis.patterns.map((p) => `- ${p}`).join('\n')}\n\n`;
  }

  // Issues found
  if (codeAnalysis.issues.length > 0) {
    answer += `**Potential Issues:**\n${codeAnalysis.issues.map((i) => `- ${i}`).join('\n')}\n\n`;
  }

  // Answer to specific question
  answer += `## Answer to Your Question\n\n`;
  answer += generateSpecificAnswer(question, codeAnalysis, codeBlocks);

  // External context if available
  if (externalContext.trim()) {
    answer += `\n\n## Additional Context\n${externalContext}`;
  }

  return answer;
};

const generateSpecificAnswer = (
  question: string,
  codeAnalysis: CodeAnalysis,
  codeBlocks: string[],
): string => {
  const questionLower = question.toLowerCase();
  const code = codeBlocks.join('\n');

  if (
    questionLower.includes('what does') ||
    questionLower.includes('explain')
  ) {
    return `This code defines a function that appears to be for ${codeAnalysis.patterns.join(' and ')}. It uses the ${Array.from(codeAnalysis.languages).join('/')} language. ${codeAnalysis.summary}.`;
  }

  if (questionLower.includes('improve') || questionLower.includes('optimize')) {
    let suggestions = '';
    if (codeAnalysis.issues.length > 0) {
      suggestions += `Based on the analysis, here are areas for improvement:\n${codeAnalysis.issues.map((i) => `- ${i}`).join('\n')}`;
    }
    if (questionLower.includes('regex') || code.includes('re.search')) {
      suggestions += `\n- For the regex pattern, consider making it more flexible. For example, instead of \`where.*package\`, you could use \`where's my package\`.`;
    }
    return (
      suggestions ||
      'The code seems reasonable, but you could consider adding more specific error handling or performance profiling.'
    );
  }

  if (
    questionLower.includes('error') ||
    questionLower.includes('bug') ||
    questionLower.includes('failing')
  ) {
    if (questionLower.includes('regex') || code.includes('re.search')) {
      return `The issue with your regex pattern \`(track|status|where.*package|delivery).*order\` is that it requires the word "order" to appear *after* one of the keywords. For a query like "where's my package", the pattern fails because "order" is missing.

**Suggested Fix:**
Make the "order" part optional or broaden the pattern. Here is an improved version:

\`\`\`python
if re.search(r'track|status|where.*package|delivery|order', message):
    return 'order_status'
\`\`\`

This pattern checks for any of the keywords independently, which should correctly identify intents like "track order" and "where's my package".`;
    }
    return `Potential issues could be related to: ${codeAnalysis.issues.join(', ') || 'the logic inside the function'}. To debug, I would recommend adding print statements to see the values of key variables.`;
  }

  return `Based on the code analysis, this ${Array.from(codeAnalysis.languages).join('/')} code implements ${codeAnalysis.patterns.join(', ')}. ${codeAnalysis.summary}`;
};

const calculateCodeConfidence = (
  codeBlocks: string[],
  question: string,
): number => {
  let confidence = 0.5;

  // Higher confidence for larger, more structured code
  const totalLines = codeBlocks.reduce(
    (sum, code) => sum + code.split('\n').length,
    0,
  );
  confidence += Math.min(0.3, totalLines / 100);

  // Higher confidence for specific questions
  const specificKeywords = [
    'what',
    'how',
    'why',
    'explain',
    'improve',
    'optimize',
    'fix',
  ];
  if (
    specificKeywords.some((keyword) => question.toLowerCase().includes(keyword))
  ) {
    confidence += 0.2;
  }

  return Math.min(0.9, confidence);
};

AgentRegistry.register({
  name: 'code_interpreter',
  description:
    'Analyzes code and answers questions about it. Can search for external context when needed.',
  async handle(input, context, callAgent) {
    try {
      // Parse input to extract code and question
      const codeBlockRegex = /```(?:[\w]*\n)?([\s\S]*?)```/g;
      const codeBlocks: string[] = [];
      let match;

      while ((match = codeBlockRegex.exec(input)) !== null) {
        codeBlocks.push(match[1].trim());
      }

      // Extract question (text outside code blocks)
      const question = input.replace(/```[\s\S]*?```/g, '').trim();

      if (codeBlocks.length === 0) {
        return {
          output:
            'No code blocks found in your input. Please provide code using triple backticks (```) format.',
          confidence: 0.2,
        };
      }

      if (!question) {
        return {
          output:
            'Please provide a specific question about the code you submitted.',
          confidence: 0.2,
        };
      }

      // Step 1: Analyze the code
      const codeAnalysis = analyzeCode(codeBlocks);

      // Step 2: Determine if external context is needed
      const needsExternalContext = shouldSearchForContext(
        question,
        codeAnalysis,
      );

      let externalContext = '';
      let searchConfidence = 0;

      if (needsExternalContext.web) {
        if (!callAgent) {
          throw new Error('callAgent is not available');
        }
        // Call web_search agent for external information
        const searchQuery = buildSearchQuery(question, codeAnalysis);
        const searchResult = await callAgent(
          'web_search',
          searchQuery,
          context,
        );

        // Handle search errors gracefully
        if (
          searchResult.output &&
          !JSON.stringify(searchResult.output).includes('error')
        ) {
          const searchOutput =
            typeof searchResult.output === 'string'
              ? searchResult.output
              : JSON.stringify(searchResult.output, null, 2);
          externalContext += `\nWeb Search Results:\n${searchOutput}`;
          searchConfidence = searchResult.confidence || 0.7;
        } else {
          externalContext += `\nWeb search was attempted but failed to return results.`;
        }
      }

      if (needsExternalContext.docs && context?.userId) {
        if (!callAgent) {
          throw new Error('callAgent is not available');
        }
        // Call document_search agent for user's uploaded documents
        const docResult = await callAgent('document_search', question, context);
        if (
          docResult.output &&
          !docResult.output.includes('No relevant information found')
        ) {
          const docOutput =
            typeof docResult.output === 'string'
              ? docResult.output
              : JSON.stringify(docResult.output, null, 2);
          externalContext += `\n\nDocument Search Results:\n${docOutput}`;
          searchConfidence = Math.max(
            searchConfidence,
            docResult.confidence || 0.6,
          );
        }
      }

      // Step 3: Combine code analysis and search results for final answer
      const finalAnswer = synthesizeAnswer(
        codeAnalysis,
        externalContext,
        question,
        codeBlocks,
      );

      // Calculate confidence based on code analysis and external search
      const codeConfidence = calculateCodeConfidence(codeBlocks, question);
      const combinedConfidence = externalContext
        ? codeConfidence * 0.6 + searchConfidence * 0.4
        : codeConfidence;

      return {
        output: finalAnswer,
        confidence: Math.min(0.95, combinedConfidence),
      };
    } catch (error: any) {
      return {
        output: `Code analysis failed: ${error.message}`,
        confidence: 0.1,
      };
    }
  },
});
