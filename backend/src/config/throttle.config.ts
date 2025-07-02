import { registerAs } from '@nestjs/config';

export default registerAs('throttle', () => ({
  ttl: process.env.THROTTLE_TTL ? parseInt(process.env.THROTTLE_TTL, 10) : 30,
  limit: process.env.THROTTLE_LIMIT
    ? parseInt(process.env.THROTTLE_LIMIT, 10)
    : 100,
}));
