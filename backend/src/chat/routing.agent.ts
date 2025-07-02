import { AgentRegistry } from './agent-registry';
import { Logger } from '@nestjs/common';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage } from '@langchain/core/messages';
import { AgentContext } from './types';

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
const getAgentDescription = (agentName: string): string => {
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
    code_interpreter: 'Analyzes, explains, and executes code snippets.',
    code_optimization: 'Optimizes and improves existing code.',
  };
  return (
    descriptions[agentName] || `Agent that handles ${agentName}-related queries`
  );
};

/**
 * Dedicated routing agent for predicting the best agent to handle a user query.
 * This agent is self-contained and returns a JSON routing decision.
 */
AgentRegistry.register({
  name: 'routing',
  description:
    'Determines the best agent to handle a user query using LLM analysis',
  handle: async (input, context, _callAgent) => {
    const logger = new Logger('RoutingAgent');

    try {
      const { availableAgents, llm } = context;

      if (!availableAgents || !Array.isArray(availableAgents)) {
        throw new Error('Invalid routing context: missing availableAgents');
      }
      if (!llm || typeof llm.invoke !== 'function') {
        throw new Error('Invalid routing context: missing llm instance');
      }

      const hasDocuments = hasDocumentContext(context);

      const systemPrompt = `CRITICAL: You are a JSON-only routing API. You MUST return ONLY a JSON object. NO conversational text.

AVAILABLE AGENTS:
${availableAgents.map((agent) => `- ${agent}: ${getAgentDescription(agent)}`).join('\n')}

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
1. Personal/conversational queries (greetings, introductions) → general
2. Time queries ("time", "date", "today") → time
3. Weather queries ("weather", "temperature") → weather
4. Explicit document queries ("document", "what is this about") → document_search
5. Research queries (companies, people, facts) → research
6. Code queries → code_interpreter
7. Ambiguous queries WITH document context → document_search
8. Everything else → general

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

      return { output, confidence: 0.9 };
    } catch (error: any) {
      logger.error(`Error in routing agent: ${error.message}`, error.stack);
      return {
        output: JSON.stringify({
          error: 'routing_failed',
          message: error.message,
          fallback: true,
        }),
        confidence: 0.0,
      };
    }
  },
});

console.log('Routing agent registered successfully');
