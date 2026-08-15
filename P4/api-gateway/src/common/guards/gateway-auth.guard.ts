import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import type {
  Request,
  Response,
} from 'express';

import {
  MicroservicesClientService,
} from '../../clients/microservices-client.service';

import type {
  AuthenticatedUser,
} from '../types/authenticated-user.interface';


type GatewayRequest =
  Request & {
    user?: AuthenticatedUser;
  };


@Injectable()
export class GatewayAuthGuard
implements CanActivate {

  constructor(
    private readonly client:
      MicroservicesClientService,
  ) {}


  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {

    const request =
      context
        .switchToHttp()
        .getRequest<
          GatewayRequest
        >();


    const response =
      context
        .switchToHttp()
        .getResponse<Response>();


    const cookie =
      request.headers.cookie;


    if (!cookie) {
      throw new UnauthorizedException(
        'No existe una sesión activa.',
      );
    }


    try {

      const validation =
        await this.client.authValidate(
          cookie,
        );


      request.user =
        validation.data.user;


      if (validation.setCookie) {

        response.setHeader(
          'Set-Cookie',
          validation.setCookie,
        );
      }


      if (
        validation.jwtRenewed
      ) {

        response.setHeader(
          'X-JWT-Renewed',
          validation.jwtRenewed,
        );
      }


      return true;

    } catch {

      throw new UnauthorizedException(
        'La sesión no es válida '
        + 'o ha expirado.',
      );
    }
  }
}