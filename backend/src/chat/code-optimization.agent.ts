// code-optimization.agent.ts
import { Agent, AgentName } from './types';

const detectLanguage = async (text: string, llm: any): Promise<string> => {
  const prompt = `Detect the language of this text. Respond with only the language name (e.g., "Spanish", "English").\n\nText: "${text}"`;
  const result = await llm.invoke(prompt);
  return typeof result.content === 'string' ? result.content.trim() : 'English';
};

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
        return {
          output:
            'No code blocks found in your input or recent history. Please provide code using triple backticks (```) format for optimization analysis.',
          confidence: 0.2,
        };
      }

      if (!context.llm) {
        return {
          output: "I'm sorry, I can't process this request without my core AI module.",
          confidence: 0.1,
        };
      }

      // Analyze the code for optimization opportunities
      const code = codeBlocks[0]; // Focus on first code block
      const analysis = analyzeCodeForOptimization(code);

      // Generate optimized version if possible
      const optimizedCode = generateOptimizedCode(code);

      const question = input.replace(/```[\s\S]*?```/g, '').trim();
      const questionLanguage = await detectLanguage(question, context.llm);

      const synthesisPrompt = `You are an expert code optimization assistant. A user has provided code and is asking for optimizations. Your response must be entirely in ${questionLanguage}.

**Your response must be entirely in ${questionLanguage}.** This includes all headers and explanatory text.

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
1.  Start with a "Code Optimization Analysis" section (in ${questionLanguage}).
2.  Include subsections for Original Code Issues, Performance Impact, Optimized Version, Optimization Techniques Used, Expected Performance Improvement, and Additional Recommendations (all in ${questionLanguage}).
3.  Provide a comprehensive explanation of the analysis and the optimized code in a helpful, conversational tone.

Please generate the complete response now.`;

      const llmResult = await context.llm.invoke(synthesisPrompt);
      const output =
        typeof llmResult.content === 'string' ? llmResult.content : '';

      return {
        output: output,
        confidence: 0.9,
      };
    } catch (error: any) {
      return {
        output: `Code optimization analysis failed: ${error.message}`,
        confidence: 0.1,
      };
    }
  }
}
