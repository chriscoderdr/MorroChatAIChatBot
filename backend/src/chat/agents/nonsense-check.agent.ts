import { Agent, AgentName, AgentResult } from '../types';
import { LanguageManager } from '../utils/language-utils';

export class NonsenseCheckAgent implements Agent {
  public name: AgentName = 'nonsense_check';
  public description =
    'Detects nonsensical input and provides a creative response.';

  private stripMarkdown(text: string): string {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
  }

  public async handle(input: string, context: any): Promise<AgentResult> {
    const nonsenseCheckPrompt = `Analyze the following text and determine if it's genuinely nonsensical gibberish, with these important guidelines:

NOT Nonsense (return isNonsense: false):
1. Common typos and misspellings (e.g., "youre" instead of "you're")
2. Missing or incorrect punctuation
3. Text that has obvious meaning despite errors (e.g., "Id love youe gelp" = "I'd love your help")
4. Text in any language, even if poorly written
5. Common internet/SMS abbreviations (e.g., "u" for "you", "r" for "are")
6. Slang or informal language

IS Nonsense (return isNonsense: true):
1. Random character strings (e.g., "asdfgh", "qwerty")
2. Completely incoherent text with no discernible meaning
3. Random keyboard mashing
4. Repeated single characters with no meaning (e.g., "aaaaaaaa")

Text to analyze: "${input}"

Respond with a single JSON object with one key: "isNonsense" (boolean).
First try to find any potential meaning in the text, even if poorly written.
Only mark as nonsense if there is absolutely no discernible meaning.`;

    const nonsenseResult = await context.llm.invoke(nonsenseCheckPrompt);
    const cleanedResult = this.stripMarkdown(nonsenseResult.content as string);

    let response;
    try {
      response = JSON.parse(cleanedResult);
    } catch (error) {
      console.error(
        'Failed to parse JSON from nonsense check LLM:',
        cleanedResult,
      );
      // Fallback or default behavior if JSON is invalid
      return {
        output:
          "I'm having a little trouble understanding. Could you please rephrase that?",
        confidence: 0.5, // Unsure
      };
    }

    if (response.isNonsense) {
      // Access chat history from the context
      const chatHistory = (context.chatHistory?.messages || [])
        .slice(-10) // Get last 10 messages
        .map((msg) => `${msg._getType()}: ${msg.content}`)
        .join('\n');

      // Use centralized language detection and enforcement
      let languageInstructions = '';
      let detectedLanguage = 'English';
      
      if (context.llm) {
        try {
          const languageContext = await LanguageManager.getLanguageContext(input, context.llm, 'strict');
          detectedLanguage = languageContext.language;
          languageInstructions = languageContext.instructions;
        } catch (e) {
          // fallback to basic instructions if language detection fails
          languageInstructions = 'Please respond in the same language as the user query.';
        }
      }
      
      const creativeResponsePrompt = `The user's message needs clarification: "${input}".

${languageInstructions}

RESPONSE GUIDELINES:
1. If it looks like typos/misspellings, try to understand the intended meaning
2. If you can guess what they meant, acknowledge it: "Did you mean...?"
3. Stay friendly and helpful, avoid being condescending
4. For genuine gibberish, be playful but encouraging
5. Keep responses fresh and unique

Use the chat history to avoid repetitive responses:
<history>
${chatHistory}
</history>

Examples:
- For typos ("Id love youe gelp"): "I think you meant 'I'd love your help'? I'm here to assist!"
- For gibberish ("asdfasdf"): "My keyboard has those keys too! But could we try arranging them into words?"

Now, generate a new, creative response to the user's message: "${input}" in ${detectedLanguage}.
`;

      const creativeResult = await context.llm.invoke(creativeResponsePrompt);

      return {
        output: creativeResult.content as string,
        confidence: 1.0,
      };
    }

    return {
      output: 'No nonsense detected.',
      confidence: 0.0, // Confident it's not nonsense, so other agents should run.
    };
  }
}
