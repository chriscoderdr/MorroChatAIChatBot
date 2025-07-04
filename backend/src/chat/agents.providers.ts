import { Provider } from '@nestjs/common';
import { AgentRegistry } from './agent-registry';
import { SummarizerAgent } from './agents/summarizer.agent';
import { ResearchAgent } from './agents/research.agent';
import { CodeInterpreterAgent } from './agents/code-interpreter.agent';
import { CodeOptimizationAgent } from './agents/code-optimization.agent';
import { WeatherAgent } from './agents/weather.agent';
import { RoutingAgent } from './agents/routing.agent';
import { SubjectInferenceAgent } from './agents/subject-inference.agent';
import { DocumentSearchAgent } from './agents/document-search.agent';
import { GeneralAgent } from './agents/general.agent';
import { TimeAgent } from './agents/time.agent';

const agentProviders: Provider[] = [
  SummarizerAgent,
  ResearchAgent,
  CodeInterpreterAgent,
  CodeOptimizationAgent,
  WeatherAgent,
  RoutingAgent,
  SubjectInferenceAgent,
  DocumentSearchAgent,
  GeneralAgent,
  TimeAgent,
];

agentProviders.forEach((agent) => {
  if ('prototype' in agent) {
    const instance = new (agent as any)();
    AgentRegistry.register(instance);
  }
});

export const agents = agentProviders;
