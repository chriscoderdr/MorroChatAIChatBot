import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/morro_chat',
}));