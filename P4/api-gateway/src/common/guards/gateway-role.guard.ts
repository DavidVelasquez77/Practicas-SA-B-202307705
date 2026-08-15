import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import {
  Reflector,
} from '@nestjs/core';

import {
  ROLES_KEY,
} from '../decorators/roles.decorator';

import type {
  AuthenticatedUser,
  UserRole,
} from '../types/authenticated-user.interface';

import type {
  Request,
} from 'express';


type AuthenticatedRequest =
  Request & {
    user?: AuthenticatedUser;
  };


@Injectable()
export class GatewayRoleGuard
implements CanActivate {

  constructor(
    private readonly reflector:
      Reflector,
  ) {}


  canActivate(
    context: ExecutionContext,
  ): boolean {

    const roles =
      this.reflector
        .getAllAndOverride<
          UserRole[]
        >(
          ROLES_KEY,
          [
            context.getHandler(),
            context.getClass(),
          ],
        );


    if (
      !roles ||
      roles.length === 0
    ) {
      return true;
    }


    const request =
      context
        .switchToHttp()
        .getRequest<
          AuthenticatedRequest
        >();


    if (
      !request.user ||
      !roles.includes(
        request.user.role,
      )
    ) {

      throw new ForbiddenException(
        'No tiene permisos para '
        + 'realizar esta operación.',
      );
    }


    return true;
  }
}