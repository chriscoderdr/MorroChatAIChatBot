import { AgentRegistry } from "./agent-registry";
import { Logger } from "@nestjs/common";

// Create a dedicated weather agent that uses the open_weather_map tool correctly
AgentRegistry.register({
  name: 'weather',
  description: 'Get current weather information for a specific location or compare weather between multiple locations.',
  handle: async (input, context, callAgent) => {
    const logger = new Logger('WeatherAgent');
    logger.log(`Processing weather request: "${input}"`);
    
    try {
      const { llm } = context;

      if (!llm) {
        logger.warn('LLM not available for location extraction in WeatherAgent.');
        return {
          output: "I'm sorry, I can't process this request without my core AI module.",
          confidence: 0.1,
        };
      }

      const extractionPrompt = `You are a location extraction assistant. Your task is to extract city/location names from weather-related queries.

RULES:
1. If the query compares multiple locations (e.g., using "vs", "or", "and", "compara"), return the locations separated by " | ".
2. For a single location, extract ONLY the city/location name.
3. Format as "City, Country" when possible (e.g., "Santo Domingo, DO", "New York, US").
4. Use standard country codes (US, DO, ES, FR, JP, PH, etc.).
5. If no country is specified, return just the city name.
6. Remove ALL question words, weather terms, and extra text.
7. Return ONLY the location(s), nothing else.

Query: "${input}"
Location(s):`;

      const extractionResult = await llm.invoke(extractionPrompt);
      const locationsString = typeof extractionResult.content === 'string' ? extractionResult.content.trim() : extractionResult.content.toString().trim();

      logger.log(`Extracted locations with LLM: "${locationsString}"`);

      if (!locationsString) {
        return {
          output: "I couldn't identify a location in your request. Please specify a city, like 'weather in London'.",
          confidence: 0.4
        };
      }

      const locations = locationsString.split(' | ').map(loc => loc.trim());

      if (locations.length > 1) {
        // Handle multiple locations
        const weatherResults = await Promise.all(
          locations.map(location => callAgent('open_weather_map', location, context))
        );
        
        const combinedOutput = weatherResults.map(res => res.output).join('\n\n');
        
        const comparisonPrompt = `You are a weather analyst. The user asked to compare the weather in multiple locations. Your task is to present the comparison in a clear, conversational way, using the same language as the user's original query.

USER'S QUERY: "${input}"

WEATHER DATA:
${combinedOutput}

INSTRUCTIONS:
1.  Analyze the user's query to understand the language used.
2.  Present the weather data comparison in a user-friendly format.
3.  Your entire response should be in the same language as the user's query. For example, if the user asked in Spanish, you must respond in Spanish.

COMPARISON:`;

        // Use the summarizer agent to generate a language-aware response
        const finalResult = await callAgent('summarizer', comparisonPrompt, context);

        return {
          output: finalResult.output,
          confidence: 0.9
        };

      } else {
        // Handle single location
        const result = await callAgent('open_weather_map', locations[0], context);
        return {
          output: result.output,
          confidence: result.confidence || 0.85
        };
      }
    } catch (error) {
      logger.error(`Error in weather agent: ${error.message}`, error.stack);
      return {
        output: `I'm sorry, I couldn't get the weather information. Please try again with a specific location.`,
        confidence: 0.2
      };
    }
  }
});

console.log('Weather agent registered successfully');
