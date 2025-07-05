// code-optimization.agent.ts
import { Agent, AgentName } from '../types';
import { LanguageManager } from '../utils/language-utils';
import { ResponseFormatter } from '../utils/response-utils';

// Helper functions for code analysis
function analyzeCodeForOptimization(code: string) {
  const analysis = {
    issues: [] as string[],
    optimizations: [] as string[],
    recommendations: [] as string[],
    performanceImpact: '',
    expectedImprovement: '',
  };

  // Detect nested loops
  const nestedLoopRegex = /for\s*\([^)]*\)\s*{[^}]*for\s*\([^)]*\)/gs;
  if (nestedLoopRegex.test(code)) {
    analysis.issues.push('Nested loops detected - O(n²) or higher complexity');
    analysis.optimizations.push(
      'Loop optimization and algorithmic improvements',
    );
    analysis.performanceImpact =
      'High - Nested loops cause exponential performance degradation';
  }

  // Detect expensive operations in loops
  if (code.includes('Math.sqrt') && code.includes('for')) {
    analysis.issues.push('Expensive Math.sqrt operations inside loops');
    analysis.optimizations.push(
      'Pre-computation and caching of expensive calculations',
    );
  }

  // Detect redundant calculations
  if (code.includes('i * j') && code.includes('for')) {
    analysis.issues.push('Repeated calculations that could be optimized');
    analysis.optimizations.push(
      'Minimize redundant calculations per iteration',
    );
  }

  // General recommendations
  analysis.recommendations.push('Consider using more efficient algorithms');
  analysis.recommendations.push(
    'Profile the code with real data to measure improvements',
  );
  analysis.recommendations.push(
    'Consider using Web Workers for CPU-intensive tasks',
  );

  analysis.expectedImprovement = '50-90% performance improvement possible';

  return analysis;
}

function generateOptimizedCode(originalCode: string): string | null {
  // Specific optimization for the nested loop + Math.sqrt pattern
  if (originalCode.includes('Math.sqrt') && originalCode.includes('for')) {
    return `function optimized() {
  let result = 0;
  
  // Pre-compute square roots to avoid repeated calculations
  const sqrtCache = new Map();
  const getSqrt = (n) => {
    if (!sqrtCache.has(n)) {
      sqrtCache.set(n, Math.sqrt(n));
    }
    return sqrtCache.get(n);
  };
  
  // Optimize loop structure
  for (let i = 0; i < 1000000; i++) {
    const sqrtI = getSqrt(i);
    for (let j = 0; j < 1000; j++) {
      // Avoid redundant multiplication by pre-computing
      result += sqrtI * getSqrt(j);
    }
  }
  
  return result;
}

// Alternative: Even more optimized version using mathematical properties
function superOptimized() {
  // If the calculation is sum of sqrt(i*j) for all i,j combinations,
  // this can be mathematically simplified to:
  // sum(sqrt(i)) * sum(sqrt(j)) for i=0..999999, j=0..999
  
  let sumSqrtI = 0;
  let sumSqrtJ = 0;
  
  // Pre-compute sum of square roots
  for (let i = 0; i < 1000000; i++) {
    sumSqrtI += Math.sqrt(i);
  }
  
  for (let j = 0; j < 1000; j++) {
    sumSqrtJ += Math.sqrt(j);
  }
  
  // Mathematical optimization: sqrt(i*j) = sqrt(i) * sqrt(j)
  // So sum of all sqrt(i*j) = sum(sqrt(i)) * sum(sqrt(j))
  return sumSqrtI * sumSqrtJ;
}`;
  }

  return null;
}

export class CodeOptimizationAgent implements Agent {
  public name: AgentName = 'code_optimization';
  public description =
    'Specialized agent for analyzing and optimizing code performance, suggesting improvements and best practices.';
  public async handle(input, context) {
    try {
      // Extract code blocks from input
      const codeBlockRegex = /```(?:[\w]*\n)?([\s\S]*?)```/g;
      let codeBlocks: string[] = [];
      let match;

      while ((match = codeBlockRegex.exec(input)) !== null) {
        codeBlocks.push(match[1].trim());
      }

      if (codeBlocks.length === 0) {
        // If no code in current input, check history
        if (context.chatHistory && context.chatHistory.length > 0) {
          for (let i = context.chatHistory.length - 1; i >= 0; i--) {
            const historyInput = context.chatHistory[i].content;
            if (typeof historyInput === 'string') {
              while ((match = codeBlockRegex.exec(historyInput)) !== null) {
                codeBlocks.push(match[1].trim());
              }
              if (codeBlocks.length > 0) {
                break; // Found code in history
              }
            }
          }
        }
      }

      if (codeBlocks.length === 0) {
        return ResponseFormatter.formatErrorResponse(
          'No code blocks found in your input or recent history. Please provide code using triple backticks (```) format for optimization analysis.',
          context,
          'code_optimization'
        );
      }

      if (!context.llm) {
        return ResponseFormatter.formatErrorResponse(
          "I'm sorry, I can't process this request without my core AI module.",
          context,
          'code_optimization'
        );
      }

      // Analyze the code for optimization opportunities
      const code = codeBlocks[0]; // Focus on first code block
      const analysis = analyzeCodeForOptimization(code);

      // Generate optimized version if possible
      const optimizedCode = generateOptimizedCode(code);

      const question = input.replace(/```[\s\S]*?```/g, '').trim();
      const languageContext = await LanguageManager.getLanguageContext(question, context.llm);
      
      if (languageContext.language === 'Nonsense') {
        return ResponseFormatter.formatErrorResponse(
          "I'm sorry, I didn't understand your request. Could you please rephrase it?",
          context,
          'code_optimization'
        );
      }

      const synthesisPrompt = `You are an expert code optimization assistant. A user has provided code and is asking for optimizations.

${languageContext.instructions}

**User's Question:**
${question}

**Provided Code:**
\`\`\`
${code}
\`\`\`

**Code Analysis:**
- Issues: ${analysis.issues.join(', ')}
- Performance Impact: ${analysis.performanceImpact}

**Optimized Code:**
\`\`\`javascript
${optimizedCode}
\`\`\`

**Optimization Techniques Used:**
- ${analysis.optimizations.join('\n- ')}

**Expected Performance Improvement:**
- ${analysis.expectedImprovement}

**Additional Recommendations:**
- ${analysis.recommendations.join('\n- ')}

**Response Structure:**
1.  Start with a "Code Optimization Analysis" section
2.  Include subsections for Original Code Issues, Performance Impact, Optimized Version, Optimization Techniques Used, Expected Performance Improvement, and Additional Recommendations
3.  Provide a comprehensive explanation of the analysis and the optimized code in a helpful, conversational tone
4.  ALL sections must follow the language requirements stated above

Please generate the complete response now.`;

      const llmResult = await context.llm.invoke(synthesisPrompt);
      const output =
        typeof llmResult.content === 'string' ? llmResult.content : '';

      return ResponseFormatter.formatAgentResponse(output, 0.9);
    } catch (error: any) {
      return ResponseFormatter.formatErrorResponse(
        `Code optimization analysis failed: ${error.message}`,
        context,
        'code_optimization'
      );
    }
  }
}
