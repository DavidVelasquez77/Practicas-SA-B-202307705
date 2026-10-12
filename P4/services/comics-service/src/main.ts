import './observability/telemetry';
import {
  requestObservabilityMiddleware,
  startMetricsServer,
} from './observability/http-observability';
import { shutdownTelemetry } from './observability/telemetry';

import {
  ValidationPipe,
} from '@nestjs/common';

import {
  NestFactory,
} from '@nestjs/core';

import {
  AppModule,
} from './app.module';

async function bootstrap(): Promise<void> {
  const app =
    await NestFactory.create(
      AppModule,
    );

  app.use(requestObservabilityMiddleware());
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
    }),
  );

  const port =
    process.env.PORT ?? 3002;

  await app.listen(port);
  const metricsServer = startMetricsServer();
  app.getHttpServer().once('close', () => {
    metricsServer.close();
    void shutdownTelemetry();
  });

  console.log(
    `Comics Service ejecutándose en http://localhost:${port}/graphql`,
  );
}

void bootstrap();
