import { Agent, AgentName, AgentResult } from '../types';

export class NonsenseCheckAgent implements Agent {
  public name: AgentName = 'nonsense_check';
  public description =
    'Detects nonsensical input and provides a creative response.';

  private stripMarkdown(text: string): string {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
  }

  public async handle(input: string, context: any): Promise<AgentResult> {
    const nonsenseCheckPrompt = `Analyze the following text for nonsense, gibberish, or random characters. Respond with a single JSON object with one key: "isNonsense" (a boolean).

Text: "${input}"`;

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

      const creativeResponsePrompt = `The user's latest message is nonsensical: "${input}".

Your task is to respond in a way that is creative and witty, without being preachy or repetitive. You must not use the same response twice, even if the user repeats themselves.

Use the chat history to see what has been said before and ensure your response is fresh and unique.

<history>
${chatHistory}
</history>

For example, if the user says "asdfasdfasdf", a good response might be:
"My keyboard has those keys too! But could we try arranging them into words?"

Now, generate a new, creative response to the user's message: "${input}"
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
