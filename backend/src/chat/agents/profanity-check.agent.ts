import { Agent, AgentName, AgentResult } from '../types';

export class ProfanityCheckAgent implements Agent {
  public name: AgentName = 'profanity_check';
  public description =
    'Detects profane language in user input and provides a creative response.';

  private stripMarkdown(text: string): string {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
  }

  public async handle(input: string, context: any): Promise<AgentResult> {
    const profanityCheckPrompt = `Analyze the following text for profanity, insults, or offensive language. Respond with a single JSON object with two keys: "isProfane" (a boolean) and "profanityLevel" (a string: "mild", "moderate", or "severe").

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
      const profanityLevel = response.profanityLevel || 'mild';
      const { nastyScoreService, userId } = context;

      if (nastyScoreService && userId) {
        let amount = 1;
        if (profanityLevel === 'moderate') {
          amount = 2;
        } else if (profanityLevel === 'severe') {
          amount = 3;
        }
        nastyScoreService.incrementScore(userId, amount);
      }

      // Access chat history from the context
      const chatHistory = (context.chatHistory?.messages || [])
        .slice(-10) // Get last 10 messages
        .map((msg) => `${msg._getType()}: ${msg.content}`)
        .join('\n');

      const creativeResponsePrompt = `The user's latest message contains profanity: "${input}". The profanity level is "${profanityLevel}".

Your task is to respond in a way that is creative, witty, and directly acknowledges the user's language without being preachy or repetitive. The response should be appropriate for the profanity level.

- For "mild" profanity, you could say something like: "Easy there, let's keep the conversation friendly." or "I understand you're frustrated, but let's try to use more positive language."
- For "moderate" profanity, you might say: "I'd appreciate it if you'd avoid that kind of language. I'm here to help, but let's keep it respectful." or "That language isn't necessary. Let's focus on the issue at hand."
- For "severe" profanity, a firm response is needed: "I won't continue this conversation if you use that language. Please be respectful, or I'll have to end this chat." or "This conversation is over if you continue to use that language."

You must not use the same response twice, even if the user repeats themselves. Do not use the same opening phrase (e.g., "Whoa there, partner."). Your response must be completely different from the previous ones in the chat history.

Use the chat history to see what has been said before and ensure your response is fresh and unique.

<history>
${chatHistory}
</history>

Now, generate a new, creative response to the user's message: "${input}"
`;

      const creativeResult = await context.llm.invoke(creativeResponsePrompt, {
        temperature: 0.7,
      });

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
