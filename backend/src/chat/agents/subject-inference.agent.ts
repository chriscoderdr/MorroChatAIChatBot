import { Agent, AgentName } from '../types';
import { Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage } from '@langchain/core/messages';

export class SubjectInferenceAgent implements Agent {
  public name: AgentName = 'subject_inference';
  public description =
    'Infers the main subject and its descriptive context from the recent conversation history.';
  public async handle(input, context) {
    const logger = new Logger('SubjectInferenceAgent');
    try {
      const { chatHistory, llm } = context;

      if (!chatHistory || chatHistory.length === 0) {
        return { output: '{}' }; // No history, no subject
      }
      if (!llm) {
        logger.warn('LLM not available for subject inference.');
        return { output: '{}' };
      }

      const recentMessages = chatHistory
        .slice(-6)

        .map((msg: BaseMessage) => {
          const content =
            typeof msg.content === 'string'
              ? msg.content
              : JSON.stringify(msg.content);
          return `${msg._getType()}: ${content}`;
        })
        .join('\n');

      const prompt = `You are a subject analysis expert. Your task is to analyze the provided conversation history and identify the primary subject and its essential descriptive context. The user's latest message is: "${input}".

**Instructions:**
1.  Read the conversation history carefully to understand what is being discussed.
2.  Identify the main noun or entity (the "subject") that the user's latest message is referring to, based on the history.
3.  Extract any critical descriptive details about that subject (e.g., "a Dominican software company," "a British punk band," "a constitutional article"). This description is vital for disambiguation.
4.  Return a single, clean JSON object with two keys: "subject" and "description".
5.  The "description" MUST NOT be empty if there is descriptive context available in the history.
6.  **IMPORTANT**: If the user's latest message is a direct question to you (the assistant, e.g., "who are you?", "can you help me?"), is a greeting, or starts a completely new, unrelated topic, **ignore the previous history** and return an empty JSON object \`{}\`.
7.  If no specific subject can be determined from the history for a follow-up question, return an empty JSON object: {}.

**Example 1 (Follow-up):**
*   History: "human: Tell me about GBH, the Dominican software company."
*   User's latest message: "When was it founded?"
*   Correct JSON Response: {"subject": "GBH", "description": "Dominican software company"}

**Example 2 (Time Comparison):**
*   History: "human: que hora es en dominicana?"
*   User's latest message: "y en filipinas?"
*   Correct JSON Response: {"subject": "Dominican Republic", "description": "location for time comparison"}

**Example 3 (New Topic / Direct Question):**
*   History: "human: Tell me about this Python code..."
*   User's latest message: "hablas español?"
*   Correct JSON Response: {}

**Conversation History:**
${recentMessages}

**JSON Response (JSON only, no other text):**`;

      let result;
      // Force JSON output if using OpenAI
      if (llm instanceof ChatOpenAI) {
        const boundLLM = llm.bind({ response_format: { type: 'json_object' } });
        result = await boundLLM.invoke(prompt);
      } else {
        result = await llm.invoke(prompt);
      }

      let jsonOutput =
        typeof result.content === 'string'
          ? result.content
          : JSON.stringify(result.content);
      jsonOutput = jsonOutput.trim();

      // Handle cases where the LLM might still wrap the output in markdown
      const codeBlockMatch = jsonOutput.match(
        /```(?:json)?\s*(\{[\s\S]*?\})\s*```/,
      );
      if (codeBlockMatch && codeBlockMatch[1]) {
        jsonOutput = codeBlockMatch[1];
      }

      logger.log(`Inferred subject JSON: ${jsonOutput}`);
      return { output: jsonOutput, confidence: 0.95 };
    } catch (error: any) {
      logger.error(
        `Error in subject inference agent: ${error.message}`,
        error.stack,
      );
      return { output: '{}' }; // Return empty JSON on error
    }
  }
}
