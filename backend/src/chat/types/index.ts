import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';

export type AgentName =
  | 'document_search'
  | 'DocumentSearchAgent'
  | 'code_interpreter'
  | 'CodeInterpreterAgent'
  | 'code_optimization'
  | 'CodeOptimizationAgent'
  | 'code_generation'
  | 'CodeGenerationAgent'
  | 'profanity_check'
  | 'ProfanityCheckAgent'
  | 'nonsense_check'
  | 'NonsenseCheckAgent'
  | 'general'
  | 'GeneralAgent'
  | 'research'
  | 'ResearchAgent'
  | 'routing'
  | 'RoutingAgent'
  | 'summarizer'
  | 'SummarizerAgent'
  | 'weather'
  | 'WeatherAgent'
  | 'search'
  | 'time'
  | 'current_time'
  | 'open_weather_map'
  | 'subject_inference'
  | 'calculator'
  | 'unit_converter'
  | 'hashing'
  | 'currency_converter';

export interface AgentContext {
  sessionId: string;
  chatHistory: BaseMessage[];
  input: string;
  llm?: BaseChatModel;
  chatDefaultTopic?: string;
  [key: string]: any;
}

export interface AgentResult {
  output: string;
  [key: string]: any;
}

export interface Agent {
  name: AgentName;
  description: string;
  handle: AgentHandler;
}

export type AgentHandler = (
  input: string,
  context: AgentContext,
  callAgent?: (
    name: AgentName,
    input: string,
    context: AgentContext,
  ) => Promise<AgentResult>,
) => Promise<AgentResult>;
