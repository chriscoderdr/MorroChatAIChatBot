import { Agent, AgentName } from '../types';
import { detectLanguage, LanguageManager } from '../utils/language-utils';
import { ResponseFormatter } from '../utils/response-utils';

export class CodeGenerationAgent implements Agent {
  public name: AgentName = 'code_generation';
  public description =
    'Generates code based on user requirements.';
  public async handle(input, context) {
    try {
      if (!context.llm) {
        return ResponseFormatter.formatErrorResponse(
          "I'm sorry, I can't process this request without my core AI module.",
          context,
          'code_generation'
        );
      }

      const questionLanguage = await detectLanguage(input, context.llm);

      if (questionLanguage === 'Nonsense') {
        return ResponseFormatter.formatErrorResponse(
          "I'm sorry, I didn't understand your request. Could you please rephrase it?",
          context,
          'code_generation'
        );
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

      return ResponseFormatter.formatAgentResponse(output, 0.9);
    } catch (error: any) {
      return ResponseFormatter.formatErrorResponse(
        `Code generation failed: ${error.message}`,
        context,
        'code_generation'
      );
    }
  }
}
