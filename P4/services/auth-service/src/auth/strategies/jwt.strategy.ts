import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportStrategy } from '@nestjs/passport';
import type {
  Request,
  Response,
} from 'express';
import { Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../types/authenticated-user.interface';
import {
  USER_ROLES,
  type UserRole,
} from '../types/user-role.type';

interface JwtPayload {
  sub: number;
  role: UserRole;

  /*
   * Fecha absoluta máxima hasta la cual puede
   * renovarse la sesión.
   */
  refreshUntil: number;

  iat?: number;
  exp?: number;
}

type RequestWithResponse = Request & {
  res?: Response;
};

const ACCESS_TOKEN_COOKIE =
  'access_token';

const extractJwtFromCookie = (
  request: Request,
): string | null => {
  const cookies: unknown =
    request?.cookies;

  if (
    typeof cookies !== 'object' ||
    cookies === null
  ) {
    return null;
  }

  const cookieRecord =
    cookies as Record<string, unknown>;

  const token =
    cookieRecord[ACCESS_TOKEN_COOKIE];

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
    private readonly jwtService: JwtService,
  ) {
    super({
      jwtFromRequest:
        extractJwtFromCookie,

      /*
       * Passport valida la firma, pero la expiración
       * se controla manualmente.
       */
      ignoreExpiration: true,

      /*
       * Permite acceder a request.res para renovar
       * la cookie HTTP-only.
       */
      passReqToCallback: true,

      secretOrKey:
        configService.getOrThrow<string>(
          'JWT_SECRET',
        ),

      algorithms: ['HS256'],
    });
  }

  async validate(
    request: RequestWithResponse,
    payload: JwtPayload,
  ): Promise<AuthenticatedUser> {
    this.validatePayload(payload);

    const nowSeconds =
      Math.floor(Date.now() / 1000);

    const expiration =
      payload.exp as number;

    console.log('--- VALIDACIÓN JWT ---');
    console.log({
      issuedAt: payload.iat,
      expiration,
      currentTime: nowSeconds,
      refreshUntil: payload.refreshUntil,
      secondsSinceExpiration:
        nowSeconds - expiration,
    });

    /*
     * Primero se valida el límite absoluto.
     * Aunque el JWT renovado esté vigente, la sesión
     * no puede superar refreshUntil.
     */
    if (nowSeconds > payload.refreshUntil) {
      this.clearCookie(request);

      console.log(
        'Tiempo absoluto de renovación superado',
      );

      throw new UnauthorizedException(
        'La sesión expiró y superó el tiempo permitido para su renovación',
      );
    }

    /*
     * JWT vigente: no necesita renovación.
     */
    if (nowSeconds <= expiration) {
      console.log(
        'JWT vigente: no se renueva',
      );

      return {
        id: payload.sub,
        role: payload.role,
      };
    }

    /*
     * JWT expirado, pero todavía antes de refreshUntil.
     */
    console.log(
      'JWT expirado dentro de la gracia: renovando',
    );

    const refreshedToken =
      await this.jwtService.signAsync({
        sub: payload.sub,
        role: payload.role,

        /*
         * Se conserva el límite original.
         * No se crea una nueva ventana de gracia.
         */
        refreshUntil:
          payload.refreshUntil,
      });

    this.replaceAccessTokenCookie(
      request,
      refreshedToken,
      payload.refreshUntil,
      nowSeconds,
    );

    return {
      id: payload.sub,
      role: payload.role,
    };
  }

  private validatePayload(
    payload: JwtPayload,
  ): void {
    const validRole =
      payload.role === USER_ROLES.ADMIN ||
      payload.role === USER_ROLES.CLIENTE;

    const validUserId =
      Number.isInteger(payload.sub) &&
      payload.sub > 0;

    const validExpiration =
      Number.isInteger(payload.exp) &&
      (payload.exp as number) > 0;

    const validRefreshUntil =
      Number.isInteger(
        payload.refreshUntil,
      ) &&
      payload.refreshUntil > 0;

    if (
      !validUserId ||
      !validRole ||
      !validExpiration ||
      !validRefreshUntil
    ) {
      throw new UnauthorizedException(
        'El contenido del token no es válido',
      );
    }
  }

  private replaceAccessTokenCookie(
    request: RequestWithResponse,
    token: string,
    refreshUntil: number,
    nowSeconds: number,
  ): void {
    const response = request.res;

    if (!response) {
      throw new UnauthorizedException(
        'No fue posible renovar la cookie',
      );
    }

    const remainingSeconds =
      refreshUntil - nowSeconds;

    if (remainingSeconds <= 0) {
      throw new UnauthorizedException(
        'La sesión ya no puede renovarse',
      );
    }

    /*
     * Encabezado temporal para verificar la renovación.
     */
    response.setHeader(
      'X-JWT-Renewed',
      'true',
    );

    response.cookie(
      ACCESS_TOKEN_COOKIE,
      token,
      {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',

        /*
         * La cookie solo vive hasta el límite original.
         * No vuelve a recibir otros 180 segundos.
         */
        maxAge:
          remainingSeconds * 1000,
      },
    );
  }

  private clearCookie(
    request: RequestWithResponse,
  ): void {
    request.res?.clearCookie(
      ACCESS_TOKEN_COOKIE,
      {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
      },
    );
  }
}