import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import * as cookieParser from 'cookie-parser';
import { CloudWatchLogger } from './logging/cloudwatch-logger';

async function bootstrap() {

  let app;
  const hasCloudWatchEnv = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION;
  if (hasCloudWatchEnv) {
    const cloudwatchLogger = new CloudWatchLogger();
    app = await NestFactory.create(AppModule, { logger: cloudwatchLogger });
  } else {
    app = await NestFactory.create(AppModule, {});
  }

  const configService = app.get(ConfigService);
  const port = (configService.get('app.port') as number) || 3000;

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger documentation setup
  const config = new DocumentBuilder()
    .setTitle('MorroChat API')
    .setDescription('The MorroChat API documentation')
    .setVersion('1.0')
    .addTag('chat')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Enable CORS for frontend communication with credentials
  app.enableCors({
    origin: true, // Allow all origins for development
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Allow cookies or authorization headers
    exposedHeaders: ['set-cookie'],
    allowedHeaders: 'Origin,X-Requested-With,Content-Type,Accept,Authorization',
  });

  // Use cookie parser with a secret for signed cookies
  app.use(cookieParser(process.env.COOKIE_SECRET || 'morro-chat-cookie-secret'));

  await app.listen(port);
}
bootstrap();
