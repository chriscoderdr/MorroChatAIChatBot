import { Provider } from '@nestjs/common';
import { AgentRegistry } from './agent-registry';
import { SummarizerAgent } from './summarizer.agent';
import { ResearchAgent } from './research.agent';
import { CodeInterpreterAgent } from './code-interpreter.agent';
import { CodeOptimizationAgent } from './code-optimization.agent';
import { WeatherAgent } from './weather.agent';
import { RoutingAgent } from './routing.agent';
import { SubjectInferenceAgent } from './subject-inference.agent';
import { DocumentSearchAgent } from './document-search.agent';
import { GeneralAgent } from './general.agent';
import { TimeAgent } from './time.agent';

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
