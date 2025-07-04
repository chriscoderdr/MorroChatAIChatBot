import { Agent, AgentName } from '../types';
import { LanguageManager } from '../utils/language-utils';
import { ResponseFormatter } from '../utils/response-utils';

// Helper interfaces for code analysis
interface CodeAnalysis {
  languages: Set<string>;
  patterns: string[];
  complexity: string;
  issues: string[];
  summary: string;
}

// Helper functions for code analysis
const analyzeCode = async (
  codeBlocks: string[],
  llm: any,
): Promise<CodeAnalysis> => {
  const analysis: CodeAnalysis = {
    languages: new Set<string>(),
    patterns: [],
    complexity: 'medium',
    issues: [],
    summary: '',
  };

  const detectionPromises = codeBlocks.map(async (code) => {
    // Use more precise language detection for code
    const langPrompt = `You are a programming language detector. Analyze this code and respond with ONLY the name of the programming language in lowercase (e.g., "python", "javascript", "typescript", "java", etc). If unknown, respond with "unknown".

\`\`\`
${code}
\`\`\``;
    const langResult = await llm.invoke(langPrompt);
    const language = typeof langResult.content === 'string' 
      ? langResult.content.trim().toLowerCase().replace(/[^a-z\d+#]/g, '')  // Clean the response to just the language name
      : 'unknown';
    analysis.languages.add(language);
    return { code, language };
  });

  const detectedLanguages = await Promise.all(detectionPromises);

  const analysisPromises = detectedLanguages.map(async ({ code, language }) => {
    const analysisPrompt = `Analyze this ${language} code for patterns and potential issues.

Code:
\`\`\`${language}
${code}
\`\`\`

Respond with a JSON object with two keys: "patterns" (an array of strings) and "issues" (an array of strings).`;
    const analysisResult = await llm.invoke(analysisPrompt);
    const cleanedJson = stripMarkdown(
      typeof analysisResult.content === 'string' ? analysisResult.content : '',
    );
    const resultJson = JSON.parse(cleanedJson || '{}');
    analysis.patterns.push(...(resultJson.patterns || []));
    analysis.issues.push(...(resultJson.issues || []));
  });

  await Promise.all(analysisPromises);

  // Generate summary
  analysis.summary = generateCodeSummary(
    codeBlocks,
    Array.from(analysis.languages),
  );

  return analysis;
};

const stripMarkdown = (text: string): string => {
  return text.replace(/```json\n|```/g, '');
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

const detectLanguage = async (text: string, llm: any): Promise<string> => {
  try {
    const languageContext = await LanguageManager.getLanguageContext(text, llm);
    return languageContext.language;
  } catch (error) {
    return 'English'; // fallback
  }
};

const synthesizeAnswer = async (
  codeAnalysis: CodeAnalysis,
  externalContext: string,
  question: string,
  codeBlocks: string[],
  llm: any,
  language: string,
): Promise<string> => {
  const prompt = `You are an expert code assistant. A user has provided code, a question, and some analysis. Your task is to synthesize all this information into a single, helpful response in ${language}.

${(await LanguageManager.getLanguageContext(question, llm)).instructions}

**User's Question:**
${question}

**Provided Code:**
\`\`\`
${codeBlocks.join('\n\n')}
\`\`\`

**Code Analysis:**
- Summary: ${codeAnalysis.summary}
- Languages: ${Array.from(codeAnalysis.languages).join(', ')}
- Patterns Detected: ${codeAnalysis.patterns.join(', ')}
- Potential Issues: ${codeAnalysis.issues.join(', ')}

**Additional Context from Searches:**
${externalContext}

**Response Structure:**
1.  Start with a "Code Analysis" section (in ${language}).
2.  Include subsections for Summary, Languages, Patterns, and Issues (all in ${language}).
3.  Follow with an "Answer to Your Question" section (in ${language}).
4.  Provide a specific, helpful answer to the user's question, addressing the problem directly and offering a clear solution or explanation.
5.  If there is additional context, include a final section for it (in ${language}).

Please generate the complete response now.`;

  const result = await llm.invoke(prompt);
  return typeof result.content === 'string' ? result.content : '';
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

export class CodeInterpreterAgent implements Agent {
  public name: AgentName = 'code_interpreter';
  public description =
    'Analyzes, explains, and answers questions about existing code snippets provided by the user.';
  public async handle(input, context, callAgent) {
    try {
      // Parse input to extract code and question
      const codeBlockRegex = /```(?:[\w]*\n)?([\s\S]*?)```/g;
      let codeBlocks: string[] = [];
      let match;

      while ((match = codeBlockRegex.exec(input)) !== null) {
        codeBlocks.push(match[1].trim());
      }

      // Extract question (text outside code blocks)
      const question = input.replace(/```[\s\S]*?```/g, '').trim();

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
          'No code blocks found in your input or recent history. Please provide code using triple backticks (```) format.',
          context,
          'code_interpreter'
        );
      }

      if (!question) {
        return ResponseFormatter.formatErrorResponse(
          'Please provide a specific question about the code you submitted.',
          context,
          'code_interpreter'
        );
      }

      // Step 1: Analyze the code
      const codeAnalysis = await analyzeCode(codeBlocks, context.llm);

      // Step 2: Determine if external context is needed
      const needsExternalContext = shouldSearchForContext(
        question,
        codeAnalysis,
      );

      if (question.toLowerCase().includes('optimize')) {
        if (!callAgent) {
          return ResponseFormatter.formatErrorResponse(
            'Code optimization service is not available.',
            context,
            'code_interpreter'
          );
        }
        return callAgent('code_optimization', input, context);
      }

      let externalContext = '';
      let searchConfidence = 0;

      if (needsExternalContext.web) {
        if (!callAgent) {
          return ResponseFormatter.formatErrorResponse(
            'Web search service is not available.',
            context,
            'code_interpreter'
          );
        }
        // Call web_search agent for external information
        const searchQuery = buildSearchQuery(question, codeAnalysis);
        const searchResult = await callAgent(
          'search',
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

      // Detect language of the question
      const questionLanguage = await detectLanguage(question, context.llm);

      if (questionLanguage === 'Nonsense') {
        return ResponseFormatter.formatErrorResponse(
          "I'm sorry, I didn't understand your request. Could you please rephrase it?",
          context,
          'code_interpreter'
        );
      }

  // Step 3: Combine code analysis and search results for final answer
  const finalAnswer = await synthesizeAnswer(
    codeAnalysis,
    externalContext,
    question,
    codeBlocks,
    context.llm,
    questionLanguage,
  );

      // Calculate confidence based on code analysis and external search
      const codeConfidence = calculateCodeConfidence(codeBlocks, question);
      const combinedConfidence = externalContext
        ? codeConfidence * 0.6 + searchConfidence * 0.4
        : codeConfidence;

      return ResponseFormatter.formatAgentResponse(
        finalAnswer,
        Math.min(0.95, combinedConfidence)
      );
    } catch (error: any) {
      return ResponseFormatter.formatErrorResponse(
        `Code analysis failed: ${error.message}`,
        context,
        'code_interpreter'
      );
    }
  }
}
