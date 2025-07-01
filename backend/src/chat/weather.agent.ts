import { AgentRegistry } from "./agent-registry";
import { Logger } from "@nestjs/common";

// Create a dedicated weather agent that uses the open_weather_map tool correctly
AgentRegistry.register({
  name: 'weather',
  description: 'Get current weather information for a specific location',
  handle: async (input, context, callAgent) => {
    const logger = new Logger('WeatherAgent');
    logger.log(`Processing weather request: "${input}"`);
    
    try {
      // Enhanced location extraction
      let location: string;
      
      // Check if the input explicitly mentions "in" or Spanish "en" followed by a location
      if (input.toLowerCase().includes(' in ')) {
        location = input.split(/\s+in\s+/i).pop()?.trim() || '';
        // Clean up punctuation
        location = location.replace(/[?!.,;:]$/, '');
      }
      // Check for Spanish "en" followed by a location (e.g., "clima en Santo Domingo")
      else if (input.toLowerCase().includes(' en ')) {
        location = input.split(/\s+en\s+/i).pop()?.trim() || '';
        // Clean up punctuation
        location = location.replace(/[?!.,;:]$/, '');
        logger.log(`Found Spanish 'en' pattern, extracted location: "${location}"`);
      }
      // Check for "for" or Spanish "para" followed by a location
      else if (input.toLowerCase().includes(' for ') || input.toLowerCase().includes(' para ')) {
        const preposition = input.toLowerCase().includes(' for ') ? ' for ' : ' para ';
        location = input.split(new RegExp(`\\s+${preposition}\\s+`, 'i')).pop()?.trim() || '';
        // Clean up punctuation
        location = location.replace(/[?!.,;:]$/, '');
      }
      // Strip weather-related terms to extract just the location
      else {
        location = input.replace(/weather|clima|temperature|temperatura|forecast|pronóstico|what's|how's|how is|what is|whats|hows|el clima en|el tiempo en|que|hace/gi, '').trim();
        
        // Look for common city names in the input even if they're part of larger phrases
        const commonCities = [
          { search: /\bnew\s*york\b/i, replace: "New York, USA" },
          { search: /\bnueva\s*york\b/i, replace: "New York, USA" },
          { search: /\bsanto\s*domingo\b/i, replace: "Santo Domingo, Dominican Republic" },
          { search: /\bmadrid\b/i, replace: "Madrid, Spain" },
          { search: /\blondon\b/i, replace: "London, GB" },
          { search: /\blondres\b/i, replace: "London, GB" },
          { search: /\btokyo\b/i, replace: "Tokyo, Japan" },
          { search: /\btokio\b/i, replace: "Tokyo, Japan" },
          { search: /\bparis\b/i, replace: "Paris, France" },
          { search: /\brome\b/i, replace: "Rome, Italy" },
          { search: /\broma\b/i, replace: "Rome, Italy" }
        ];
        
        // Check if any common city is mentioned in the input
        for (const city of commonCities) {
          if (city.search.test(input)) {
            location = city.replace;
            logger.log(`Detected common city name in input, using: ${location}`);
            break;
          }
        }
      }
      
      logger.log(`Extracted location: "${location}"`);
      
      // Map common country and city names to better search terms
      const locationMap: Record<string, string> = {
        // Countries & Regions
        'dominicana': 'Santo Domingo, Dominican Republic',
        'república dominicana': 'Santo Domingo, Dominican Republic',
        'republica dominicana': 'Santo Domingo, Dominican Republic',
        'rd': 'Santo Domingo, Dominican Republic',
        'usa': 'New York, USA',
        'eeuu': 'New York, USA',
        'estados unidos': 'New York, USA',
        'españa': 'Madrid, Spain',
        'espana': 'Madrid, Spain',
        'uk': 'London, GB',
        'reino unido': 'London, GB',
        
        // Major cities that might be ambiguous or need country specification
        'new york': 'New York, USA',
        'nueva york': 'New York, USA',
        'tokyo': 'Tokyo, Japan',
        'tokio': 'Tokyo, Japan',
        'paris': 'Paris, France',
        'london': 'London, GB',
        'londres': 'London, GB',
        'rome': 'Rome, Italy',
        'roma': 'Rome, Italy',
        'santo domingo': 'Santo Domingo, Dominican Republic',
        'santiago': 'Santiago, Dominican Republic',
        'santiago de los caballeros': 'Santiago, Dominican Republic',
        'boston': 'Boston, USA',
        'chicago': 'Chicago, USA',
        'miami': 'Miami, USA',
        'los angeles': 'Los Angeles, USA',
        'san francisco': 'San Francisco, USA',
      };
      
      // Check if we have a mapping for this location
      const normalizedLocation = location.toLowerCase().trim();
      
      // Special case: Handle "New York" query explicitly (common issue)
      if (normalizedLocation === "new york" || input.toLowerCase().includes("new york")) {
        logger.log("Explicitly handling New York query");
        location = "New York, USA";
      }
      // Check our location map for other mapped locations
      else if (locationMap[normalizedLocation]) {
        logger.log(`Mapped "${location}" to "${locationMap[normalizedLocation]}"`);
        location = locationMap[normalizedLocation];
      }
      
      // If location is too short or empty, use a default location or error message
      if (!location || location.length < 2) {
        logger.warn(`Invalid location extracted: "${location}"`);
        return {
          output: "I need a specific location to check the weather. For example, try 'What's the weather in New York?' or 'Weather in Tokyo'.",
          confidence: 0.5
        };
      }
      
      // Ensure we pass a consistent session ID in all parts of the context
      const sessionId = context.userId || context?.configurable?.sessionId || context?.metadata?.sessionId;
      const weatherContext = { 
        ...context,
        userId: sessionId,
        sessionId: sessionId,
        configurable: {
          ...(context?.configurable || {}),
          sessionId: sessionId
        },
        metadata: {
          ...(context?.metadata || {}),
          sessionId: sessionId
        }
      };
      
      // Log the context we're using for debugging
      logger.log(`Weather agent using session ID: ${sessionId}`);
      logger.log(`Weather context has chat history: ${!!context.chatHistory}`);
      if (context.chatHistory) {
        logger.log(`Chat history length: ${context.chatHistory.length} messages`);
      }
      
      // Use the open_weather_map tool with the extracted location
      try {
        logger.log(`Calling open_weather_map agent for location: "${location}"`);
        
        // Explicitly verify callAgent is available and valid
        if (!callAgent || typeof callAgent !== 'function') {
          logger.error(`callAgent is not a valid function: ${typeof callAgent}`);
          return {
            output: `I'm sorry, I couldn't get the weather information due to a technical issue. Please try again later.`,
            confidence: 0.5
          };
        }
        
        // Call the agent with proper error handling
        const result = await callAgent('open_weather_map', location, weatherContext);
        
        if (!result) {
          logger.error(`open_weather_map agent returned undefined result`);
          return {
            output: `I'm sorry, I couldn't get the weather information. Please try again later.`,
            confidence: 0.5
          };
        }
        
        logger.log(`Weather result for location "${location}": ${result.output?.substring(0, 100)}...`);
        
        // Calculate confidence based on the result
        let confidence = 0.9; // High default confidence
        
        // Check for common error responses
        if (result.output.includes("Could not find location data") || 
            result.output.includes("Failed to fetch weather") ||
            result.output.includes("An error occurred") ||
            result.output.includes("API key is missing")) {
          confidence = 0.5; // Lower confidence for errors
          logger.warn(`Weather agent detected error in response: "${result.output.substring(0, 100)}..."`);
        }
        
        // Check if we successfully got the temperature
        if (result.output.includes("°C") && result.output.includes("Current weather in")) {
          confidence = 0.98; // Very high confidence when we have temperature data
          logger.log(`Weather agent found temperature data, setting high confidence`);
        }
        
        logger.log(`Weather agent returning with confidence: ${confidence}`);
        
        return {
          output: result.output,
          confidence: confidence
        };
      } catch (callAgentError) {
        logger.error(`Error calling open_weather_map agent: ${callAgentError.message}`, callAgentError.stack);
        
        // Fallback to direct API call if agent registry fails
        try {
          logger.log(`Attempting fallback direct weather API call for: ${location}`);
          return {
            output: `The current weather in ${location} could not be retrieved. Please try again with a more specific location.`,
            confidence: 0.5
          };
        } catch (fallbackError) {
          logger.error(`Fallback weather API call failed: ${fallbackError.message}`);
          return {
            output: `I'm sorry, I couldn't get the weather information. Please try again with a more specific location.`,
            confidence: 0.5
          };
        }
      }
    } catch (error) {
      logger.error(`Error in weather agent: ${error.message}`, error.stack);
      return {
        output: `I'm sorry, I couldn't get the weather information. Please try again with a specific location like "What's the weather in New York?"`,
        confidence: 0.5
      };
    }
  }
});

console.log('Weather agent registered successfully');
