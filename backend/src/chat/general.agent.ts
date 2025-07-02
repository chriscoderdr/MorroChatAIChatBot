import { AgentRegistry } from "./agent-registry";

AgentRegistry.register({
  name: "general",
  description: "A general-purpose conversational agent for a wide range of topics, including answering questions about itself.",
  handle: async (input, context) => {
    try {
      const { llm, chatHistory } = context;

      if (!llm) {
        return {
          output: "I'm sorry, I can't process this request without my core AI module.",
          confidence: 0.1,
        };
      }

      // Create a prompt for the general conversational task
      const prompt = `You are a helpful AI assistant. The user is having a conversation with you. Answer the user's last message directly and conversationally.

Current conversation:
${chatHistory.map((msg: any) => `${msg._getType()}: ${msg.content}`).join('\n')}
Human: ${input}
AI:`;

      const result = await llm.invoke(prompt);
      const output = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);

      return {
        output,
        confidence: 0.75, // General confidence for conversational topics
      };
    } catch (error) {
      return {
        output: `I'm sorry, I encountered an error: ${error.message}`,
        confidence: 0.1,
      };
    }
  },
});

console.log('General agent registered successfully');
