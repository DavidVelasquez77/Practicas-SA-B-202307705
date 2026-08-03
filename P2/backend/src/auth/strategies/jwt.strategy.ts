import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../types/authenticated-user.interface';
import {
  USER_ROLES,
  type UserRole,
} from '../types/user-role.type';

interface JwtPayload {
  sub: number;
  role: UserRole;
  iat?: number;
  exp?: number;
}

const extractJwtFromCookie = (
  request: Request,
): string | null => {
  if (!request?.cookies) {
    return null;
  }

  const token: unknown =
    request.cookies['access_token'];

  return typeof token === 'string'
    ? token
    : null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(
  Strategy,
  'jwt',
) {
  constructor(
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: extractJwtFromCookie,
      ignoreExpiration: false,
      secretOrKey:
        configService.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    const validRole =
      payload.role === USER_ROLES.ADMIN ||
      payload.role === USER_ROLES.CLIENTE;

    if (!Number.isInteger(payload.sub) || !validRole) {
      throw new UnauthorizedException(
        'El contenido del token no es válido',
      );
    }

    return {
      id: payload.sub,
      role: payload.role,
    };
  }
}