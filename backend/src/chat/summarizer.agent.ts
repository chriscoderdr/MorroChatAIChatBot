// summarizer.agent.ts - LLM-powered summarization and text analysis agent
import { AgentRegistry } from './agent-registry';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

AgentRegistry.register({
  name: 'summarizer',
  description:
    'Uses LLM intelligence to summarize and analyze text with sophisticated understanding of context and requirements.',
  handle: async (input, context) => {
    try {
      // Create a focused prompt for the summarization task
      const summaryPrompt = `You are an expert text analyst and summarizer. Your task is to intelligently process and analyze the following text according to the specific requirements.

TEXT TO ANALYZE:
${input}

INSTRUCTIONS:
1.  If the text is a research analysis prompt (it will contain "USER'S QUESTION" and "SEARCH HISTORY"), follow the specific instructions within that prompt *exactly*. Your response should be either "ANSWER_FOUND: [answer]" or "NEED_MORE_SEARCH: [new query]".
2.  For all other text, provide a clear and concise summary that captures the key information.
3.  Maintain the appropriate language (e.g., Spanish, English) based on the text.
4.  Focus on factual information and avoid speculation.
5.  Do not include technical metadata or your own thinking process in the final output.
6.  Format the final output using markdown for a beautiful and user-friendly experience. Use headings, bold text, lists, and tables where appropriate to present the information in a clear and organized way.

Provide your analysis or summary:`;

      // Try to use LLM if available
      try {
        let result = '';
        // First try using the context LLM if available
        if (context?.llm) {
          const response = await context.llm.invoke(summaryPrompt);
          result =
            typeof response.content === 'string'
              ? response.content
              : JSON.stringify(response.content);
          result = result.trim();
        }
        // Next try using Gemini API directly
        else if (context?.geminiApiKey || process.env.GEMINI_API_KEY) {
          const llm = new ChatGoogleGenerativeAI({
            apiKey: context?.geminiApiKey || process.env.GEMINI_API_KEY,
            model:
              context?.geminiModel ||
              process.env.GEMINI_MODEL ||
              'gemini-1.5-flash',
            temperature: 0.3,
          });

          const response = await llm.invoke(summaryPrompt);
          result =
            typeof response.content === 'string'
              ? response.content
              : JSON.stringify(response.content);
          result = result.trim();
        }

        if (result) {
          // Clean up the LLM response to make it user-friendly
          // Stronger regex patterns to remove thinking process completely
          result = result
            // First, try to extract just the FINAL ANSWER section if it exists
            .replace(/^[\s\S]*?FINAL ANSWER:\s*([\s\S]*)$/i, '$1')
            // Remove any multi-line thought/action/observation blocks
            .replace(
              /^THOUGHT:.*?(?=ACTION:|OBSERVATION:|FINAL ANSWER:|$)/gims,
              '',
            )
            .replace(
              /^ACTION:.*?(?=OBSERVATION:|THOUGHT:|FINAL ANSWER:|$)/gims,
              '',
            )
            .replace(
              /^OBSERVATION:.*?(?=ACTION:|THOUGHT:|FINAL ANSWER:|$)/gims,
              '',
            )
            // Remove individual lines with search commands
            .replace(/^Executing web_search.*?(?=\n|$)/gim, '')
            .replace(/^I'll search for.*?(?=\n|$)/gim, '')
            .replace(/^I need to search.*?(?=\n|$)/gim, '')
            // Remove other similar patterns
            .replace(/^Let me search for.*?(?=\n|$)/gim, '')
            .replace(/^Let's search for.*?(?=\n|$)/gim, '')
            .replace(/^I should search for.*?(?=\n|$)/gim, '')
            .replace(/^Let me use.*?(?=\n|$)/gim, '')
            .replace(/^I will use.*?(?=\n|$)/gim, '')
            .replace(/^Using web_search.*?(?=\n|$)/gim, '')
            // Remove specific keywords
            .replace(/THOUGHT:?/gi, '')
            .replace(/ACTION:?/gi, '')
            .replace(/OBSERVATION:?/gi, '')
            .replace(/web_search/gi, '')
            .replace(/\bTOOL\b/gi, '')
            .replace(/\bQUERY\b/gi, '')
            // Remove "according to..." type phrases
            .replace(
              /According to (?:the|my|our) (?:search|web|)? ?results,?\s*/gi,
              '',
            )
            .replace(
              /Based on (?:the|my|our) (?:search|web|)? ?results,?\s*/gi,
              '',
            )
            .replace(/The (?:search|web|)? ?results indicate,?\s*/gi, '')
            .replace(/From the information provided,?\s*/gi, '')
            .replace(/From what I found,?\s*/gi, '')
            .replace(/According to what I found,?\s*/gi, '')
            .replace(/The information shows,?\s*/gi, '')
            .trim();

          return {
            output: result,
            confidence: 0.9,
          };
        }
      } catch (llmError) {
        console.error('Error using LLM for summarization:', llmError);
        // Continue to fallback pattern matching
      }

      // If LLM methods fail, return a generic error instead of using a brittle fallback.
      return {
        output:
          'I am having trouble analyzing this text right now. Please try again later.',
        confidence: 0.1,
      };
    } catch (error: any) {
      console.error('Summarizer agent error:', error);
      return {
        output: `Analysis failed: ${error.message}`,
        confidence: 0.1,
      };
    }
  },
});
