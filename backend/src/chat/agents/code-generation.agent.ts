import { Agent, AgentName } from '../types';
import { detectLanguage, LanguageManager } from '../utils/language-utils';

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

      // Get language enforcement instructions
      const languageContext = await LanguageManager.getLanguageContext(input, context.llm);
      
      const synthesisPrompt = `You are an expert code generation assistant. A user has provided a request for code.

${languageContext.instructions}

**User's Request:**
${input}

**Response Structure:**
1.  Provide the generated code in a markdown block.
2.  Provide a comprehensive explanation of the generated code in a helpful, conversational tone.

Please generate the complete response now in ${languageContext.language}.`;

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
