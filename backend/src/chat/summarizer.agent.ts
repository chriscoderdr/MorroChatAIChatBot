// summarizer.agent.ts - LLM-powered summarization and text analysis agent
import { AgentRegistry } from "./agent-registry";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

AgentRegistry.register({
  name: "summarizer",
  description: "Uses LLM intelligence to summarize and analyze text with sophisticated understanding of context and requirements.",
  handle: async (input, context, callAgent) => {
    try {
      // Create a focused prompt for the summarization task
      const summaryPrompt = `You are an expert text analyst and summarizer. Your task is to intelligently process and analyze the following text according to the specific requirements.

TEXT TO ANALYZE:
${input}

INSTRUCTIONS:
1. If this is a research analysis prompt (contains "USER'S QUESTION", "SEARCH RESULTS", etc.), follow those specific instructions exactly.
2. If this is a general summarization request, provide a clear, concise summary that captures the key information.
3. Maintain the appropriate language (Spanish/English) based on the context and user's language.
4. Focus on factual information and avoid speculation.
5. Provide natural, conversational responses without technical metadata or formatting artifacts.
6. If analyzing search results for a specific question, extract only the information that directly answers that question.
7. If the search results don't contain sufficient information to answer the question completely, start your response with "NEED_MORE_SEARCH: [specific search query]" followed by your partial answer.
8. CRITICAL: Your response must NEVER include any of the following:
   - "THOUGHT:" sections or your internal thinking process
   - "ACTION:" sections or what actions you're taking
   - "OBSERVATION:" sections or what you're noticing
   - References to "web_search" or any technical tool details
   - Phrases like "According to the search results" or "The information shows"
9. MOST IMPORTANT: Only include your FINAL ANSWER, not your reasoning process.
10. The final output should be a clean, human-like response as if directly answering the user.

Provide your analysis or summary:`;

      // Try to use LLM if available
      try {
        let result = '';
        // First try using the context LLM if available
        if (context?.llm) {
          const response = await context.llm.invoke(summaryPrompt);
          result = response.content.toString().trim();
        } 
        // Next try using Gemini API directly
        else if (context?.geminiApiKey || process.env.GEMINI_API_KEY) {
          const llm = new ChatGoogleGenerativeAI({ 
            apiKey: context?.geminiApiKey || process.env.GEMINI_API_KEY, 
            model: context?.geminiModel || process.env.GEMINI_MODEL || 'gemini-1.5-flash', 
            temperature: 0.3
          });
          
          const response = await llm.invoke(summaryPrompt);
          result = response.content.toString().trim();
        }
        
        if (result) {
          // Clean up the LLM response to make it user-friendly
          // Stronger regex patterns to remove thinking process completely
          result = result
            // First, try to extract just the FINAL ANSWER section if it exists
            .replace(/^[\s\S]*?FINAL ANSWER:\s*([\s\S]*)$/i, '$1')
            // Remove any multi-line thought/action/observation blocks
            .replace(/^THOUGHT:.*?(?=ACTION:|OBSERVATION:|FINAL ANSWER:|$)/gsim, '')
            .replace(/^ACTION:.*?(?=OBSERVATION:|THOUGHT:|FINAL ANSWER:|$)/gsim, '')
            .replace(/^OBSERVATION:.*?(?=ACTION:|THOUGHT:|FINAL ANSWER:|$)/gsim, '')
            // Remove individual lines with search commands
            .replace(/^Executing web_search.*?(?=\n|$)/gmi, '')
            .replace(/^I'll search for.*?(?=\n|$)/gmi, '')
            .replace(/^I need to search.*?(?=\n|$)/gmi, '')
            // Remove other similar patterns
            .replace(/^Let me search for.*?(?=\n|$)/gmi, '')
            .replace(/^Let's search for.*?(?=\n|$)/gmi, '')
            .replace(/^I should search for.*?(?=\n|$)/gmi, '')
            .replace(/^Let me use.*?(?=\n|$)/gmi, '')
            .replace(/^I will use.*?(?=\n|$)/gmi, '')
            .replace(/^Using web_search.*?(?=\n|$)/gmi, '')
            // Remove specific keywords
            .replace(/THOUGHT:?/gi, '')
            .replace(/ACTION:?/gi, '')
            .replace(/OBSERVATION:?/gi, '')
            .replace(/web_search/gi, '')
            .replace(/\bTOOL\b/gi, '')
            .replace(/\bQUERY\b/gi, '')
            // Remove "according to..." type phrases
            .replace(/According to (?:the|my|our) (?:search|web|)? ?results,?\s*/gi, '')
            .replace(/Based on (?:the|my|our) (?:search|web|)? ?results,?\s*/gi, '')
            .replace(/The (?:search|web|)? ?results indicate,?\s*/gi, '')
            .replace(/From the information provided,?\s*/gi, '')
            .replace(/From what I found,?\s*/gi, '')
            .replace(/According to what I found,?\s*/gi, '')
            .replace(/The information shows,?\s*/gi, '')
            .trim();
          
          return {
            output: result,
            confidence: 0.9
          };
        }
      } catch (llmError) {
        console.error("Error using LLM for summarization:", llmError);
        // Continue to fallback pattern matching
      }
      
      // Pattern matching fallback if LLM methods failed
      if (input.includes("USER'S QUESTION") && input.includes("SEARCH RESULTS")) {
        // Extract the user's question and search results
        const questionMatch = input.match(/USER'S QUESTION:\s*(.*?)\n/);
        const resultsMatch = input.match(/SEARCH RESULTS:\s*(.*?)(?=\n\nINSTRUCTIONS:)/s);
        
        if (questionMatch && resultsMatch) {
          const question = questionMatch[1].trim();
          const searchResults = resultsMatch[1].trim();
          
          // Simple extraction logic for common patterns
          const isSpanish = /quién|quien|cuándo|cuando|qué|que|año|empresa|fundó|creó/.test(question.toLowerCase());
          
          // Look for founding dates, names, and relevant information in the search results
          const foundingYearMatch = searchResults.match(/\b(19\d{2}|20\d{2})\b/);
          const nameMatches = searchResults.match(/\b[A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóúñ]+)*\b/g);
          
          if (question.toLowerCase().includes('fundó') || question.toLowerCase().includes('founded')) {
            if (foundingYearMatch) {
              const year = foundingYearMatch[0];
              return {
                output: isSpanish 
                  ? `Según la información encontrada, fue fundada en ${year}.`
                  : `According to the information found, it was founded in ${year}.`,
                confidence: 0.8
              };
            }
          }
          
          // If we can't extract specific information, indicate we need more search
          return {
            output: `NEED_MORE_SEARCH: ${question} específicos detalles`,
            confidence: 0.6
          };
        }
      }
      
      // For general summarization, provide a simple summary based on rules
      const sentences = input.split(/[.!?]+/).filter(s => s.trim().length > 10).slice(0, 5);
      const basicSummary = sentences.join('. ');
      
      return {
        output: basicSummary.length > 300 ? basicSummary.substring(0, 300) + '...' : basicSummary,
        confidence: 0.7
      };
    } catch (error) {
      console.error("Summarizer agent error:", error);
      return {
        output: `Analysis failed: ${error.message}`,
        confidence: 0.1
      };
    }
  }
});
