// research.agent.ts - Model-based research agent with recursive search capability
import { AgentRegistry } from "./agent-registry";

AgentRegistry.register({
  name: "research",
  description: "Performs comprehensive web research using LLM intelligence to extract information and make follow-up searches when needed.",
  handle: async (input, context, callAgent) => {
    try {
      // Check if this is a follow-up question and extract the entity from context
      let searchQuery = input;
      const isSpanish = /quién|quien|cuándo|cuando|qué|que|año|empresa|fundó|creó|dónde|donde|cómo|como|quiénes|quienes/.test(input.toLowerCase());
      
      // Detect abstract/short questions that are likely follow-ups
      const isLikelyFollowup = input.length < 30 && 
                               (input.includes('?') || 
                                input.match(/^(donde|dónde|cuando|cuándo|cómo|como|quién|quien|qué|que|cuánto|cuanto|cuál|cual)/i) ||
                                input.match(/(ubicad[ao]|fundad[ao]|cread[ao])/i));
      
      // For follow-up questions, try to extract entity from previous context
      if (isLikelyFollowup && context && context.chatHistory && Array.isArray(context.chatHistory)) {
        // Look at more recent messages for better context
        const recentMessages = context.chatHistory.slice(-8); 
        
        // Enhanced entity regex with more common entity types
        const entitiesRegex = /\b(?:Banco\s+de\s+\w+|Soluciones\s+\w+|GBH|empresa\s+\w+|\w+\s+Bank|\w+\s+Company|Universidad\s+\w+|University\s+of\s+\w+|[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/gi;
        
        // Check if this is likely a follow-up (short question without specific entity)
        if (!input.match(entitiesRegex)) {
          // Extract entity names from recent messages (both user and system)
          const entityMatches: string[] = [];
          const companyMatches: string[] = [];
          
          for (const msg of recentMessages) {
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            
            // Extract entities
            const matches = content.match(entitiesRegex);
            if (matches) entityMatches.push(...matches);
            
            // Specifically look for company names mentioned in responses
            const companyMatch = content.match(/\b(?:Soluciones\s+GBH|GBH|empresa\s+GBH)\b/gi);
            if (companyMatch) companyMatches.push(...companyMatch);
            
            // Look for location references that might provide context
            if (input.toLowerCase().includes('servicio') || 
                input.toLowerCase().includes('ofrece') ||
                input.toLowerCase().includes('hace')) {
              const dominicanMatch = content.match(/\b(?:Santo\s+Domingo|República\s+Dominicana|Dominicana)\b/gi);
              if (dominicanMatch) companyMatches.push('Soluciones GBH Dominicana');
            }
          }
          
          // Prioritize company mentions first (more specific context)
          if (companyMatches.length > 0) {
            const mostRecentCompany = companyMatches[companyMatches.length - 1];
            searchQuery = `${mostRecentCompany} ${input}`;
            console.log(`Company follow-up detected. Enhanced query: ${searchQuery}`);
          } 
          // Fall back to general entities if no companies found
          else if (entityMatches.length > 0) {
            const mostRecentEntity = entityMatches[entityMatches.length - 1];
            searchQuery = `${mostRecentEntity} ${input}`;
            console.log(`Entity follow-up detected. Enhanced query: ${searchQuery}`);
          }
        }
      }
      
      // Step 1: Initial web search
      const searchResult = await callAgent("web_search", searchQuery, context);
      
      const searchOutput = typeof searchResult.output === 'string' 
        ? searchResult.output 
        : JSON.stringify(searchResult.output || '');
      
      if (!searchOutput || searchOutput.includes("Search failed") || searchOutput.trim().length < 10) {
        return {
          output: isSpanish 
            ? "No pude encontrar información confiable sobre tu pregunta. Por favor intenta reformular o ser más específico."
            : "I couldn't find reliable information about your question. Please try rephrasing or being more specific.",
          confidence: 0.2
        };
      }

      // Step 2: Use LLM intelligence to extract and analyze information
      const analysisPrompt = `You are an expert research analyst. Your task is to analyze search results and extract relevant information to answer the user's question. If the information is incomplete, determine if a follow-up search is needed.

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
      const isSpanish = /quién|quien|cuándo|cuando|qué|que|año|empresa|fundó|creó/.test(input.toLowerCase());
      return {
        output: isSpanish 
          ? `Lo siento, no pude completar la búsqueda: ${error.message}. Por favor intenta de nuevo con una pregunta diferente.`
          : `Sorry, I couldn't complete the search: ${error.message}. Please try again with a different question.`,
        confidence: 0.1
      };
    }
  }
});
