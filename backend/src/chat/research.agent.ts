// research.agent.ts
import { AgentRegistry } from "./agent-registry";

AgentRegistry.register({
  name: "research",
  description: "Performs comprehensive research by calling web_search agent and then summarizer agent to synthesize concise answers.",
  handle: async (input, context, callAgent) => {
    try {
      // Step 1: Call the web_search agent to gather information
      const searchResult = await callAgent("web_search", input, context);
      
      // Ensure searchResult.output is a string
      const searchOutput = typeof searchResult.output === 'string' 
        ? searchResult.output 
        : JSON.stringify(searchResult.output || '');
      
      if (!searchOutput || searchOutput.includes("Search failed") || searchOutput.trim().length < 10) {
        return {
          output: "I couldn't find reliable information about your question. Please try rephrasing or being more specific.",
          confidence: 0.2
        };
      }
      
      // Step 2: Always call summarizer to synthesize the search results
      const summaryPrompt = `Please provide a concise, informative summary of the following research results for the question: "${input}"

Research Results:
${searchOutput}

Instructions:
- Focus on directly answering the user's question
- Include key facts, dates, and relevant details
- Keep the summary clear and well-structured
- If multiple perspectives exist, mention them briefly`;

      const summaryResult = await callAgent("summarizer", summaryPrompt, context);
      
      // Step 3: Format the final research output
      const finalOutput = `## Research Summary

${summaryResult.output}

---
*Based on web research conducted on ${new Date().toLocaleDateString()}*`;
      
      // Calculate combined confidence
      const combinedConfidence = Math.min(0.95, 
        (searchResult.confidence ?? 0.7) * 0.6 + (summaryResult.confidence ?? 0.7) * 0.4
      );
      
      return {
        output: finalOutput,
        confidence: combinedConfidence
      };
      
    } catch (error) {
      return {
        output: `Research failed: ${error.message}. Please try again with a different question.`,
        confidence: 0.1
      };
    }
  }
});
