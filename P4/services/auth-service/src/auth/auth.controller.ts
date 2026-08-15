import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  Request,
  Response,
} from 'express';
import {
  AuthService,
  type RegisterResult,
} from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './types/authenticated-user.interface';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};
@Controller('auth')
export class AuthController {
  private readonly cookieLifetimeMilliseconds: number;

  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    const jwtExpiresInSeconds = Number(
      configService.getOrThrow<string>(
        'JWT_EXPIRES_IN',
      ),
    );

    const refreshTimeSeconds = Number(
      configService.getOrThrow<string>(
        'JWT_REFRESH_TIME_SECONDS',
      ),
    );

    if (
      !Number.isInteger(jwtExpiresInSeconds) ||
      jwtExpiresInSeconds <= 0
    ) {
      throw new Error(
        'JWT_EXPIRES_IN debe ser un número entero positivo',
      );
    }

    if (
      !Number.isInteger(refreshTimeSeconds) ||
      refreshTimeSeconds <= 0
    ) {
      throw new Error(
        'JWT_REFRESH_TIME_SECONDS debe ser un número entero positivo',
      );
    }

    /*
     * La cookie debe sobrevivir durante:
     *
     * duración del JWT + periodo de gracia.
     *
     * Esto permite que el navegador todavía envíe el JWT
     * después de expirar, para que el backend pueda renovarlo.
     */
    this.cookieLifetimeMilliseconds =
      (jwtExpiresInSeconds + refreshTimeSeconds) *
      1000;
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(
    @Body() registerDto: RegisterDto,
  ): Promise<RegisterResult> {
    return this.authService.register(
      registerDto,
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true })
    response: Response,
  ): Promise<{
    message: string;
    user: {
      id: number;
      rol: string;
    };
  }> {
    const result =
      await this.authService.login(loginDto);

    response.cookie(
      'access_token',
      result.accessToken,
      {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge:
          this.cookieLifetimeMilliseconds,
      },
    );

    return {
      message:
        'Inicio de sesión exitoso',
      user: result.user,
    };
  }

  @Get('validate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  validate(
    @Req()
    request: AuthenticatedRequest,
  ): {
    valid: true;
    user: AuthenticatedUser;
  } {
    return {
      valid: true,
      user: request.user,
    };
  }

}