// research.agent.ts - Model-based research agent with recursive search capability
import { AgentRegistry } from "./agent-registry";

AgentRegistry.register({
  name: "research",
  description: "Performs comprehensive web research using LLM intelligence to extract information and make follow-up searches when needed.",
  handle: async (input, context, callAgent) => {
    try {
      // Step 1: Get a research plan
      const planResult = await callAgent("planning", input, context);
      let plan: string[] = [];
      try {
        plan = JSON.parse(planResult.output);
      } catch (e) {
        console.error("Failed to parse research plan:", planResult.output);
        return { output: "I'm having trouble creating a research plan.", confidence: 0.2 };
      }

      if (!plan || plan.length === 0) {
        return { output: "I couldn't create a research plan for your request.", confidence: 0.3 };
      }

      // Step 2: Execute plan and re-evaluate at each step
      const researchHistory: { query: string, results: string }[] = [];
      let finalAnswer = "I was unable to find the information after several attempts.";
      let answerFound = false;

      for (const query of plan) {
        if (answerFound) break;

        console.log(`Executing research step: "${query}"`);
        const searchResult = await callAgent("web_search", query, context);
        const searchOutput = typeof searchResult.output === 'string' ? searchResult.output : JSON.stringify(searchResult.output || '');
        researchHistory.push({ query, results: searchOutput });

        const historyText = researchHistory.map((item, index) => `Search #${index + 1} (Query: "${item.query}"):\n${item.results}`).join('\n\n');

        const analysisPrompt = `You are an expert research analyst. Your goal is to determine if the user's question can be answered from the research so far.

**User's Original Question:**
"${input}"

**Full Search History:**
${historyText}

**Instructions:**
1.  Review the search history to see if you have a complete answer to the user's question.
2.  If you have the complete answer (e.g., a full list of names, a specific date), set "answerFound" to true.
3.  The "answer" field should contain the most complete answer you can give right now, even if it's partial.
4.  Respond in JSON format only.

**JSON Response Format:**
{
  "answerFound": boolean,
  "answer": "The answer so far...",
  "reasoning": "Briefly explain why the answer is complete or what is still missing."
}

**JSON Response:**`;

        const analysisResult = await callAgent("summarizer", analysisPrompt, context);
        
        try {
          let analysisJSON = analysisResult.output;
          const codeBlockMatch = analysisJSON.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
          if (codeBlockMatch && codeBlockMatch[1]) {
            analysisJSON = codeBlockMatch[1];
          }
          
          const analysis = JSON.parse(analysisJSON);
          finalAnswer = analysis.answer;
          if (analysis.answerFound) {
            answerFound = true;
          }
          console.log(`Research step analysis: ${analysis.reasoning}`);
        } catch (e) {
          console.error("Failed to parse analysis JSON:", analysisResult.output);
          // If parsing fails, assume it's a partial answer and continue
          finalAnswer = analysisResult.output;
        }
      }

      return {
        output: finalAnswer,
        confidence: answerFound ? 0.98 : 0.5
      };
      
    } catch (error) {
      return {
        output: `Sorry, I couldn't complete the research: ${error.message}.`,
        confidence: 0.1
      };
    }
  }
});
