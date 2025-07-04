import { DynamicStructuredTool } from '@langchain/core/tools';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { z } from 'zod';

export const createHashingTool = (
  configService: ConfigService,
  logger: Logger,
) => {
  return new DynamicStructuredTool({
    name: 'hashing',
    description:
      'Hashes a string using a specified algorithm (e.g., sha256, md5).',
    schema: z.object({
      text: z.string().describe('The text to hash.'),
      algorithm: z
        .string()
        .describe('The hashing algorithm, e.g., "sha256", "md5".'),
    }),
    func: async ({ text, algorithm }) => {
      const searxngBaseUrl =
        configService.get<string>('SEARXNG_BASE_URL') ||
        'http://localhost:8888';
      if (!searxngBaseUrl) {
        return 'Hashing functionality is not available (SearxNG not configured).';
      }
      const query = `${algorithm} ${text}`;
      const url = new URL(searxngBaseUrl);
      url.searchParams.append('q', query);
      url.searchParams.append('format', 'json');
      try {
        const response = await fetch(url.toString(), {
          headers: {
            Accept: 'application/json',
            'X-Forwarded-For': '127.0.0.1',
            'X-Real-IP': '127.0.0.1',
          },
        });
        const json = await response.json();
        logger.debug(
          `Hashing SearXNG response for "${query}": ${JSON.stringify(
            json,
            null,
            2,
          )}`,
        );
        const answer = json.answers?.find(
          (a: any) => a.engine === 'plugin: hash_plugin',
        );
        if (answer) {
          const result = answer.answer.split('hash digest:');
          return `### 🔒 Hashing Result\n**Text:** \`${text}\`\n**Algorithm:** \`${algorithm}\`\n**Hash:** \`${
            result[1]
          }\``;
        }
        return `Could not compute ${algorithm} hash.`;
      } catch (e) {
        logger.error(`Hashing tool failed for: "${query}"`, e);
        return 'Failed to get hash result.';
      }
    },
  });
};
