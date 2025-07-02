// research.agent.ts - A self-contained, intelligent research agent
import { AgentRegistry } from "./agent-registry";
import { Logger } from "@nestjs/common";
import { ChatOpenAI } from "@langchain/openai";

const logger = new Logger('ResearchAgent');

AgentRegistry.register({
  name: "research",
  description: "Performs multi-step, intelligent web research to answer complex questions.",
  handle: async (input, context, callAgent) => {
    const MAX_ITERATIONS = 5;
    let researchHistory: { query: string, results: string }[] = [];
    let currentQuery = input;
    let iteration = 0;

    // First, get the subject context to focus the research
    const subjectResult = await callAgent("subject_inference", input, context);
    let inferredSubject = '';
    try {
      const subjectData = JSON.parse(subjectResult.output);
      if (subjectData.subject) {
        inferredSubject = `The user is asking about "${subjectData.subject} (${subjectData.description})".`;
        // Prepend the context to the initial query
        currentQuery = `${subjectData.subject} ${subjectData.description} ${input}`;
        logger.log(`Research context added. Initial query: "${currentQuery}"`);
      }
    } catch (e) {
      logger.warn("Could not parse subject inference for research agent.");
    }

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      logger.log(`Research Iteration ${iteration}: Querying for "${currentQuery}"`);

      // Execute the web search
      const searchResult = await callAgent("web_search", currentQuery, context);
      const searchOutput = typeof searchResult.output === 'string' ? searchResult.output : JSON.stringify(searchResult.output || '');
      researchHistory.push({ query: currentQuery, results: searchOutput });

      // Analyze the cumulative results and decide the next step
      const historyText = researchHistory.map((item, index) => `Search #${index + 1} (Query: "${item.query}"):\n${item.results}`).join('\n\n---\n\n');

      const analysisPrompt = `You are a master research analyst. Your task is to analyze the provided research history and decide on the next action.

**User's Original Question:**
"${input}"

**Research Context:**
${inferredSubject}

**Research History (most recent is last):**
${historyText}

**Instructions:**
1.  Review the entire research history to understand what has been found.
2.  Determine if the user's question is fully and completely answered.
3.  If the answer is complete (e.g., you have the full list of names, the specific date, etc.), your next action is "FINISH".
4.  If the answer is not yet complete, your next action is "SEARCH".
5.  Based on your decision, respond with a JSON object with two keys: "nextAction" and "nextQueryOrFinalAnswer".
    *   If "nextAction" is "SEARCH", then "nextQueryOrFinalAnswer" must be the specific, targeted search query to find the missing information. Be smart: if a source like Wikipedia or an official archive is mentioned, target it.
    *   If "nextAction" is "FINISH", then "nextQueryOrFinalAnswer" must be the complete, final, conversational answer for the user, synthesized from the research history.
6.  Provide all answers in the same language as the user's original question.

**JSON Response (JSON only, no other text):**`;

      const llm = context.llm as ChatOpenAI;
      if (!llm) {
        return { output: "Research failed: LLM not available.", confidence: 0.1 };
      }

      const boundLLM = llm.bind({ response_format: { type: "json_object" } });
      const analysisResult = await boundLLM.invoke(analysisPrompt);
      
      try {
        let analysisJSON = analysisResult.content.toString().trim();
        const codeBlockMatch = analysisJSON.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          analysisJSON = codeBlockMatch[1];
        }
        
        const analysis = JSON.parse(analysisJSON);

        if (analysis.nextAction === "FINISH") {
          logger.log("Research complete. Returning final answer.");
          return { output: analysis.nextQueryOrFinalAnswer, confidence: 0.98 };
        } else if (analysis.nextAction === "SEARCH") {
          currentQuery = analysis.nextQueryOrFinalAnswer;
        } else {
          throw new Error("Invalid nextAction from analysis.");
        }
      } catch (e) {
        logger.error(`Failed to parse research analysis JSON: ${e.message}`, analysisResult.content);
        // If parsing fails, try to return the last known good information as a fallback.
        const lastGoodResult = researchHistory.slice(-1)[0]?.results;
        return { output: `I encountered an issue with my research process, but here is the last information I found: ${lastGoodResult}`, confidence: 0.4 };
      }
    }

    logger.warn("Research reached max iterations without a final answer. Synthesizing a summary of findings.");

    const historyText = researchHistory.map((item, index) => `Search #${index + 1} (Query: "${item.query}"):\n${item.results}`).join('\n\n---\n\n');

    const finalSummaryPrompt = `You are a helpful research assistant. You were unable to find a definitive final answer after several search attempts. Your task is to synthesize the research history into a single, helpful, conversational response for the user.

**User's Original Question:**
"${input}"

**Research Context:**
${inferredSubject}

**Full Research History:**
${historyText}

**Instructions:**
1.  Review the entire research history.
2.  Synthesize the most relevant information found across all searches.
3.  Formulate a single, clear, conversational answer for the user.
4.  Acknowledge that a complete answer could not be found, but present the information you did find in a helpful way.
5.  Do not include the raw search results or JSON in your response.
6.  Provide the answer in the same language as the user's original question.

**Final Answer:**`;

    const llm = context.llm as ChatOpenAI;
    if (!llm) {
      // Fallback to old behavior if LLM is not available for some reason
      const lastAnswer = researchHistory.slice(-1)[0]?.results;
      return {
        output: `I performed several searches but could not arrive at a definitive answer. Here is the most relevant information I found: ${lastAnswer}`,
        confidence: 0.5
      };
    }

    const finalSummaryResult = await llm.invoke(finalSummaryPrompt);
    const finalAnswer = finalSummaryResult.content.toString();

    return {
      output: finalAnswer,
      confidence: 0.6 // Confidence is a bit higher because it's a summarized answer
    };
  }
});
