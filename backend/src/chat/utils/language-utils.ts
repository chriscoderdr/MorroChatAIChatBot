// language-utils.ts
import { Logger } from '@nestjs/common';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

const logger = new Logger('LanguageUtils');

/**
 * Detects the language of a given text input using LLM
 * @param text The text to detect the language for
 * @param llm The LLM instance to use for detection
 * @param defaultLanguage The default language to return if detection fails
 * @param nonsenseBehavior How to handle nonsensical text
 * @returns The detected language name (e.g., "English", "Spanish") 
 */
export async function detectLanguage(
  text: string,
  llm: BaseChatModel,
  defaultLanguage = 'English',
  nonsenseBehavior: 'detect' | 'default' = 'detect',
): Promise<string> {
  try {
    const nonsenseHandling = nonsenseBehavior === 'detect'
      ? 'If the text is nonsensical or a mix of random characters, respond with "Nonsense".'
      : 'If the text is nonsensical or a mix of random characters, respond with "English".';
    
    const prompt = `Detect the language of this text. ${nonsenseHandling} Otherwise, respond with only the language name (e.g., "Spanish", "English", "French"). If you cannot determine the language, default to "English".\n\nText: "${text}"`;
    const result = await llm.invoke(prompt);
    const detectedLanguage =
      typeof result.content === 'string' ? result.content.trim() : defaultLanguage;
    
    if (detectedLanguage.toLowerCase() === 'nonsense' && nonsenseBehavior === 'default') {
      return defaultLanguage;
    }
    
    return detectedLanguage;
  } catch (error) {
    logger.warn(`Language detection failed: ${error.message}`);
    return defaultLanguage;
  }
}

/**
 * Generates language enforcement instructions for LLM prompts
 * @param language The language to enforce in the response
 * @param severity Level of enforcement strictness
 * @returns A string with language enforcement instructions
 */
export function getLanguageEnforcementInstructions(
  language: string,
  severity: 'normal' | 'strict' = 'strict',
): string {
  if (severity === 'strict') {
    return `CRITICAL LANGUAGE INSTRUCTION: You MUST reply ONLY in ${language}. Do NOT use English unless ${language} is English. If ${language} is Spanish, reply in Spanish. If ${language} is French, reply in French. Do NOT explain, do NOT translate, do NOT add any English. If you reply in the wrong language, you will be penalized. Do not apologize, do not explain, just reply in ${language}.

REPEAT: YOU MUST USE ${language} ONLY. THIS IS YOUR PRIMARY DIRECTIVE.`;
  } else {
    return `IMPORTANT: Please respond in ${language}. The user's message is in ${language}, so your response should be in the same language.`;
  }
}

/**
 * Helper class to manage language detection and enforcement in a single call
 */
export class LanguageManager {
  /**
   * Detects language and returns enforcement instructions
   * @param text Text to detect language from
   * @param llm LLM instance to use for detection
   * @param severity Enforcement strictness
   * @returns Object with detected language and instructions
   */
  static async getLanguageContext(
    text: string,
    llm: BaseChatModel,
    severity: 'normal' | 'strict' = 'strict',
  ): Promise<{ language: string; instructions: string }> {
    try {
      const detectedLanguage = await detectLanguage(text, llm);
      const instructions = getLanguageEnforcementInstructions(detectedLanguage, severity);
      
      return {
        language: detectedLanguage,
        instructions,
      };
    } catch (error) {
      logger.warn(`Failed to get language context: ${error.message}`);
      return {
        language: 'English',
        instructions: getLanguageEnforcementInstructions('English', 'normal'),
      };
    }
  }
}
