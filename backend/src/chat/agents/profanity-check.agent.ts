import { Agent, AgentName, AgentResult } from '../types';

export class ProfanityCheckAgent implements Agent {
  public name: AgentName = 'profanity_check';
  public description =
    'Detects profane language in user input and provides a creative response.';

  private stripMarkdown(text: string): string {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
  }

  public async handle(input: string, context: any): Promise<AgentResult> {
    const profanityCheckPrompt = `Analyze the following text for profanity, insults, or offensive language. Respond with a single JSON object with one key: "isProfane" (a boolean).

Text: "${input}"`;

    const profanityResult = await context.llm.invoke(profanityCheckPrompt);
    const cleanedResult = this.stripMarkdown(profanityResult.content as string);

    let response;
    try {
      response = JSON.parse(cleanedResult);
    } catch (error) {
      console.error(
        'Failed to parse JSON from profanity check LLM:',
        cleanedResult,
      );
      // Fallback or default behavior if JSON is invalid
      return {
        output:
          "I'm having a little trouble understanding the vibe. Let's keep it friendly, okay?",
        confidence: 0.5, // Unsure
      };
    }

    if (response.isProfane) {
      // Access chat history from the context
      const chatHistory = (context.chatHistory?.messages || [])
        .slice(-10) // Get last 10 messages
        .map((msg) => `${msg._getType()}: ${msg.content}`)
        .join('\n');

      const creativeResponsePrompt = `The user's latest message contains profanity: "${input}".

Your task is to respond in a way that is creative, witty, and directly acknowledges the user's language without being preachy or repetitive. You must not use the same response twice, even if the user repeats themselves.

Use the chat history to see what has been said before and ensure your response is fresh and unique.

<history>
${chatHistory}
</history>

For example, if the user says "fuck you", a good response might be:
"Whoa, someone's feeling spicy! I'm a chatbot, so I don't have feelings to hurt, but let's try to keep the conversation productive."

Now, generate a new, creative response to the user's message: "${input}"
`;

      const creativeResult = await context.llm.invoke(creativeResponsePrompt);

      return {
        output: creativeResult.content as string,
        confidence: 1.0,
      };
    }

    return {
      output: 'No profanity detected.',
      confidence: 0.0, // Confident it's not profane, so other agents should run.
    };
  }
}
