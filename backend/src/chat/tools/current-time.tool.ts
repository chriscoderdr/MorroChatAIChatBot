import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export const createCurrentTimeTool = () => {
  return new DynamicStructuredTool({
    name: 'current_time',
    description:
      'Gets the current date and time for a specific IANA timezone.',
    schema: z.object({
      timezone: z
        .string()
        .describe(
          "A valid IANA timezone name, e.g., 'America/Santo_Domingo'.",
        ),
    }),
    func: async ({ timezone }) => {
      try {
        return new Date().toLocaleString('en-US', {
          timeZone: timezone,
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short',
        });
      } catch (e) {
        return `Failed to get time. '${timezone}' is not a valid IANA timezone.`;
      }
    },
  });
};
