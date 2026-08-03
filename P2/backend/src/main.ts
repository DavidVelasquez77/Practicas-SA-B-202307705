import { NestFactory } from '@nestjs/core';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  const port = process.env.PORT ?? 3000;

  await app.listen(port);

  console.log(`API ejecutándose en http://localhost:${port}`);
}

void bootstrap();