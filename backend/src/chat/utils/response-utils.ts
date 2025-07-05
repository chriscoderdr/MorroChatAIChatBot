import { AgentResult, AgentContext } from '../types';
import { BaseMessage } from '@langchain/core/messages';

export class ResponseFormatter {
  static formatAgentResponse(
    output: string | object,
    confidence: number,
    cleanupMetadata = true
  ): AgentResult {
    let formattedOutput = typeof output === 'string' ? output : JSON.stringify(output);

    if (cleanupMetadata) {
      formattedOutput = formattedOutput
        // Remove processing metadata
        .replace(/^[\s\S]*?FINAL ANSWER:\s*([\s\S]*)$/i, '$1')
        .replace(/^THOUGHT:.*?(?=ACTION:|OBSERVATION:|FINAL ANSWER:|$)/gims, '')
        .replace(/^ACTION:.*?(?=OBSERVATION:|THOUGHT:|FINAL ANSWER:|$)/gims, '')
        .replace(/^OBSERVATION:.*?(?=ACTION:|THOUGHT:|FINAL ANSWER:|$)/gims, '')
        // Remove search-related phrases
        .replace(/^Executing web_search.*?(?=\n|$)/gim, '')
        .replace(/^I'll search for.*?(?=\n|$)/gim, '')
        .replace(/^I need to search.*?(?=\n|$)/gim, '')
        .replace(/^Let me search for.*?(?=\n|$)/gim, '')
        .replace(/^Let's search for.*?(?=\n|$)/gim, '')
        // Remove technical keywords
        .replace(/THOUGHT:?/gi, '')
        .replace(/ACTION:?/gi, '')
        .replace(/OBSERVATION:?/gi, '')
        .replace(/web_search/gi, '')
        .replace(/\bTOOL\b/gi, '')
        .replace(/\bQUERY\b/gi, '')
        // Remove attribution phrases
        .replace(/According to (?:the|my|our) (?:search|web|)? ?results,?\s*/gi, '')
        .replace(/Based on (?:the|my|our) (?:search|web|)? ?results,?\s*/gi, '')
        .replace(/The (?:search|web|)? ?results indicate,?\s*/gi, '')
        .replace(/From the information provided,?\s*/gi, '')
        .replace(/From what I found,?\s*/gi, '')
        .trim();
    }

    return {
      output: formattedOutput,
      confidence
    };
  }

  static formatErrorResponse(
    error: Error | string,
    context?: AgentContext,
    agent?: string
  ): AgentResult {
    const errorMessage = error instanceof Error ? error.message : error;
    const agentPrefix = agent ? `[${agent}] ` : '';
    console.error(`${agentPrefix}Error in agent:`, error);
    
    return {
      output: `I apologize, but I encountered an error while processing your request. ${
        context?.chatDefaultTopic 
          ? `Remember, I'm specialized in ${context.chatDefaultTopic}. ` 
          : ''
      }Could you please try rephrasing your question?`,
      confidence: 0.1
    };
  }

  static formatChatHistory(
    history: BaseMessage[],
    limit = 10,
    format: 'text' | 'markdown' = 'text'
  ): string {
    const recentHistory = history.slice(-limit);
    
    if (format === 'markdown') {
      return recentHistory
        .map(msg => `**${msg._getType()}**: ${msg.content}`)
        .join('\n\n');
    }
    
    return recentHistory
      .map(msg => `${msg._getType()}: ${msg.content}`)
      .join('\n');
  }

  static formatRoutingResponse(
    agentName: string,
    confidence: number,
    reasoning: string
  ): string {
    return JSON.stringify({
      agentName,
      confidence,
      reasoning
    });
  }

  static formatCodeResponse(
    code: string,
    analysis: any,
    language: string
  ): string {
    return `\`\`\`${language}
${code}
\`\`\`

**Analysis:**
${Object.entries(analysis)
  .map(([key, value]) => `- **${key}**: ${value}`)
  .join('\n')}`;
  }

  static formatSearchResponse(
    results: any[],
    query: string,
    includeSources = true
  ): string {
    let response = results
      .map(r => r.content || r)
      .join('\n\n');

    if (includeSources && results.some(r => r.url)) {
      response += '\n\n## 📚 Sources\n' + 
        results
          .filter(r => r.url)
          .map(r => `- ${r.url}`)
          .join('\n');
    }

    return response;
  }
}
