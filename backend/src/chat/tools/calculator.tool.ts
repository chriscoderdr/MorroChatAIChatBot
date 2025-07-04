import { DynamicStructuredTool } from '@langchain/core/tools';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { z } from 'zod';

export const createCalculatorTool = (
  configService: ConfigService,
  logger: Logger,
) => {
  return new DynamicStructuredTool({
    name: 'calculator',
    description:
      'Calculates mathematical expressions. Use for questions involving arithmetic.',
    schema: z.object({
      expression: z
        .string()
        .describe('The mathematical expression to evaluate, e.g., "2+2".'),
    }),
    func: async ({ expression }) => {
      const searxngBaseUrl =
        configService.get<string>('SEARXNG_BASE_URL') ||
        'http://localhost:8888';
      if (!searxngBaseUrl) {
        return 'Calculator functionality is not available (SearxNG not configured).';
      }
      const url = new URL(searxngBaseUrl);
      url.searchParams.append('q', expression);
      url.searchParams.append('format', 'json');
      try {
        const response = await fetch(url.toString(), {
          headers: { Accept: 'application/json' },
        });
        const json = await response.json();
        logger.debug(
          `Calculator SearXNG response for "${expression}": ${JSON.stringify(
            json,
            null,
            2,
          )}`,
        );
        const answer = json.answers?.find(
          (a: any) => a.engine === 'plugin: calculator',
        );
        if (answer) {
          const result = answer.answer.split('=');
          return `### 🧮 Calculator Result\n**Expression:** \`${
            result[0]
          }\`\n**Result:** \`${result[1]}\``;
        }
        return 'Could not calculate the expression.';
      } catch (e) {
        logger.error(`Calculator tool failed for: "${expression}"`, e);
        return 'Failed to get calculation result.';
      }
    },
  });
};
