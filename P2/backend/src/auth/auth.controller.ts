import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  AuthService,
  type RegisterResult,
} from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
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
      },
    );

    return {
      message: 'Inicio de sesión exitoso',
      user: result.user,
    };
  }
}