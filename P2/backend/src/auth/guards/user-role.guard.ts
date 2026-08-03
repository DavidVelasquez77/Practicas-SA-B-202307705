import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLE_PROTECTED_KEY } from '../decorators/role-protected.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user.interface';
import type { UserRole } from '../types/user-role.type';

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

@Injectable()
export class UserRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles =
      this.reflector.getAllAndOverride<UserRole[]>(
        ROLE_PROTECTED_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    /*
     * Si una ruta utiliza el guard, pero no tiene roles
     * configurados, no restringimos por rol.
     * El JwtAuthGuard seguirá exigiendo autenticación.
     */
    if (!allowedRoles || allowedRoles.length === 0) {
      return true;
    }

    const request =
      context
        .switchToHttp()
        .getRequest<AuthenticatedRequest>();

    const user = request.user;

    /*
     * Normalmente este caso lo maneja JwtAuthGuard.
     * Se conserva como validación defensiva.
     */
    if (!user) {
      throw new UnauthorizedException(
        'No existe un usuario autenticado en la solicitud',
      );
    }

    const hasPermission =
      allowedRoles.includes(user.role);

    if (!hasPermission) {
      throw new ForbiddenException(
        'No tiene permisos para acceder a esta ruta',
      );
    }

    return true;
  }
}