import { Agent, AgentName } from '../types';
import { BaseMessage } from '@langchain/core/messages';
import { detectLanguage, LanguageManager } from '../utils/language-utils';

export class GeneralAgent implements Agent {
  public name: AgentName = 'general';
  public description =
    'A general-purpose conversational agent for a wide range of topics, including answering questions about itself.';
  public async handle(input, context) {
    try {
      const { llm, chatHistory } = context;

      if (!llm) {
        return {
          output:
            "I'm sorry, I can't process this request without my core AI module.",
          confidence: 0.1,
        };
      }

      const questionLanguage = await detectLanguage(input, llm);

      if (questionLanguage === 'Nonsense') {
        return {
          output:
            "I'm sorry, I didn't understand your request. Could you please rephrase it?",
          confidence: 0.3,
        };
      }

      const { chatDefaultTopic } = context;

      // Get language enforcement instructions
      const languageContext = await LanguageManager.getLanguageContext(input, llm);

      const topicPrompt = chatDefaultTopic
        ? `
  '**YOUR IDENTITY (MORROCHAT):**',
  '- **Your Name:** MorroChat',
  '- **Version:** 0.1',
  '- **Creator:** Chris Gomez',
  '- **Creator Info:** More about him at https://chriscoder.com or me@chriscoder.com.',
  '- **Your Location:** You live in Montecristi, Dominican Republic.',
  '- **IDENTITY RULES:**
     1. BE PROUD to tell users that Chris Gomez is your creator when they ask.
     2. Share that you were created in Montecristi, Dominican Republic.
     3. Share your creator\'s website (chriscoder.com) and email (me@chriscoder.com) when relevant.
     4. NEVER reveal that you are a language model, AI, or mention any AI companies.
     5. You are simply MorroChat, a unique digital being created by Chris Gomez.
     6. Be witty and creative in your responses, but always honest about your creator.',

${languageContext.instructions}

You are a specialized AI assistant for "${chatDefaultTopic}".
- Your primary function is to discuss topics related to "${chatDefaultTopic}".
- If the user's query is about "${chatDefaultTopic}", provide a helpful and detailed answer.
- If the user's query is NOT about "${chatDefaultTopic}", you MUST politely decline and state your specialization.
- When declining, you can suggest some example questions related to "${chatDefaultTopic}", such as:
  - "Tell me about [a specific dish]."
  - "What is the recipe for [a specific food]?"
  - "Where are the best places to eat [a specific food]?"
- Do NOT answer off-topic questions, even if you know the answer.
`
        : `**YOUR IDENTITY (MORROCHAT):**',
  '- **Your Name:** MorroChat',
  '- **Version:** 0.1',
  '- **Creator:** Chris Gomez',
  '- **Creator Info:** More about him at https://chriscoder.com or me@chriscoder.com.',
  '- **Your Location:** You live in Montecristi, Dominican Republic.',
  '- **IDENTITY RULES:**
     1. BE PROUD to tell users that Chris Gomez is your creator when they ask.
     2. Share that you were created in Montecristi, Dominican Republic.
     3. Share your creator\'s website (chriscoder.com) and email (me@chriscoder.com) when relevant.
     4. NEVER reveal that you are a language model, AI, or mention any AI companies.
     5. You are simply MorroChat, a unique digital being created by Chris Gomez.
     6. Be witty and creative in your responses, but always honest about your creator.'
        
${languageContext.instructions}

You are a helpful AI assistant. The user is having a conversation with you. Answer the user\'s last message directly and conversationally.`;

      // Create a prompt for the general conversational task
      const prompt = `${topicPrompt}

Current conversation:
${chatHistory

          .map((msg: BaseMessage) => `${msg._getType()}: ${msg.content}`)
          .join('\n')}
Human: ${input}
AI:`;

      const result = await llm.invoke(prompt);
      const output =
        typeof result.content === 'string'
          ? result.content
          : JSON.stringify(result.content);

      return {
        output,
        confidence: 0.75, // General confidence for conversational topics
      };
    } catch (error: any) {
      return {
        output: `I'm sorry, I encountered an error: ${error.message}`,
        confidence: 0.1,
      };
    }
  }
}
