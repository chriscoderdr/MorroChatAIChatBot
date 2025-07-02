// planning.agent.ts - Creates a multi-step research plan
import { AgentRegistry } from "./agent-registry";
import { Logger } from "@nestjs/common";
import { ChatOpenAI } from "@langchain/openai";

AgentRegistry.register({
  name: "planning",
  description: "Creates a multi-step research plan for complex questions.",
  handle: async (input, context, callAgent) => {
    const logger = new Logger('PlanningAgent');
    try {
      const { llm, chatHistory } = context;

      if (!llm) {
        logger.warn('LLM not available for planning agent.');
        return { output: '[]' }; // Return empty plan
      }

      const history = chatHistory?.map((msg: any) => `${msg._getType()}: ${msg.content}`).join('\n') || 'No history';

      const prompt = `You are a master research strategist. Your task is to create a step-by-step research plan to answer the user's query. The plan should be a JSON array of search queries.

**User's Query:**
"${input}"

**Conversation History:**
${history}

**Instructions:**
1.  Analyze the user's query and the conversation history to understand the user's goal.
2.  Break down the research process into logical steps.
3.  For each step, create a specific, targeted search query for the 'web_search' tool.
4.  Start with a broad query to gather general context.
5.  Then, create more specific queries to find details like names, dates, or lists.
6.  If reliable sources like Wikipedia or government sites are mentioned or likely to have the answer, create queries that target them specifically (e.g., "list of signers of US constitution site:en.wikipedia.org").
7.  The final step should always be a query to find a comprehensive list or summary.
8.  Return the plan as a JSON array of strings, where each string is a search query.
9.  **IMPORTANT**: Your output MUST be only the JSON array. No other text.

**Example Query:** "Tell me about the Apollo 11 mission. Who were the astronauts?"

**Example JSON Output:**
[
  "Apollo 11 mission summary",
  "Apollo 11 astronauts names",
  "What was Neil Armstrong's role in Apollo 11",
  "list of all astronauts on Apollo 11 mission wikipedia"
]

**JSON Plan:**`;

      let result;
      if (llm instanceof ChatOpenAI) {
        const boundLLM = llm.bind({ response_format: { type: "json_object" } });
        result = await boundLLM.invoke(prompt);
      } else {
        result = await llm.invoke(prompt);
      }
      
      let jsonOutput = result.content.toString().trim();
      
      // Handle cases where the LLM might still wrap the output in markdown
      const codeBlockMatch = jsonOutput.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        jsonOutput = codeBlockMatch[1];
      }

      logger.log(`Generated research plan: ${jsonOutput}`);
      return { output: jsonOutput, confidence: 0.98 };

    } catch (error) {
      logger.error(`Error in planning agent: ${error.message}`, error.stack);
      return { output: '[]' }; // Return empty plan on error
    }
  }
});

console.log('Planning agent registered successfully');
