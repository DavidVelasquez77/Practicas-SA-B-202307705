import { Module } from '@nestjs/common';
import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { EncryptionModule } from '../encryption/encryption.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    EncryptionModule,

    PassportModule.register({
      defaultStrategy: 'jwt',
      session: false,
    }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService,
      ) => {
        const jwtExpiresIn =
          Number(
            configService.getOrThrow<string>(
              'JWT_EXPIRES_IN',
            ),
          );

        if (
          !Number.isInteger(jwtExpiresIn) ||
          jwtExpiresIn <= 0
        ) {
          throw new Error(
            'JWT_EXPIRES_IN debe ser un número entero positivo expresado en segundos',
          );
        }

        return {
          secret:
            configService.getOrThrow<string>(
              'JWT_SECRET',
            ),
          signOptions: {
            expiresIn: jwtExpiresIn,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
  ],
  exports: [
    AuthService,
    PassportModule,
  ],
})
export class AuthModule {}