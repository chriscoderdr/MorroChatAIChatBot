import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { BonsaiLogger } from './logging/bonsai-logger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const bonsaiLogger = new BonsaiLogger(
    'https://srkpejt94t:oj9db58y8x@growidea-llc-search-5157941282.eu-central-1.bonsaisearch.net:443',
    'morrochat-logs'
  );
  const app = await NestFactory.create(AppModule, { logger: bonsaiLogger });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;

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
