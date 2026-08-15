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


@Controller('api/auth')
export class AuthGatewayController {

  constructor(
    private readonly client:
      MicroservicesClientService,
  ) {}


  @Post('register')
  async register(
    @Body()
    body: unknown,
  ): Promise<unknown> {

    const result =
      await this.client
        .authRegister(body);

    return result.data;
  }


  @Post('login')
  async login(
    @Body()
    body: unknown,

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