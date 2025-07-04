import { DynamicStructuredTool } from '@langchain/core/tools';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { z } from 'zod';

export const createUnitConverterTool = (
  configService: ConfigService,
  logger: Logger,
) => {
  return new DynamicStructuredTool({
    name: 'unit_converter',
    description: 'Converts between different units of measurement.',
    schema: z.object({
      query: z
        .string()
        .describe(
          'The conversion query, e.g., "10kg to lb" or "5 miles in km".',
        ),
    }),
    func: async ({ query }) => {
      const searxngBaseUrl =
        configService.get<string>('SEARXNG_BASE_URL') ||
        'http://localhost:8888';
      if (!searxngBaseUrl) {
        return 'Unit conversion is not available (SearxNG not configured).';
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
          `Unit Converter SearXNG response for "${query}": ${JSON.stringify(
            json,
            null,
            2,
          )}`,
        );
        const answer = json.answers?.find(
          (a: any) => a.engine === 'plugin: unit_converter',
        );
        if (answer) {
          return `### 📏 Unit Conversion\n**Query:** \`${query}\`\n**Result:** \`${answer.answer}\``;
        }
        return 'Could not perform the unit conversion.';
      } catch (e) {
        logger.error(`Unit converter tool failed for: "${query}"`, e);
        return 'Failed to get conversion result.';
      }
    },
  });
};
