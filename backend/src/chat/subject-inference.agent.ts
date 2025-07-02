import { AgentRegistry } from "./agent-registry";
import { Logger } from "@nestjs/common";
import { ChatOpenAI } from "@langchain/openai";

AgentRegistry.register({
  name: "subject_inference",
  description: "Infers the main subject and its descriptive context from the recent conversation history.",
  handle: async (input, context, callAgent) => {
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

      const recentMessages = chatHistory.slice(-6).map((msg: any) => `${msg._getType()}: ${msg.content}`).join('\n');

      const prompt = `You are a subject analysis expert. Your task is to analyze the provided conversation history and identify the primary subject and its essential descriptive context. The user's latest message is: "${input}".

**Instructions:**
1.  Read the conversation history carefully to understand what is being discussed.
2.  Identify the main noun or entity (the "subject").
3.  Extract any critical descriptive details about that subject (e.g., "a Dominican software company," "a British punk band," "a constitutional article"). This description is vital for disambiguation.
4.  Return a single, clean JSON object with two keys: "subject" and "description".
5.  The "description" MUST NOT be empty if there is descriptive context available in the history.
6.  If no specific subject can be determined, return an empty JSON object: {}.

**Example:**
*   History: "human: Tell me about GBH, the Dominican software company."
*   User's latest message: "When was it founded?"
*   Correct JSON Response: {"subject": "GBH", "description": "Dominican software company"}

**Conversation History:**
${recentMessages}

**JSON Response (JSON only, no other text):**`;

      let result;
      // Force JSON output if using OpenAI
      if (llm instanceof ChatOpenAI) {
        const boundLLM = llm.bind({ response_format: { type: "json_object" } });
        result = await boundLLM.invoke(prompt);
      } else {
        result = await llm.invoke(prompt);
      }
      
      let jsonOutput = result.content.toString().trim();
      
      // Handle cases where the LLM might still wrap the output in markdown
      const codeBlockMatch = jsonOutput.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        jsonOutput = codeBlockMatch[1];
      }

      logger.log(`Inferred subject JSON: ${jsonOutput}`);
      return { output: jsonOutput, confidence: 0.95 };

    } catch (error) {
      logger.error(`Error in subject inference agent: ${error.message}`, error.stack);
      return { output: '{}' }; // Return empty JSON on error
    }
  }
});

console.log('Subject Inference agent registered successfully');
