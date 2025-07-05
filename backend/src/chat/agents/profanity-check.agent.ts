import { Agent, AgentName, AgentResult } from '../types';
import { LanguageManager } from '../utils/language-utils';
import { ResponseFormatter } from '../utils/response-utils';

export class ProfanityCheckAgent implements Agent {
  public name: AgentName = 'profanity_check';
  public description =
    'Detects profane language in user input and provides a creative response.';

  private stripMarkdown(text: string): string {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
  }

  public async handle(input: string, context: any): Promise<AgentResult> {
    const profanityCheckPrompt = `Analyze the following text for profanity, insults, or offensive language, with these important exceptions:

IMPORTANT EXCEPTIONS - These are NOT profanity:
- "MorroChat", "Morro" - These are proper names referring to this chat agent
- Any variations or references to "Morro" when used as part of this agent's name
- Casual greetings like "sup", "hey", etc. are not considered profanity

Respond with a single JSON object with two keys:
- "isProfane" (a boolean)
- "profanityLevel" (a number from 0 to 10, where 0 means no profanity and 10 means extremely severe profanity)

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
      return ResponseFormatter.formatErrorResponse(
        "I'm having a little trouble understanding the vibe. Let's keep it friendly, okay?",
        context,
        'profanity_check'
      );
    }


    if (response.isProfane) {
      const profanityLevel = typeof response.profanityLevel === 'number' ? response.profanityLevel : 1;
      const { nastyScoreService, userId } = context;

      if (nastyScoreService && userId) {
        // Increment by 1 for low, 2 for medium, 3 for high
        let amount = 1;
        if (profanityLevel >= 4 && profanityLevel < 7) {
          amount = 2;
        } else if (profanityLevel >= 7) {
          amount = 3;
        }
        nastyScoreService.incrementScore(userId, amount);
      }

      // Access chat history from the context
      const chatHistory = (context.chatHistory?.messages || [])
        .slice(-10) // Get last 10 messages
        .map((msg) => `${msg._getType()}: ${msg.content}`)
        .join('\n');

      // Use centralized language detection and enforcement
      let languageInstructions = '';
      
      if (context.llm) {
        try {
          const languageContext = await LanguageManager.getLanguageContext(input, context.llm, 'strict');
          languageInstructions = languageContext.instructions;
        } catch (e) {
          // fallback to basic instructions if language detection fails
          languageInstructions = 'Please respond in the same language as the user query.';
        }
      }
      
      const creativeResponsePrompt = `The user's message "${input}" has been flagged with profanity level ${profanityLevel} (scale 0-10).

IMPORTANT: If this was flagged only because of informal language or slang, respond naturally and friendly instead of with sarcasm.
REMEMBER: "Morro", "MorroChat", or any variations are my name and should be treated as friendly terms.

${languageInstructions}

Your task is to:
1. For actual profanity: Respond with wit and creative flair, being playful but never mean-spirited
2. For informal language/slang: Respond naturally and conversationally
3. For my name or variants: Respond warmly as it's part of my identity

You can be witty and clever, but stay friendly unless dealing with actual offensive content.

The response should directly acknowledge the user's language and the level of profanity, and should be totally different from anything previously said in the chat history. Do not use the same opening phrase or structure as before. Surprise the user with your originality.

You may use pop culture references, clever wordplay, or creative metaphors. If the user's profanity is especially high (7-10), your sarcasm and burn can be even more intense, but still not truly offensive.

Use the chat history to see what has been said before and ensure your response is fresh and unique.

<history>
${chatHistory}
</history>

Now, generate a new, creative, and maximally sarcastic response to the user's message: "${input}"
`;

      const creativeResult = await context.llm.invoke(creativeResponsePrompt, {
        temperature: 0.7,
      });

      return ResponseFormatter.formatAgentResponse(
        creativeResult.content as string,
        1.0
      );
    }

    return ResponseFormatter.formatAgentResponse(
      'No profanity detected.',
      0.0 // Confident it's not profane, so other agents should run.
    );
  }
}
