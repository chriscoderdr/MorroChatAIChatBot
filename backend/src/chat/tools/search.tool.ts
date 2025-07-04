import { BraveSearch } from '@langchain/community/tools/brave_search';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { TavilySearch } from '@langchain/tavily';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

export const createSearchTool = (
  configService: ConfigService,
  logger: Logger,
) => {
  return new DynamicStructuredTool({
    name: 'search',
    description:
      'Searches the web for up-to-date information using a configurable search engine. Supports complex queries including site exclusions.',
    schema: z.object({
      query: z.string().describe('The main search query.'),
      exclude_sites: z
        .array(z.string())
        .optional()
        .describe(
          'A list of domains to exclude from the search (e.g., ["rt.com", "sputniknews.com"]).',
        ),
    }),
    func: async ({ query, exclude_sites }) => {
      let fullQuery = query;
      if (exclude_sites && exclude_sites.length > 0) {
        const exclusionString = exclude_sites
          .map((site) => `-site:${site}`)
          .join(' ');
        fullQuery = `${query} ${exclusionString}`;
      }

      const searxngBaseUrl =
        configService.get<string>('SEARXNG_BASE_URL') ||
        'http://localhost:8888';
      const braveApiKey = configService.get<string>('BRAVE_API_KEY');
      const tavilyApiKey = configService.get<string>('TAVILY_API_KEY');

      // Priority: SearxNG -> Brave -> Tavily -> Public SearxNG fallback
      if (searxngBaseUrl) {
        logger.log(`Using SearxNG for web search with query: ${fullQuery}`);
        const url = new URL(searxngBaseUrl);
        url.searchParams.append('q', fullQuery);
        url.searchParams.append('format', 'json');
        try {
          const response = await fetch(url.toString(), {
            headers: {
              Accept: 'application/json',
            },
          });
          if (!response.ok) {
            const errorBody = await response.text();
            logger.error(
              `SearxNG request failed with status ${response.status} for query: ${fullQuery}. Body: ${errorBody}`,
            );
            return JSON.stringify({
              error: `Search failed: The search engine returned an error (status ${response.status}).`,
            });
          }
          const responseText = await response.text();
          try {
            const json = JSON.parse(responseText);
            return JSON.stringify(json.results || []);
          } catch (e) {
            logger.error(
              `SearxNG returned non-JSON response for query: "${fullQuery}".\nRESPONSE BODY:\n${responseText}`,
            );
            return JSON.stringify({
              error:
                'Search failed: The search engine returned an invalid response (not JSON).',
            });
          }
        } catch (e) {
          logger.error(
            `SearxNG search failed for query: ${fullQuery}`,
            e.stack,
          );
          return JSON.stringify({ error: 'Search failed.' });
        }
      } else if (braveApiKey) {
        logger.log(`Using Brave for web search with query: ${fullQuery}`);
        try {
          const brave = new BraveSearch({ apiKey: braveApiKey });
          const results = await brave.invoke(fullQuery);
          return results; // Brave returns a string, which is fine
        } catch (e) {
          logger.error(
            'Brave search failed, falling back to SearxNG',
            e.stack,
          );
        }
      } else if (tavilyApiKey) {
        logger.log(`Using Tavily for web search with query: ${fullQuery}`);
        try {
          const tavily = new TavilySearch({ tavilyApiKey });
          const results = await tavily.invoke({ query: fullQuery });
          // Check for Tavily's specific rate limit error in the response
          if (typeof results === 'string' && results.includes('rate limit')) {
            logger.warn(
              'Tavily search hit a rate limit, falling back to SearxNG',
            );
          } else {
            return results; // Tavily also returns a string
          }
        } catch (e) {
          logger.error(
            'Tavily search failed, falling back to SearxNG',
            e.stack,
          );
        }
      }

      // Fallback to public SearxNG
      logger.log(
        `No search provider configured or primary search failed, defaulting to public SearxNG instance with query: ${fullQuery}`,
      );
      const fallbackUrl = 'https://searx.info/';
      const url = new URL(fallbackUrl);
      url.searchParams.append('q', fullQuery);
      url.searchParams.append('format', 'json');
      try {
        const response = await fetch(url.toString(), {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          const errorBody = await response.text();
          logger.error(
            `Fallback SearxNG request failed with status ${response.status} for query: ${fullQuery}. Body: ${errorBody}`,
          );
          return JSON.stringify({
            error: `Search failed: The fallback search engine returned an error (status ${response.status}).`,
          });
        }
        const responseText = await response.text();
        try {
          const json = JSON.parse(responseText);
          return JSON.stringify(json.results || []);
        } catch (e) {
          logger.error(
            `Fallback SearxNG returned non-JSON response for query: "${fullQuery}".\nRESPONSE BODY:\n${responseText}`,
          );
          return JSON.stringify({
            error:
              'Search failed: The fallback search engine returned an invalid response (not JSON).',
          });
        }
      } catch (e) {
        logger.error(
          `Fallback SearxNG search failed for query: ${fullQuery}`,
          e.stack,
        );
        return JSON.stringify({ error: 'Search failed.' });
      }
    },
  });
};
