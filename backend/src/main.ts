import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { CloudWatchLogger } from './logging/cloudwatch-logger';
import { setup } from './setup';

import { NestApplication } from '@nestjs/core';

async function bootstrap() {
  try {
    let app: NestApplication;
    const hasCloudWatchEnv =
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REGION;
    if (hasCloudWatchEnv) {
      const cloudwatchLogger = new CloudWatchLogger();
      app = await NestFactory.create<NestApplication>(AppModule, {
        logger: cloudwatchLogger,
      });
    } else {
      app = await NestFactory.create<NestApplication>(AppModule, {});
    }

    const configService = app.get(ConfigService);
    const port = configService.get<number>('app.port') || 3000;

    setup(app);

    await app.listen(port);

    console.log(`🚀 Application is running on: http://localhost:${port}`);
    console.log(
      `📚 API Documentation available at: http://localhost:${port}/api/docs`,
    );
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(
      `📊 MongoDB URI: ${
        process.env.MONGO_URI || 'mongodb://localhost:27017/morrochat'
      }`,
    );
    console.log(
      `🔍 ChromaDB URL: ${process.env.CHROMA_URL || 'http://localhost:8000'}`,
    );
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    console.error('💡 Common solutions:');
    console.error(
      '   - Check if MongoDB is running (brew services start mongodb-community)',
    );
    console.error(
      '   - Check if ChromaDB is running (docker run -p 8000:8000 chromadb/chroma)',
    );
    console.error('   - Verify your .env file configuration');
    process.exit(1);
  }
}
void bootstrap();
