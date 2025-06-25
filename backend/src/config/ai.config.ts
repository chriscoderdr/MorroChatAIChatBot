import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => ({
  provider: process.env.AI_PROVIDER || 'gemini',
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0'),
}));
