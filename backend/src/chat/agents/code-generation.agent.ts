import { Agent, AgentName } from '../types';

const detectLanguage = async (text: string, llm: any): Promise<string> => {
  const prompt = `Detect the language of this text. If the text is nonsensical or a mix of random characters, respond with "Nonsense". Otherwise, respond with only the language name (e.g., "Spanish", "English", "French"). If you cannot determine the language, default to "English".\n\nText: "${text}"`;
  const result = await llm.invoke(prompt);
  const detectedLanguage =
    typeof result.content === 'string' ? result.content.trim() : 'English';
  if (detectedLanguage.toLowerCase() === 'nonsense') {
    return 'Nonsense';
  }
  return detectedLanguage;
};

export class CodeGenerationAgent implements Agent {
  public name: AgentName = 'code_generation';
  public description =
    'Generates code based on user requirements.';
  public async handle(input, context) {
    try {
      if (!context.llm) {
        return {
          output: "I'm sorry, I can't process this request without my core AI module.",
          confidence: 0.1,
        };
      }

      const questionLanguage = await detectLanguage(input, context.llm);

      if (questionLanguage === 'Nonsense') {
        return {
          output:
            "I'm sorry, I didn't understand your request. Could you please rephrase it?",
          confidence: 0.3,
        };
      }

      const synthesisPrompt = `You are an expert code generation assistant. A user has provided a request for code. Your response must be entirely in ${questionLanguage}.

**Your response must be entirely in ${questionLanguage}.** This includes all headers and explanatory text.

**User's Request:**
${input}

**Response Structure:**
1.  Provide the generated code in a markdown block.
2.  Provide a comprehensive explanation of the generated code in a helpful, conversational tone.

Please generate the complete response now.`;

      const llmResult = await context.llm.invoke(synthesisPrompt);
      const output =
        typeof llmResult.content === 'string' ? llmResult.content : '';

      return {
        output: output,
        confidence: 0.9,
      };
    } catch (error: any) {
      return {
        output: `Code generation failed: ${error.message}`,
        confidence: 0.1,
      };
    }
  }
}
