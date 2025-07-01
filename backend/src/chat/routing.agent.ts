import { AgentRegistry } from "./agent-registry";
import { Logger } from "@nestjs/common";

/**
 * Dedicated routing agent for predicting the best agent to handle a user query.
 * This agent is specifically designed to return JSON routing decisions without
 * any conversational behavior that might interfere with the routing process.
 */
AgentRegistry.register({
  name: 'routing',
  description: 'Determines the best agent to handle a user query using LLM analysis',
  handle: async (input, context, callAgent) => {
    const logger = new Logger('RoutingAgent');
    
    try {
      // Extract the routing parameters from context
      const { availableAgents, systemPrompt } = context;
      
      if (!availableAgents || !Array.isArray(availableAgents)) {
        logger.error('Missing availableAgents in routing context');
        throw new Error('Invalid routing context: missing availableAgents');
      }
      
      if (!systemPrompt) {
        logger.error('Missing systemPrompt in routing context');
        throw new Error('Invalid routing context: missing systemPrompt');
      }
      
      logger.log(`Routing agent analyzing query: "${input.substring(0, 50)}${input.length > 50 ? '...' : ''}"`);
      logger.log(`Available agents: ${availableAgents.join(', ')}`);
      
      // Use a specialized LLM service configured specifically for routing
      // This agent should use a different model or configuration that's optimized for JSON responses
      const routingContext = {
        ...context,
        // Override any existing system prompts to ensure strict JSON routing
        systemPrompt: systemPrompt,
        // Set parameters for deterministic, focused responses
        temperature: 0.1, // Low temperature for more deterministic responses
        maxTokens: 200,   // Limit response length to prevent rambling
        stopSequences: ['\n\n', 'Human:', 'Assistant:'], // Stop early to prevent conversational responses
        // Force JSON mode if the underlying LLM supports it
        responseFormat: 'json',
        // Disable any conversational features
        conversational: false,
        // Add routing-specific metadata
        routingMode: true,
        agentType: 'routing'
      };
      
      // Call the LLM service directly for routing (assuming we have a general LLM agent)
      const generalAgent = AgentRegistry.getAgent('general');
      if (!generalAgent) {
        logger.error('General agent not available for routing LLM calls');
        throw new Error('General agent not available for routing');
      }
      
      // Make the LLM call with routing-specific context
      const result = await generalAgent.handle(input, routingContext, callAgent);
      
      if (!result || !result.output) {
        logger.error('Routing agent received empty response from LLM');
        throw new Error('Empty response from routing LLM');
      }
      
      logger.log(`Routing agent raw LLM response: ${result.output}`);
      
      // The routing agent should return the raw LLM response for further processing
      // The agent orchestrator will handle JSON parsing and validation
      return {
        output: result.output,
        confidence: result.confidence || 0.8
      };
      
    } catch (error) {
      logger.error(`Error in routing agent: ${error.message}`, error.stack);
      
      // Return a structured error that can be handled by the orchestrator
      return {
        output: JSON.stringify({
          error: 'routing_failed',
          message: error.message,
          fallback: true
        }),
        confidence: 0.0
      };
    }
  }
});

console.log('Routing agent registered successfully');
