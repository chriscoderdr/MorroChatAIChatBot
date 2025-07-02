import { AgentRegistry } from './agent-registry';
import { Logger } from '@nestjs/common';

// Create a dedicated time agent that uses the current_time tool correctly
AgentRegistry.register({
  name: 'time',
  description:
    'Get the current time for a specific location.',
  handle: async (input, context, callAgent) => {
    const logger = new Logger('TimeAgent');
    logger.log(`Processing time request: "${input}"`);

    try {
      const { llm } = context;

      if (!llm) {
        logger.warn(
          'LLM not available for timezone extraction in TimeAgent.',
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
2.  **Handle Comparisons**: If the query compares two locations (e.g., "time in Santo Domingo vs New York"), separate them with " | ".
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
            "I couldn't identify a location in your request. Please specify a city, like 'time in London'.",
          confidence: 0.4,
        };
      }

      const locations = locationsString.split(' | ').map((loc) => loc.trim());

      if (locations.length > 1) {
        if (!callAgent) {
          throw new Error('callAgent is not available');
        }
        // Handle multiple locations
        const timeResults = await Promise.all(
          locations.map(async (location) => {
            const timezonePrompt = `
You are a timezone expert. Your task is to find the IANA timezone for a given location.

RULES:
1.  **Find Timezone**: Determine the correct IANA timezone for the location (e.g., "America/New_York", "Europe/London").
2.  **Focus on Timezone**: Return ONLY the IANA timezone name.
3.  **Be Concise**: Do not add any extra text, explanations, or apologies.

Location: "${location}"
Timezone:
`;
            const timezoneResult = await llm.invoke(timezonePrompt);
            const timezoneString =
              typeof timezoneResult.content === 'string'
                ? timezoneResult.content.trim()
                : JSON.stringify(timezoneResult.content).trim();

            if (!timezoneString) {
              return {
                output: `Could not determine timezone for ${location}`,
              };
            }
            return callAgent('current_time', timezoneString, context);
          }),
        );

        const combinedOutput = timeResults
          .map((res) => res.output)
          .join('\n\n');

        const comparisonPrompt = `You are a time analyst. The user asked to compare the time in multiple locations. Your task is to present the comparison in a clear, conversational way, using the same language as the user's original query.

USER'S QUERY: "${input}"

TIME DATA:
${combinedOutput}

INSTRUCTIONS:
1.  Analyze the user's query to understand the language used.
2.  Present the time data comparison in a user-friendly format.
3.  Your entire response should be in the same language as the user's query. For example, if the user asked in Spanish, you must respond in Spanish.

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
        const timezonePrompt = `
You are a timezone expert. Your task is to find the IANA timezone for a given location.

RULES:
1.  **Find Timezone**: Determine the correct IANA timezone for the location (e.g., "America/New_York", "Europe/London").
2.  **Focus on Timezone**: Return ONLY the IANA timezone name.
3.  **Be Concise**: Do not add any extra text, explanations, or apologies.

Location: "${locations[0]}"
Timezone:
`;
        const timezoneResult = await llm.invoke(timezonePrompt);
        const timezoneString =
          typeof timezoneResult.content === 'string'
            ? timezoneResult.content.trim()
            : JSON.stringify(timezoneResult.content).trim();

        if (!timezoneString) {
          return {
            output:
              `I couldn't determine the timezone for "${locations[0]}". Please try a different location.`,
            confidence: 0.4,
          };
        }

        const result = await callAgent(
          'current_time',
          timezoneString,
          context,
        );
        
        const summarizerPrompt = `You are a time analyst. The user asked for the time. Your task is to present the time information in a clear, conversational way, using the same language as the user's original query.

USER'S QUERY: "${input}"

TIME DATA:
${result.output}

INSTRUCTIONS:
1.  Analyze the user's query to understand the language used.
2.  Present the time data in a user-friendly format.
3.  Your entire response should be in the same language as the user's query. For example, if the user asked in Spanish, you must respond in Spanish.

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
      logger.error(`Error in time agent: ${error.message}`, error.stack);
      return {
        output: `I'm sorry, I couldn't get the time information. Please try again with a valid IANA timezone.`,
        confidence: 0.2,
      };
    }
  },
});

console.log('Time agent registered successfully');
