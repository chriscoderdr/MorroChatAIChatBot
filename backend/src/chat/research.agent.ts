// research.agent.ts - Model-based research agent with recursive search capability
import { AgentRegistry } from "./agent-registry";

AgentRegistry.register({
  name: "research",
  description: "Performs comprehensive web research using LLM intelligence to extract information and make follow-up searches when needed.",
  handle: async (input, context, callAgent) => {
    try {
      let searchQuery = input;
      
      // Always try to infer the subject and its context from the conversation history
      const subjectResult = await callAgent("subject_inference", input, context);
      let inferredSubject = '';
      let inferredDescription = '';

      try {
        const subjectData = JSON.parse(subjectResult.output);
        inferredSubject = subjectData.subject || '';
        inferredDescription = subjectData.description || '';
      } catch (e) {
        console.warn("Could not parse subject inference JSON:", subjectResult.output);
      }

      if (inferredSubject) {
        console.log(`Inferred subject: "${inferredSubject}", Description: "${inferredDescription}"`);
        // Construct a more specific search query using the full context
        searchQuery = `${inferredSubject} ${inferredDescription} ${input}`;
        console.log(`Subject inference added context. New query: "${searchQuery}"`);
      }
      
      // Step 1: Initial web search
      const searchResult = await callAgent("web_search", searchQuery, context);
      
      const searchOutput = typeof searchResult.output === 'string' 
        ? searchResult.output 
        : JSON.stringify(searchResult.output || '');
      
      if (!searchOutput || searchOutput.includes("Search failed") || searchOutput.trim().length < 10) {
        return {
          output: "I couldn't find reliable information about your question. Please try rephrasing or being more specific.",
          confidence: 0.2
        };
      }

      // Step 2: Use LLM intelligence to extract and analyze information
      const analysisPrompt = `You are an expert research analyst. Your task is to analyze search results and extract relevant information to answer the user's question. If the information is incomplete, determine if a follow-up search is needed.
${inferredSubject ? `\nCRITICAL CONTEXT: The user is asking about "${inferredSubject} (${inferredDescription})". Prioritize information related to this specific entity.` : ''}

USER'S QUESTION: ${input}

SEARCH RESULTS: 
${searchOutput}

INSTRUCTIONS:
1. Carefully analyze the search results to find information that directly answers the user's question.
2. Extract specific facts, names, dates, and relevant details.
3. If the search results contain sufficient information to answer the question completely, provide a clear, conversational answer in the same language as the user's question.
4. If the information is incomplete or you need more specific details, indicate what additional search would be helpful by starting your response with "NEED_MORE_SEARCH: [specific search query]" followed by your partial answer.
5. Focus only on factual information from the search results. Do not make assumptions.
6. Provide natural, conversational responses without technical metadata.
7. DO NOT include any of the following in your response:
   - "THOUGHT:" sections
   - "ACTION:" sections 
   - "OBSERVATION:" sections
   - References to "web_search" or any technical tool details
   - Phrases like "According to the search results" or "The information shows"
8. Your answer should read as if you're directly answering the user with the information you found.
9. MOST IMPORTANT: Provide ONLY your final answer. Do not include any of your thinking process.

RESPONSE:`;

      // Call the summarizer with the analysis prompt - it will use LLM intelligence
      const analysisResult = await callAgent("summarizer", analysisPrompt, context);
      
      // Check if the LLM determined we need more specific information
      if (analysisResult.output.includes("NEED_MORE_SEARCH:")) {
        const lines = analysisResult.output.split('\n');
        const searchLine = lines.find(line => line.includes("NEED_MORE_SEARCH:"));
        
        if (searchLine) {
          const additionalQuery = searchLine.replace("NEED_MORE_SEARCH:", "").trim();
          
          if (additionalQuery && additionalQuery.length > 3) {
            // Recursive call: search for more specific information
            const additionalSearchResult = await callAgent("web_search", additionalQuery, context);
            
            // Safely handle the additionalSearchResult.output
            const additionalOutput = typeof additionalSearchResult.output === 'string'
              ? additionalSearchResult.output
              : JSON.stringify(additionalSearchResult.output || '');
              
            if (additionalOutput && !additionalOutput.includes("Search failed") && additionalOutput.trim().length > 10) {
              // Combine both search results and re-analyze
              const combinedPrompt = `You are an expert research analyst. Analyze the combined search results to provide a comprehensive answer.
${inferredSubject ? `\nCRITICAL CONTEXT: The user is asking about "${inferredSubject} (${inferredDescription})". Prioritize information related to this specific entity.` : ''}

USER'S QUESTION: ${input}

INITIAL SEARCH RESULTS: 
${searchOutput}

ADDITIONAL SEARCH RESULTS:
${additionalOutput}

INSTRUCTIONS:
1. Combine information from both search results to provide a complete answer.
2. Extract specific facts, names, dates, and relevant details.
3. Provide a clear, conversational answer in the same language as the user's question.
4. Focus only on factual information from the search results.
5. Do not include "NEED_MORE_SEARCH" in your response - provide the final answer.
6. DO NOT include any of the following in your response:
   - "THOUGHT:" sections
   - "ACTION:" sections 
   - "OBSERVATION:" sections
   - References to "web_search" or any technical tool details
   - Phrases like "According to the search results" or "The information shows"
7. Your answer should read as if you're directly answering the user with the information you found.
8. MOST IMPORTANT: Provide ONLY your final answer. Do not show your thinking process.
9. Your final answer must be in the same language as the user's question.

RESPONSE:`;

              const finalAnalysisResult = await callAgent("summarizer", combinedPrompt, context);
              
              return {
                output: finalAnalysisResult.output.replace(/NEED_MORE_SEARCH:.*$/gm, '').trim(),
                confidence: Math.min(0.95, (searchResult.confidence ?? 0.7) + 0.2)
              };
            }
          }
        }
      }
      
      // Clean up the response to ensure it's user-friendly
      let cleanOutput = analysisResult.output
        // Remove the NEED_MORE_SEARCH directive if present
        .replace(/NEED_MORE_SEARCH:.*$/gm, '')
        // First, extract just the FINAL ANSWER section if it exists
        .replace(/^[\s\S]*?FINAL ANSWER:\s*([\s\S]*)$/i, '$1')
        // Then remove any remaining agent internal monologue
        .replace(/^THOUGHT:.*?(?=ACTION:|OBSERVATION:|FINAL ANSWER:|$)/gsm, '')
        .replace(/^ACTION:.*?(?=OBSERVATION:|THOUGHT:|FINAL ANSWER:|$)/gsm, '')
        .replace(/^OBSERVATION:.*?(?=ACTION:|THOUGHT:|FINAL ANSWER:|$)/gsm, '')
        .replace(/^Executing web_search.*?(?=\n|$)/gmi, '')
        .replace(/^I'll search for.*?(?=\n|$)/gmi, '')
        .replace(/^I need to search.*?(?=\n|$)/gmi, '')
        .replace(/THOUGHT:/gi, '')
        .replace(/ACTION:/gi, '')
        .replace(/OBSERVATION:/gi, '')
        .replace(/According to the search results,?\s*/gi, '')
        .replace(/Based on the search results,?\s*/gi, '')
        .replace(/The search results indicate,?\s*/gi, '')
        .replace(/From the information provided,?\s*/gi, '')
        .trim();
      
      // Return the clean response
      return {
        output: cleanOutput,
        confidence: searchResult.confidence ?? 0.7
      };
      
    } catch (error) {
      return {
        output: `Sorry, I couldn't complete the search: ${error.message}. Please try again with a different question.`,
        confidence: 0.1
      };
    }
  }
});
