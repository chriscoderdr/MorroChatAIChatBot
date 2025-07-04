// agent-orchestrator.ts
import { AgentRegistry } from './agent-registry';
import { AgentContext, AgentResult, AgentName } from './types';

export class AgentOrchestrator {
  // Run agents in parallel and return all results
  static async runParallel(
    agentNames: AgentName[],
    input: string,
    context: AgentContext,
  ): Promise<{ [agent: string]: AgentResult }> {
    const boundCallAgent = (
      name: AgentName,
      input: string,
      context: AgentContext,
    ) => AgentRegistry.callAgent(name, input, context);

    // Filter out non-existent agents
    const availableAgents = agentNames.filter((name) => {
      const exists = !!AgentRegistry.getAgent(name);
      if (!exists) {
        console.warn(`Agent '${name}' not found in registry. Skipping.`);
      }
      return exists;
    });

    // If no agents available, try fallback
    if (availableAgents.length === 0) {
      console.warn(
        `None of the requested agents exist: [${agentNames.join(', ')}]. Trying fallback agents.`,
      );

      const fallbackAgent = [
        'GeneralAgent',
        'web_search',
        'ResearchAgent',
      ].find((name) => !!AgentRegistry.getAgent(name as AgentName));

      if (fallbackAgent) {
        console.log(`Using '${fallbackAgent}' as fallback agent`);
        availableAgents.push(fallbackAgent as AgentName);
      } else {
        return {
          fallback: {
            output:
              "I'm having trouble processing your request right now. Our agent system is experiencing issues.",
            confidence: 0,
          },
        };
      }
    }

    // Execute all available agents in parallel
    const results = await Promise.allSettled(
      availableAgents.map(async (name) => {
        console.log(
          `AgentOrchestrator.runParallel: Processing agent '${name}'`,
        );
        const agentHandler = AgentRegistry.getAgent(name)!;

        try {
          const result = await agentHandler.handle(
            input,
            context,
            boundCallAgent,
          );
          return [name, result] as [string, AgentResult];
        } catch (error) {
          console.error(`Error in agent '${name}':`, error);
          return [
            name,
            {
              output: `Error processing request with agent '${name}'.`,
              confidence: 0.1,
            },
          ] as [string, AgentResult];
        }
      }),
    );

    // Convert results to object, handling any rejections
    return Object.fromEntries(
      results
        .filter(
          (result): result is PromiseFulfilledResult<[string, AgentResult]> =>
            result.status === 'fulfilled',
        )
        .map((result) => result.value),
    );
  }

  // Run a single agent efficiently
  static async runSingleAgent(
    agentName: AgentName,
    input: string,
    context: AgentContext,
  ): Promise<AgentResult> {
    console.log(
      `AgentOrchestrator.runSingleAgent: Processing agent '${agentName}'`,
    );

    const agentHandler = AgentRegistry.getAgent(agentName);
    if (!agentHandler) {
      console.error(`Agent '${agentName}' not found in registry`);
      throw new Error(`Agent '${agentName}' not found`);
    }

    try {
      const boundCallAgent = (
        name: AgentName,
        input: string,
        context: AgentContext,
      ) => AgentRegistry.callAgent(name, input, context);
      return await agentHandler.handle(input, context, boundCallAgent);
    } catch (error: unknown) {
      console.error(`Error in agent '${agentName}':`, error);
      return {
        output: `Error processing request with agent '${agentName}'.`,
        confidence: 0.1,
      };
    }
  }

  private static async predictBestAgent(
    input: string,
    availableAgents: AgentName[],
    context: AgentContext,
  ): Promise<{ agentName: AgentName; confidence: number }> {
    const routingAgent = AgentRegistry.getAgent('routing');
    if (!routingAgent) {
      console.warn('Routing agent not available, using fallback.');
      return {
        agentName: availableAgents.includes('ResearchAgent')
          ? 'ResearchAgent'
          : 'GeneralAgent',
        confidence: 0.5,
      };
    }

    try {
      const result = await routingAgent.handle(
        input,
        { ...context, availableAgents },
        AgentRegistry.callAgent,
      );
      let jsonString = result.output.trim();

      // Handle potential markdown code block
      const codeBlockMatch = jsonString.match(
        /```(?:json)?\s*(\{[\s\S]*?\})\s*```/,
      );
      if (codeBlockMatch && codeBlockMatch[1]) {
        jsonString = codeBlockMatch[1];
      }

      const prediction = JSON.parse(jsonString) as {
        agentName: AgentName;
        confidence: number;
        error?: string;
        message?: string;
      };

      if (prediction.error) {
        throw new Error(prediction.message);
      }

      if (
        prediction.agentName &&
        availableAgents.includes(prediction.agentName)
      ) {
        console.log(
          `Routing agent predicted: ${prediction.agentName} with confidence ${prediction.confidence}`,
        );
        return {
          agentName: prediction.agentName,
          confidence: prediction.confidence,
        };
      }
    } catch (error: unknown) {
      console.error('Error in routing agent prediction:', error);
    }

    // Fallback if routing fails
    return {
      agentName: availableAgents.includes('ResearchAgent')
        ? 'ResearchAgent'
        : 'GeneralAgent',
      confidence: 0.5,
    };
  }

  // Confidence-based routing: use LLM to predict best agent, then run it and verify
  static async routeByConfidence(
    agentNames: AgentName[],
    input: string,
    context: AgentContext,
    threshold = 0.7,
  ): Promise<{
    agent: string;
    result: AgentResult;
    all: { [agent: string]: AgentResult };
  }> {
    try {
      console.log(
        `Starting confidence-based routing for input: "${input.substring(0, 50)}${input.length > 50 ? '...' : ''}"`,
      );
      console.log(`Available agents: ${agentNames.join(', ')}`);
      console.log(`Confidence threshold: ${threshold}`);

      // First, check for profanity
      const { nastyScoreService, nonsenseScoreService, userId } = context;
      if (nastyScoreService && userId) {
        const score = await nastyScoreService.getScore(userId);
        if (score >= 5) {
          return {
            agent: 'nasty_score_block',
            result: {
              output:
                'You have been blocked due to repeated inappropriate language.',
              confidence: 1.0,
            },
            all: {},
          };
        }
      }

      const profanityCheck = await this.runSingleAgent(
        'profanity_check',
        input,
        context,
      );
      if (profanityCheck.confidence === 1.0) {
        if (nastyScoreService && userId) {
          await nastyScoreService.incrementScore(userId);
        }
        return {
          agent: 'profanity_check',
          result: {
            output: profanityCheck.output, // The output is now the creative response
            confidence: 1.0,
          },
          all: { profanity_check: profanityCheck },
        };
      }

      // Second, check for nonsense
      if (nonsenseScoreService && userId) {
        const score = await nonsenseScoreService.getScore(userId);
        if (score >= 5) {
          return {
            agent: 'nonsense_block',
            result: {
              output:
                'You have been blocked due to repeated nonsensical input.',
              confidence: 1.0,
            },
            all: {},
          };
        }
      }

      const nonsenseCheck = await this.runSingleAgent(
        'nonsense_check',
        input,
        context,
      );
      if (nonsenseCheck.confidence === 1.0) {
        if (nonsenseScoreService && userId) {
          await nonsenseScoreService.incrementScore(userId);
        }
        return {
          agent: 'nonsense_check',
          result: {
            output: nonsenseCheck.output,
            confidence: 1.0,
          },
          all: { nonsense_check: nonsenseCheck },
        };
      }

      // Get LLM prediction for best agent
      const prediction = await this.predictBestAgent(
        input,
        agentNames,
        context,
      );
      console.log(
        `LLM predicted: ${prediction.agentName} (confidence: ${prediction.confidence.toFixed(2)})`,
      );

      // High confidence prediction - try single agent first
      if (prediction.confidence >= threshold) {
        console.log(
          `High confidence (>= ${threshold}), running single agent: ${prediction.agentName}`,
        );
        try {
          const singleResult = await this.runSingleAgent(
            prediction.agentName,
            input,
            context,
          );

          // Verify result quality (basic check for meaningful output)
          if (singleResult?.output && singleResult.output.trim().length > 20) {
            console.log(
              `Single agent ${prediction.agentName} succeeded with high confidence`,
            );
            return {
              agent: prediction.agentName,
              result: singleResult,
              all: { [prediction.agentName]: singleResult },
            };
          } else {
            console.log(
              `Single agent ${prediction.agentName} returned insufficient output, falling back to parallel`,
            );
          }
        } catch (error: unknown) {
          console.error(
            `Error running predicted agent ${prediction.agentName}:`,
            error,
          );
        }
      } else {
        console.log(
          `Lower confidence (< ${threshold}), will use parallel execution`,
        );
      }

      // Lower confidence or fallback - run predicted + backup agent in parallel
      const backupAgent =
        prediction.agentName !== 'GeneralAgent' &&
        agentNames.includes('GeneralAgent')
          ? 'GeneralAgent'
          : null;
      const agentsToRun = backupAgent
        ? [prediction.agentName, backupAgent]
        : [prediction.agentName];

      console.log(`Running agents in parallel: ${agentsToRun.join(', ')}`);
      const allResults = await this.runParallel(
        agentsToRun as AgentName[],
        input,
        context,
      );

      // Prefer LLM prediction if it provided a valid result
      if (allResults[prediction.agentName]?.output) {
        console.log(`Using predicted agent ${prediction.agentName} result`);
        return {
          agent: prediction.agentName,
          result: allResults[prediction.agentName],
          all: allResults,
        };
      }

      // Fallback to backup agent
      if (backupAgent && allResults[backupAgent]?.output) {
        console.log(`Using backup agent ${backupAgent} result`);
        return {
          agent: backupAgent,
          result: allResults[backupAgent],
          all: allResults,
        };
      }

      // Last resort: use any available result
      const availableAgent = Object.keys(allResults).find(
        (key) => allResults[key]?.output,
      );
      if (availableAgent) {
        console.log(`Using any available agent ${availableAgent} result`);
        return {
          agent: availableAgent,
          result: allResults[availableAgent],
          all: allResults,
        };
      }

      throw new Error('No agent returned a result');
    } catch (error: unknown) {
      console.error('Error in routeByConfidence:', error);
      return {
        agent: 'fallback',
        result: {
          output: "I'm having trouble processing your request right now.",
          confidence: 0,
        },
        all: {},
      };
    }
  }
}
