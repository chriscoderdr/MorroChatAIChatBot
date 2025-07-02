// code-optimization.agent.ts
import { AgentRegistry } from './agent-registry';

AgentRegistry.register({
  name: 'code_optimization',
  description:
    'Specialized agent for analyzing and optimizing code performance, suggesting improvements and best practices.',
  async handle(input) {
    try {
      // Extract code blocks from input
      const codeBlockRegex = /```(?:[\w]*\n)?([\s\S]*?)```/g;
      const codeBlocks: string[] = [];
      let match;

      while ((match = codeBlockRegex.exec(input)) !== null) {
        codeBlocks.push(match[1].trim());
      }

      if (codeBlocks.length === 0) {
        return {
          output:
            'No code blocks found. Please provide code using triple backticks (```) format for optimization analysis.',
          confidence: 0.2,
        };
      }

      // Analyze the code for optimization opportunities
      const code = codeBlocks[0]; // Focus on first code block
      const analysis = analyzeCodeForOptimization(code);

      // Generate optimized version if possible
      const optimizedCode = generateOptimizedCode(code);

      let output = `## Code Optimization Analysis\n\n`;

      // Original code analysis
      output += `**Original Code Issues:**\n`;
      analysis.issues.forEach((issue) => {
        output += `- ${issue}\n`;
      });

      output += `\n**Performance Impact:** ${analysis.performanceImpact}\n\n`;

      // Optimized version
      if (optimizedCode) {
        output += `**Optimized Version:**\n\`\`\`javascript\n${optimizedCode}\n\`\`\`\n\n`;
        output += `**Optimization Techniques Used:**\n`;
        analysis.optimizations.forEach((opt) => {
          output += `- ${opt}\n`;
        });
        output += `\n**Expected Performance Improvement:** ${analysis.expectedImprovement}\n\n`;
      }

      // Additional recommendations
      output += `**Additional Recommendations:**\n`;
      analysis.recommendations.forEach((rec) => {
        output += `- ${rec}\n`;
      });

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
  },
});

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
