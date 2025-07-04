import { Agent, AgentName } from '../types';
import { Logger } from '@nestjs/common';

// Create a dedicated time agent that uses the current_time tool correctly
export class TimeAgent implements Agent {
  public name: AgentName = 'time';
  public description =
    'Get the current time for a specific location.';
  public async handle(input, context, callAgent) {
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

      // Step 1: Use subject_inference to get context from the conversation
      let inferredSubject = '';
      if (callAgent) {
        try {
          const subjectResult = await callAgent(
            'subject_inference',
            input,
            context,
          );
          const subjectData = JSON.parse(subjectResult.output);
          if (subjectData.subject) {
            inferredSubject = `${subjectData.subject}, ${subjectData.description}`;
            logger.log(`Inferred subject: ${inferredSubject}`);
          }
        } catch (e) {
          logger.warn('Could not parse subject inference for time agent.');
        }
      }

      // Step 2: Create a combined input for location extraction
      const combinedInput = inferredSubject
        ? `${input} (context: ${inferredSubject})`
        : input;

      const extractionPrompt = `
You are a location extraction expert. Your task is to extract up to two location names from the user's query, using the provided context if available.

RULES:
1.  **Analyze Query and Context**: Identify all unique location names from the user's query and the context.
2.  **Handle Comparisons**: If the query is a comparison, ensure both locations (from the query and the context) are extracted.
3.  **Output Format**: If there are two locations, separate them with " | ".
4.  **Focus on Location**: Return ONLY the location name(s) (e.g., "Santo Domingo, DO | Manila, PH"). Remove all other words.
5.  **Be Concise**: Do not add any extra text, explanations, or apologies.

USER'S QUERY WITH CONTEXT: "${combinedInput}"
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
1.  Detect the language of the user's query.
2.  Present the time data comparison in a user-friendly format.
3.  Your entire response should be in the same language as the user's query. If the language is undetectable, default to English.
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
1.  Detect the language of the user's query.
2.  Present the time data in a user-friendly format.
3.  Your entire response should be in the same language as the user's query. If the language is undetectable, default to English.
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
      logger.error(`Error in time agent: ${error.message}`, error.stack);
      // Ensure even errors are summarized for consistent output
      if (callAgent) {
        const errorPrompt = `You are a helpful assistant. The user's request for time information failed. Please inform them gracefully in the same language as their original query.

USER'S QUERY: "${input}"
ERROR: "I'm sorry, I couldn't get the time information. Please try again with a specific location."

INSTRUCTIONS:
1.  Detect the language of the user's query.
2.  Apologize for the error and explain that the time information could not be retrieved.
3.  Suggest trying again with a specific location.
4.  Your entire response should be in the same language as the user's query. If the language is undetectable, default to English.

RESPONSE:`;
        const finalResult = await callAgent('summarizer', errorPrompt, context);
        return {
          output: finalResult.output,
          confidence: 0.2,
        };
      }
      // Fallback if callAgent is not available
      return {
        output: `I'm sorry, I couldn't get the time information. Please try again with a valid IANA timezone.`,
        confidence: 0.2,
      };
    }
  }
}
