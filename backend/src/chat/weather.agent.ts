import { AgentRegistry } from './agent-registry';
import { Logger } from '@nestjs/common';

// Create a dedicated weather agent that uses the open_weather_map tool correctly
AgentRegistry.register({
  name: 'weather',
  description:
    'Get current weather information for a specific location or compare weather between multiple locations.',
  handle: async (input, context, callAgent) => {
    const logger = new Logger('WeatherAgent');
    logger.log(`Processing weather request: "${input}"`);

    try {
      const { llm } = context;

      if (!llm) {
        logger.warn(
          'LLM not available for location extraction in WeatherAgent.',
        );
        return {
          output:
            "I'm sorry, I can't process this request without my core AI module.",
          confidence: 0.1,
        };
      }

      const extractionPrompt = `
You are a location extraction expert. Your task is to extract up to two location names from a user's query.

RULES:
1.  **Extract Locations**: Identify and extract the city and country (e.g., "Santo Domingo, DO", "New York, US").
2.  **Handle Comparisons**: If the query compares two locations (e.g., "weather in Santo Domingo vs New York"), separate them with " | ".
3.  **Focus on Location**: Return ONLY the location name(s). Remove all other words, questions, and conversational text.
4.  **Be Concise**: Do not add any extra text, explanations, or apologies.

Query: "${input}"
Location(s):
`;
      const extractionResult = await llm.invoke(extractionPrompt);
      const locationsString =
        typeof extractionResult.content === 'string'
          ? extractionResult.content.trim()
          : JSON.stringify(extractionResult.content).trim();

      logger.log(`Extracted locations with LLM: "${locationsString}"`);

      if (!locationsString) {
        return {
          output:
            "I couldn't identify a location in your request. Please specify a city, like 'weather in London'.",
          confidence: 0.4,
        };
      }

      const locations = locationsString.split(' | ').map((loc) => loc.trim());

      if (locations.length > 1) {
        if (!callAgent) {
          throw new Error('callAgent is not available');
        }
        // Handle multiple locations
        const weatherResults = await Promise.all(
          locations.map((location) =>
            callAgent('open_weather_map', location, context),
          ),
        );

        const combinedOutput = weatherResults
          .map((res) => res.output)
          .join('\n\n');

        const comparisonPrompt = `You are a weather analyst. The user asked to compare the weather in multiple locations. Your task is to present the comparison in a clear, conversational way, using the same language as the user's original query.

USER'S QUERY: "${input}"

WEATHER DATA:
${combinedOutput}

INSTRUCTIONS:
1.  Analyze the user's query to understand the language used.
2.  Present the weather data comparison in a user-friendly format.
3.  Your entire response should be in the same language as the user's query. For example, if the user asked in Spanish, you must respond in Spanish.
4.  Format the response using markdown for a clear and user-friendly presentation. Use headings, bold text, and lists.

COMPARISON:`;

        // Use the summarizer agent to generate a language-aware response
        if (!callAgent) {
          throw new Error('callAgent is not available');
        }
        const finalResult = await callAgent(
          'summarizer',
          comparisonPrompt,
          context,
        );

        return {
          output: finalResult.output,
          confidence: 0.9,
        };
      } else {
        if (!callAgent) {
          throw new Error('callAgent is not available');
        }
        // Handle single location
        const result = await callAgent(
          'open_weather_map',
          locations[0],
          context,
        );
        
        const summarizerPrompt = `You are a weather analyst. The user asked for the weather. Your task is to present the weather information in a clear, conversational way, using the same language as the user's original query.

USER'S QUERY: "${input}"

WEATHER DATA:
${result.output}

INSTRUCTIONS:
1.  Analyze the user's query to understand the language used.
2.  Present the weather data in a user-friendly format.
3.  Your entire response should be in the same language as the user's query. For example, if the user asked in Spanish, you must respond in Spanish.
4.  Format the response using markdown for a clear and user-friendly presentation. Use headings, bold text, and lists.

RESPONSE:`;

        const finalResult = await callAgent(
          'summarizer',
          summarizerPrompt,
          context,
        );

        return {
          output: finalResult.output,
          confidence: result.confidence || 0.85,
        };
      }
    } catch (error: any) {
      logger.error(`Error in weather agent: ${error.message}`, error.stack);
      // Ensure even errors are summarized for consistent output
      if (callAgent) {
        const errorPrompt = `You are a helpful assistant. The user's request for weather information failed. Please inform them gracefully in the same language as their original query.

USER'S QUERY: "${input}"
ERROR: "I'm sorry, I couldn't get the weather information. Please try again with a specific location."

INSTRUCTIONS:
1.  Analyze the user's query to understand the language used.
2.  Apologize for the error and explain that the weather information could not be retrieved.
3.  Suggest trying again with a specific location.
4.  Your entire response should be in the same language as the user's query.

RESPONSE:`;
        const finalResult = await callAgent('summarizer', errorPrompt, context);
        return {
          output: finalResult.output,
          confidence: 0.2,
        };
      }
      // Fallback if callAgent is not available
      return {
        output: `I'm sorry, I couldn't get the weather information. Please try again with a specific location.`,
        confidence: 0.2,
      };
    }
  },
});

console.log('Weather agent registered successfully');
