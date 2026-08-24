import {
  Module,
} from '@nestjs/common';

import {
  ConfigModule,
} from '@nestjs/config';

import {
  MicroservicesClientService,
} from './clients/microservices-client.service';

import {
  GatewayAuthGuard,
} from './common/guards/gateway-auth.guard';

import {
  GatewayRoleGuard,
} from './common/guards/gateway-role.guard';

import {
  AuthGatewayController,
} from './auth/auth-gateway.controller';

import {
  ComicsGatewayController,
} from './comics/comics-gateway.controller';

import {
  RentalsGatewayController,
} from './rentals/rentals-gateway.controller';

import {
  CopiesGatewayController,
} from './copies/copies-gateway.controller';

import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],

  controllers: [
    HealthController,
    AuthGatewayController,
    ComicsGatewayController,
    RentalsGatewayController,
    CopiesGatewayController,
  ],

  providers: [
    MicroservicesClientService,
    GatewayAuthGuard,
    GatewayRoleGuard,
  ],
})
export class AppModule {}