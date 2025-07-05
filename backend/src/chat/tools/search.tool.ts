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
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

          const response = await fetch(url.toString(), {
            headers: {
              Accept: 'application/json',
            },
            signal: controller.signal
          }).finally(() => clearTimeout(timeout));

          if (!response.ok) {
            const errorBody = await response.text();
            logger.error(
              `SearxNG request failed with status ${response.status} for query: ${fullQuery}. Body: ${errorBody}`,
            );
            throw new Error(`SearxNG returned error status ${response.status}`);
          }
          const responseText = await response.text();
          try {
            const json = JSON.parse(responseText);
            if (json.results && json.results.length > 0) {
              return JSON.stringify(json.results);
            }
            // If no results, let it fall through to next search provider
            logger.warn(`SearxNG returned no results for query: ${fullQuery}, trying next provider`);
            throw new Error('No results from SearxNG');
          } catch (e) {
            logger.error(
              `SearxNG returned non-JSON response for query: "${fullQuery}".\nRESPONSE BODY:\n${responseText}`,
            );
            throw new Error('Invalid JSON response from SearxNG');
          }
        } catch (e) {
          logger.error(
            `SearxNG search failed for query: ${fullQuery}`,
            e.stack,
          );
          // Don't return error here, let it fall through to next provider
        }
      } else if (braveApiKey) {
        logger.log(`Using Brave for web search with query: ${fullQuery}`);
        try {
          const brave = new BraveSearch({ apiKey: braveApiKey });
          const results = await Promise.race([
            brave.invoke(fullQuery),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Brave search timeout')), 10000)
            )
          ]);
          
          if (results && !results.includes('error')) {
            return results; // Brave returns a string
          }
          // If no results or error, let it fall through to next provider
          logger.warn(`Brave returned no results for query: ${fullQuery}, trying next provider`);
          throw new Error('No results from Brave');
        } catch (e) {
          logger.error(
            'Brave search failed, trying next provider',
            e.stack,
          );
          // Don't return error, let it fall through to next provider
        }
      } else if (tavilyApiKey) {
        logger.log(`Using Tavily for web search with query: ${fullQuery}`);
        try {
          const tavily = new TavilySearch({ tavilyApiKey });
          const results = await Promise.race([
            tavily.invoke({ query: fullQuery }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Tavily search timeout')), 10000)
            )
          ]);
          
          // Check for Tavily's specific rate limit error in the response
          if (typeof results === 'string') {
            if (results.includes('rate limit')) {
              logger.warn('Tavily search hit a rate limit, trying next provider');
              throw new Error('Tavily rate limit');
            } else if (results && !results.includes('error')) {
              return results; // Tavily returns a string
            }
          }
          // If no results or error, let it fall through to next provider
          logger.warn(`Tavily returned no results for query: ${fullQuery}, trying next provider`);
          throw new Error('No results from Tavily');
        } catch (e) {
          logger.error(
            'Tavily search failed, trying next provider',
            e.stack,
          );
          // Don't return error, let it fall through to next provider
        }
      }

      // Try multiple public SearxNG instances as final fallback
      const fallbackInstances = [
        'https://searx.info/',
        'https://search.bus-hit.me/',
        'https://search.davidovski.xyz/',
        'https://search.mpx.wtf/'
      ];

      logger.log(
        `All configured providers failed, trying public SearxNG instances for query: ${fullQuery}`,
      );

      for (const fallbackUrl of fallbackInstances) {
        logger.log(`Trying fallback instance: ${fallbackUrl}`);
        const url = new URL(fallbackUrl);
        url.searchParams.append('q', fullQuery);
        url.searchParams.append('format', 'json');
        
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout for fallbacks

          const response = await fetch(url.toString(), {
            headers: { 
              Accept: 'application/json',
              'User-Agent': 'MorroChatBot/1.0'
            },
            signal: controller.signal
          }).finally(() => clearTimeout(timeout));

          if (!response.ok) {
            continue; // Try next instance
          }

          const responseText = await response.text();
          const json = JSON.parse(responseText);
          
          if (json.results && json.results.length > 0) {
            logger.log(`Successfully got results from fallback instance: ${fallbackUrl}`);
            return JSON.stringify(json.results);
          }
        } catch (e) {
          logger.warn(
            `Fallback instance ${fallbackUrl} failed, trying next`,
            e.stack,
          );
          continue;
        }
      }

      // If all fallbacks fail, return a final error
      logger.error('All search providers and fallbacks failed');
      return JSON.stringify({ 
        error: 'Search failed: Unable to get results from any available search provider.' 
      });
    },
  });
};
