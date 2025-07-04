import { DynamicStructuredTool } from '@langchain/core/tools';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { z } from 'zod';

export const createCurrencyConverterTool = (
  configService: ConfigService,
  logger: Logger,
) => {
  return new DynamicStructuredTool({
    name: 'currency_converter',
    description: 'Converts between different currencies.',
    schema: z.object({
      query: z
        .string()
        .describe(
          'The currency conversion query, e.g., "100 USD to EUR".',
        ),
    }),
    func: async ({ query }) => {
      const searxngBaseUrl =
        configService.get<string>('SEARXNG_BASE_URL') ||
        'http://localhost:8888';
      if (!searxngBaseUrl) {
        return 'Currency conversion is not available (SearxNG not configured).';
      }
      const url = new URL(searxngBaseUrl);
      url.searchParams.append('q', query);
      url.searchParams.append('format', 'json');
      try {
        const response = await fetch(url.toString(), {
          headers: { Accept: 'application/json' },
        });
        const json = await response.json();
        logger.debug(
          `Currency Converter SearXNG response for "${query}": ${JSON.stringify(
            json,
            null,
            2,
          )}`,
        );
        const answer = json.answers?.find(
          (a: any) => a.engine === 'currency',
        );
        if (answer) {
          return `### 💰 Currency Conversion\n**Query:** \`${query}\`\n**Result:** \`${answer.answer}\``;
        }
        return 'Could not perform the currency conversion.';
      } catch (e) {
        logger.error(`Currency converter tool failed for: "${query}"`, e);
        return 'Failed to get currency conversion result.';
      }
    },
  });
};
