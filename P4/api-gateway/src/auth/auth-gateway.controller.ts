import {
  Body,
  Controller,
  Post,
  Res,
} from '@nestjs/common';

import type {
  Response,
} from 'express';

import {
  MicroservicesClientService,
} from '../clients/microservices-client.service';

import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  LoginDto,
} from './dto/login.dto';

import {
  RegisterDto,
} from './dto/register.dto';
@ApiTags('Authentication')
@Controller('api/auth')
export class AuthGatewayController {

  constructor(
    private readonly client:
      MicroservicesClientService,
  ) {}


  @ApiOperation({
    summary: 'Registrar usuario',
    description:
      'Registra un nuevo usuario '
      + 'con rol Admin o Cliente.',
  })
  @ApiCreatedResponse({
    description:
      'Usuario registrado correctamente.',
  })
  @ApiBadRequestResponse({
    description:
      'Los datos enviados no son válidos.',
  })
  @ApiConflictResponse({
    description:
      'El correo ya se encuentra registrado.',
  })
  @Post('register')
  async register(
    @Body()
    body: RegisterDto,
  ): Promise<unknown> { 

    const result =
      await this.client
        .authRegister(body);

    return result.data;
  }

  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Valida las credenciales y '
      + 'crea la cookie HTTP-only '
      + 'access_token.',
  })
  @ApiOkResponse({
    description:
      'Inicio de sesión exitoso.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Credenciales incorrectas.',
  })

  @Post('login')
  async login(
    @Body()
    body: LoginDto,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<unknown> {

    const result =
      await this.client
        .authLogin(body);


    if (result.setCookie) {

      response.setHeader(
        'Set-Cookie',
        result.setCookie,
      );
    }


    return result.data;
  }
} 