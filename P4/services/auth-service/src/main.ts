import './observability/telemetry';
import {
  requestObservabilityMiddleware,
  startMetricsServer,
} from './observability/http-observability';
import { JsonExceptionFilter } from './observability/json-exception.filter';
import { shutdownTelemetry } from './observability/telemetry';

import {
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser =
  require('cookie-parser');
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app =
    await NestFactory.create(
      AppModule,
    );

  app.use(requestObservabilityMiddleware());
  app.useGlobalFilters(new JsonExceptionFilter());
  app.enableShutdownHooks();

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
    }),
  );

  const port =
    process.env.PORT ?? 3001;

  await app.listen(port);
  const metricsServer = startMetricsServer();
  app.getHttpServer().once('close', () => {
    metricsServer.close();
    void shutdownTelemetry();
  });

  console.log(
    `Auth Service ejecutándose en http://localhost:${port}`,
  );
}

void bootstrap();
