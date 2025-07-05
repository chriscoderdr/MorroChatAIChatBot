// research.agent.ts - A self-contained, intelligent research agent
import { Agent, AgentName } from '../types';
import { Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { LanguageManager } from '../utils/language-utils';

const logger = new Logger('ResearchAgent');

export class ResearchAgent implements Agent {
  public name: AgentName = 'research';
  public description =
    'Performs multi-step, intelligent web research to answer complex questions.';

  public async handle(input, context, callAgent) {
    const MAX_ITERATIONS = 5;
    const researchHistory: { query: string | object; results: string }[] = [];
    let currentQuery: string | object = input;
    let iteration = 0;
    let initialExclusions: string[] = [];
    let questionLanguage = 'English'; // Default language

    if (!callAgent) {
      throw new Error('callAgent is not available');
    }

    const llm = context.llm as ChatOpenAI;
    if (!llm) {
      return { output: 'Research failed: LLM not available.', confidence: 0.1 };
    }
    const boundLLMForJson = llm.bind({
      response_format: { type: 'json_object' },
    });

    // Step 1: Initial query analysis to extract topic and exclusions
    const queryAnalysisPrompt = `You are an expert at parsing user requests for research. Analyze the user's query and extract the core research topic and any domains they want to exclude.

**User's Query:**
"${input}"

**Instructions:**
Respond with a JSON object with two keys: "research_topic" and "exclude_sites".
*   "research_topic": The core question the user is asking.
*   "exclude_sites": An array of strings, where each string is a domain to be excluded (e.g., ["rt.com", "sputniknews.com"]). If no sites are mentioned for exclusion, provide an empty array.

**JSON Response (JSON only, no other text):**`;

    const queryAnalysisResult = await boundLLMForJson.invoke(
      queryAnalysisPrompt,
    );

    try {
      let analysisJSON = queryAnalysisResult.content.toString().trim();
      const codeBlockMatch = analysisJSON.match(
        /```(?:json)?\s*(\{[\s\S]*?\})\s*```/,
      );
      if (codeBlockMatch && codeBlockMatch[1]) {
        analysisJSON = codeBlockMatch[1];
      }
      const queryAnalysis = JSON.parse(analysisJSON);
      currentQuery = queryAnalysis.research_topic || input;
      initialExclusions = queryAnalysis.exclude_sites || [];
      logger.log(
        `Initial query parsed. Topic: "${currentQuery}", Exclusions: ${JSON.stringify(
          initialExclusions,
        )}`,
      );
    } catch (e) {
      logger.warn(
        'Could not parse initial query analysis. Proceeding with raw input.',
      );
      currentQuery = input;
    }

    // Step 2: Get subject context to focus the research
    const subjectResult = await callAgent('subject_inference', input, context);
    let inferredSubject = '';
    try {
      const subjectData = JSON.parse(subjectResult.output);
      if (subjectData.subject) {
        inferredSubject = `The user is asking about "${subjectData.subject} (${subjectData.description})".`;
        if (typeof currentQuery === 'string') {
          currentQuery = `${subjectData.subject} ${subjectData.description} ${currentQuery}`;
          logger.log(`Research context added. New query: "${currentQuery}"`);
        }
      }
    } catch (e) {
      logger.warn('Could not parse subject inference for research agent.');
    }

    // Step 3: Combine query with initial exclusions for the first search
    if (typeof currentQuery === 'string') {
      currentQuery = {
        query: currentQuery,
        exclude_sites: initialExclusions,
      };
    }

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      const queryLog =
        typeof currentQuery === 'string'
          ? currentQuery
          : JSON.stringify(currentQuery);
      logger.log(`Research Iteration ${iteration}: Querying for "${queryLog}"`);

      // Execute the web search
      if (!callAgent) {
        throw new Error('callAgent is not available');
      }
      // The search input is now potentially a structured object, which needs to be stringified.
      const searchInput =
        typeof currentQuery === 'string'
          ? currentQuery
          : JSON.stringify(currentQuery);
      const searchResult = await callAgent('search', searchInput, context);
      const searchOutput =
        typeof searchResult.output === 'string'
          ? searchResult.output
          : JSON.stringify(searchResult.output || '');
      researchHistory.push({ query: currentQuery, results: searchOutput });

      // Analyze the cumulative results and decide the next step
      const historyText = researchHistory
        .map((item, index) => {
          const queryText =
            typeof item.query === 'string'
              ? item.query
              : JSON.stringify(item.query);
          return `Search #${index + 1} (Query: "${queryText}"):\n${item.results}`;
        })
        .join('\n\n---\n\n');

      // Reuse same language detection from above
      const analysisPrompt = `You are a master research analyst. Your task is to analyze the provided research history and decide on the next action.

${(await LanguageManager.getLanguageContext(input, llm)).instructions}

**User's Original Question:**
"${input}"

**Research Context:**
${inferredSubject}

**Research History (most recent is last):**
${historyText}

**Instructions:**
1.  Review the entire research history to understand what has been found.
2.  Determine if the user's question is fully and completely answered.
3.  If the answer is complete, your next action is "FINISH".
4.  If the answer is not yet complete, your next action is "SEARCH".
5.  Based on your decision, respond with a JSON object containing the next action and its parameters.
    *   If "nextAction" is "SEARCH", the JSON should contain:
        *   "nextAction": "SEARCH"
        *   "nextQueryOrFinalAnswer": A specific, targeted search query.
        *   "exclude_sites" (optional): An array of domains to exclude from the next search if you identify low-quality or irrelevant sources (e.g., ["example.com", "another-site.org"]).
    *   If "nextAction" is "FINISH", the JSON should contain:
        *   "nextAction": "FINISH"
        *   "nextQueryOrFinalAnswer": A complete, final, and engaging answer for the user in ${questionLanguage}. Use markdown to format the answer with emojis, blockquotes, and bold text to make it more visually appealing. If any direct, factual answers were found, highlight them. At the end, include a "## 📚 Sources" section with a markdown-formatted list of the most relevant URLs.

**JSON Response (JSON only, no other text):**`;

      const analysisResult = await boundLLMForJson.invoke(analysisPrompt);

      try {
        let analysisJSON = analysisResult.content.toString().trim();
        const codeBlockMatch = analysisJSON.match(
          /```(?:json)?\s*(\{[\s\S]*?\})\s*```/,
        );
        if (codeBlockMatch && codeBlockMatch[1]) {
          analysisJSON = codeBlockMatch[1];
        }

        const analysis = JSON.parse(analysisJSON);

        if (analysis.nextAction === 'FINISH') {
          logger.log('Research complete. Returning final answer.');
          return { output: analysis.nextQueryOrFinalAnswer, confidence: 0.98 };
        } else if (analysis.nextAction === 'SEARCH') {
          // The next query can be a simple string or a structured object
          // including sites to exclude.
          currentQuery = {
            query: analysis.nextQueryOrFinalAnswer,
            exclude_sites: analysis.exclude_sites || [],
          };
        } else {
          throw new Error('Invalid nextAction from analysis.');
        }
      } catch (e) {
        logger.error(
          `Failed to parse research analysis JSON: ${e.message}`,
          analysisResult.content,
        );
        // If parsing fails, try to return the last known good information as a fallback.
        const lastGoodResult = researchHistory.slice(-1)[0]?.results;
        return {
          output: `I encountered an issue with my research process, but here is the last information I found: ${lastGoodResult}`,
          confidence: 0.4,
        };
      }
    }

    logger.warn(
      'Research reached max iterations without a final answer. Synthesizing a summary of findings.',
    );      const historyText = researchHistory
      .map(
        (item, index) =>
          `Search #${index + 1} (Query: "${item.query}"):\n${item.results}`,
      )
      .join('\n\n---\n\n');      // Detect language of user's question
      try {
        const languageContext = await LanguageManager.getLanguageContext(input, llm);
        questionLanguage = languageContext.language;
      } catch (e) {
        // fallback to English (already set as default)
        logger.warn('Language detection failed, falling back to English');
      }

      const finalSummaryPrompt = `You are a helpful research assistant. You were unable to find a definitive final answer after several search attempts. Your task is to synthesize the research history into a single, helpful, conversational response for the user.

${(await LanguageManager.getLanguageContext(input, llm)).instructions}

**User's Original Question:**
"${input}"

**Research Context:**
${inferredSubject}

**Full Research History:**
${historyText}

**Instructions:**
1.  Review the entire research history to synthesize the most relevant information.
2.  Formulate a single, clear, and engaging answer for the user. Use markdown to format the answer with emojis, blockquotes, and bold text to make it more visually appealing.
3.  If any direct, factual answers (like unit conversions, specific numbers, or hash values) were found, highlight them in your summary.
4.  Acknowledge that a complete answer could not be found, but present the information you did find in a helpful and visually appealing way.
5.  At the end of your answer, include a "## 📚 Sources" section with a markdown-formatted list of the most relevant URLs discovered.
6.  Do not include raw search results or JSON in your response.

**Final Answer in ${questionLanguage}:**`;

    const finalSummaryResult = await llm.invoke(finalSummaryPrompt);
    const finalAnswer = finalSummaryResult.content.toString();

    return {
      output: finalAnswer,
      confidence: 0.6, // Confidence is a bit higher because it's a summarized answer
    };
  }
}
