import { Agent, AgentName, AgentContext } from '../types';
import { Logger } from '@nestjs/common';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage } from '@langchain/core/messages';
import { ResponseFormatter } from '../utils/response-utils';

// Helper method to check if documents are available in chat context
const hasDocumentContext = (context: AgentContext): boolean => {
  return (
    context.chatHistory &&
    context.chatHistory.some((msg: BaseMessage) => {
      const content =
        typeof msg.content === 'string'
          ? msg.content
          : JSON.stringify(msg.content);
      return (
        content &&
        (content.includes('[PDF Uploaded]') ||
          content.includes('[Document Uploaded]') ||
          content.includes('[File Uploaded]') ||
          content.includes('.pdf') ||
          content.includes('.docx') ||
          content.includes('.txt'))
      );
    })
  );
};

// Get a description of each agent for the LLM to understand its purpose
const getAgentDescription = (agentName: string): string | undefined => {
  const descriptions: Record<string, string> = {
    general:
      'A general-purpose conversational agent for a wide range of topics, including answering questions about itself.',
    research:
      'Provides detailed factual information by searching the web. Handles companies, news, people, and knowledge-based topics.',
    time: 'Provides current time, date, and timezone information.',
    weather: 'Provides weather forecasts and current conditions.',
    document_search:
      'Searches through user-uploaded documents to find specific information.',
    summarizer: 'Summarizes long pieces of text or content.',
    code_interpreter:
      'Analyzes, explains, and answers questions about existing code snippets provided by the user.',
    code_generation: 'Generates code based on user requirements.',
    code_optimization: 'Optimizes and improves existing code.',
    calculator:
      'Performs mathematical calculations and evaluates expressions.',
    unit_converter: 'Converts between different units of measurement.',
    hashing: 'Computes cryptographic hashes of text.',
    currency_converter:
      'Converts between different currencies and provides exchange rates.',
  };
  return descriptions[agentName];
};

/**
 * Dedicated routing agent for predicting the best agent to handle a user query.
 * This agent is self-contained and returns a JSON routing decision.
 */
export class RoutingAgent implements Agent {
  public name: AgentName = 'routing';
  public description =
    'Determines the best agent to handle a user query using LLM analysis';
  public async handle(input, context, _callAgent) {
    const logger = new Logger('RoutingAgent');

    try {
      const { availableAgents, llm } = context;

      if (!availableAgents || !Array.isArray(availableAgents)) {
        return ResponseFormatter.formatErrorResponse(
          'Unable to route your request: routing service is not properly configured.',
          context,
          'routing'
        );
      }
      if (!llm || typeof llm.invoke !== 'function') {
        return ResponseFormatter.formatErrorResponse(
          'Unable to route your request: language model is not available.',
          context,
          'routing'
        );
      }

      const hasDocuments = hasDocumentContext(context);
      const { chatDefaultTopic } = context;

      const routableAgents = availableAgents
        .map((agent) => ({
          name: agent,
          description: getAgentDescription(agent),
        }))
        .filter((agent) => agent.description);

      const topicRule = chatDefaultTopic
        ? `
IMPORTANT TOPIC RESTRICTION: This chat is strictly focused on "${chatDefaultTopic}".
- If the user's query is NOT about "${chatDefaultTopic}", you MUST route to the "general" agent.
- If the query IS about "${chatDefaultTopic}", proceed with normal routing rules.
`
        : '';

            const systemPrompt = `IMPORTANT: Always reply and route in the same language as the user's query, regardless of which language it is. The LLM supports all languages.
${topicRule}
AVAILABLE AGENTS:
${routableAgents
  .map((agent) => `- ${agent.name}: ${agent.description}`)
  .join('\n')}

USER QUERY: "${input}"
${
  context.chatHistory && context.chatHistory.length > 0
    ? `\nCONTEXT: ${context.chatHistory
        .slice(-2)

        .map((msg: BaseMessage) => `${msg._getType()}: ${msg.content}`)
        .join(', ')}`
    : ''
}
${hasDocuments ? '\n⚠️  DOCUMENT CONTEXT DETECTED: User has uploaded documents. For ambiguous queries, prefer document_search agent.' : ''}

ROUTING RULES (STRICT PRIORITY ORDER):
${chatDefaultTopic ? `1. Queries unrelated to "${chatDefaultTopic}" → general` : ''}
2. Personal/conversational queries (greetings, introductions) → general
3. Calculation queries ("calculate", "what is 2+2") → calculator
4. Currency conversion queries ("USD to EUR", "100 dollars in yen") → currency_converter
5. Unit conversion queries ("convert", "kg to lb") → unit_converter
6. Hashing queries ("hash", "sha256 of 'hello'") → hashing
7. Time queries ("time", "date", "today") → time
8. Weather queries ("weather", "temperature") → weather
9. Explicit document queries ("document", "what is this about") → document_search
10. Research queries (companies, people, facts) → research
11. Code analysis queries (user provides code) -> code_interpreter
12. Code generation queries (user asks for code) -> code_generation
13. Ambiguous queries WITH document context → document_search
14. Everything else → general

MANDATORY RESPONSE FORMAT - RESPOND WITH ONLY THIS JSON:
{"agentName": "agent_name", "confidence": 0.85, "reasoning": "brief reason"}

DO NOT WRITE ANY OTHER TEXT. ONLY JSON.`;

      logger.log(
        `Routing agent analyzing query: "${input.substring(0, 50)}..."`,
      );

      let result;
      if (llm instanceof ChatOpenAI) {
        const boundLLM = llm.bind({
          response_format: { type: 'json_object' },
        });
        result = await boundLLM.invoke(systemPrompt);
      } else {
        result = await llm.invoke(systemPrompt);
      }
      const output = result.content.toString();

      logger.log(`Routing agent raw LLM response: ${output}`);

      return ResponseFormatter.formatAgentResponse(output, 0.9);
    } catch (error: any) {
      logger.error(`Error in routing agent: ${error.message}`, error.stack);
      return ResponseFormatter.formatErrorResponse(error, context, 'routing');
    }
  }
}
