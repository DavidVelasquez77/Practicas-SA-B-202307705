import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProtectedController } from './protected.controller';

@Module({
  imports: [
    AuthModule,
  ],
  controllers: [
    ProtectedController,
  ],
})
export class ProtectedModule {}