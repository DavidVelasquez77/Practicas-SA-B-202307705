import {
  ValidationPipe,
} from '@nestjs/common';

import {
  NestFactory,
} from '@nestjs/core';

import {
  AppModule,
} from './app.module';

import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

async function bootstrap():
Promise<void> {

  const app =
    await NestFactory.create(
      AppModule,
    );


  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
    }),
  );

  const swaggerConfig =
    new DocumentBuilder()
      .setTitle(
        'ComicRent API',
      )
      .setDescription(
        'Contrato público del sistema '
        + 'de alquiler de comics. '
        + 'Todas las solicitudes externas '
        + 'se realizan mediante '
        + 'el API Gateway.',
      )
      .setVersion('1.0')
      .addTag(
        'Authentication',
        'Registro e inicio de sesión.',
      )
      .addTag(
        'Comics',
        'Gestión del catálogo de comics.',
      )
      .addTag(
        'Rentals',
        'Gestión de alquileres '
        + 'y devoluciones.',
      )
      .addTag(
        'Copies',
        'Gestión de ejemplares físicos.',
      )
      .addCookieAuth(
        'access_token',
        {
          type: 'apiKey',
        },
        'access_token',
      )
      .build();


  const document =
    SwaggerModule.createDocument(
      app,
      swaggerConfig,
    );


  SwaggerModule.setup(
    'docs',
    app,
    document,
    {
      swaggerOptions: {
        withCredentials: true,
        persistAuthorization: true,
      },
    },
  );

  const port =
    process.env.PORT ?? 3000;


  await app.listen(port);


  console.log(
    `API Gateway ejecutándose `
    + `en http://localhost:${port}`,
  );
}


void bootstrap();