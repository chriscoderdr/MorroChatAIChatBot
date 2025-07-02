import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  mongoUri:
    process.env.MONGO_URI ||
    'mongodb://root:example@mongo:27017/morrochat?authSource=admin',
  maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '10', 10),
  minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || '2', 10),
  socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS || '45000', 10),
  connectTimeoutMS: parseInt(
    process.env.MONGO_CONNECT_TIMEOUT_MS || '10000',
    10,
  ),
  bufferCommands: process.env.MONGO_BUFFER_COMMANDS === 'true' ? true : false,
}));
