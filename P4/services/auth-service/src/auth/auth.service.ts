import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RoleName } from '../generated/prisma/client';
import { EncryptionService } from '../encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface UserWithRole {
  id: number;
  correo: string;
  contrasena: string;
  role: {
    nombre: RoleName;
  };
}

export interface RegisterResult {
  message: string;
  user: {
    id: number;
    rol: RoleName;
  };
}

export interface LoginResult {
  accessToken: string;
  user: {
    id: number;
    rol: RoleName;
  };
}

@Injectable()
export class AuthService {
  private readonly jwtExpiresInSeconds: number;
  private readonly refreshTimeSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.jwtExpiresInSeconds = Number(
      configService.getOrThrow<string>(
        'JWT_EXPIRES_IN',
      ),
    );

    this.refreshTimeSeconds = Number(
      configService.getOrThrow<string>(
        'JWT_REFRESH_TIME_SECONDS',
      ),
    );

    if (
      !Number.isInteger(this.jwtExpiresInSeconds) ||
      this.jwtExpiresInSeconds <= 0
    ) {
      throw new Error(
        'JWT_EXPIRES_IN debe ser un número entero positivo expresado en segundos',
      );
    }

    if (
      !Number.isInteger(this.refreshTimeSeconds) ||
      this.refreshTimeSeconds <= 0
    ) {
      throw new Error(
        'JWT_REFRESH_TIME_SECONDS debe ser un número entero positivo expresado en segundos',
      );
    }
  }

  async register(
    registerDto: RegisterDto,
  ): Promise<RegisterResult> {
    const nombre =
      registerDto.nombre?.trim();

    const correo =
      registerDto.correo
        ?.trim()
        .toLowerCase();

    const contrasena =
      registerDto.contrasena;

    const rol =
      registerDto.rol;

    this.validateRegisterData(
      nombre,
      correo,
      contrasena,
      rol,
    );

    /*
     * Como el correo está cifrado con un IV aleatorio,
     * no puede buscarse directamente con findUnique().
     * Se comparan los correos después de descifrarlos.
     */
    const existingUser =
      await this.findUserByEmail(correo);

    if (existingUser) {
      throw new ConflictException(
        'Ya existe un usuario registrado con ese correo',
      );
    }

    const roleName =
      rol === 'Admin'
        ? RoleName.Admin
        : RoleName.Cliente;

    /*
     * Si el rol todavía no existe, se crea.
     * Si ya existe, solamente se recupera.
     */
    const role =
      await this.prisma.role.upsert({
        where: {
          nombre: roleName,
        },
        update: {},
        create: {
          nombre: roleName,
        },
      });

    /*
     * Los datos sensibles se cifran antes
     * de enviarlos a Prisma.
     */
    const encryptedName =
      this.encryptionService.encrypt(
        nombre,
      );

    const encryptedEmail =
      this.encryptionService.encrypt(
        correo,
      );

    const encryptedPassword =
      this.encryptionService.encrypt(
        contrasena,
      );

    const user =
      await this.prisma.user.create({
        data: {
          nombre: encryptedName,
          correo: encryptedEmail,
          contrasena: encryptedPassword,
          roleId: role.id,
        },
        select: {
          id: true,
          role: {
            select: {
              nombre: true,
            },
          },
        },
      });

    return {
      message:
        'Usuario registrado correctamente',
      user: {
        id: user.id,
        rol: user.role.nombre,
      },
    };
  }

  async login(
    loginDto: LoginDto,
  ): Promise<LoginResult> {
    const correo =
      loginDto.correo
        ?.trim()
        .toLowerCase();

    const contrasena =
      loginDto.contrasena;

    if (!correo || !contrasena) {
      throw new BadRequestException(
        'El correo y la contraseña son obligatorios',
      );
    }

    /*
     * Busca al usuario descifrando los correos
     * almacenados en la base de datos.
     */
    const user =
      await this.findUserByEmail(correo);

    if (!user) {
      throw new UnauthorizedException(
        'Correo o contraseña incorrectos',
      );
    }

    const storedPassword =
      this.encryptionService.decrypt(
        user.contrasena,
      );

    if (storedPassword !== contrasena) {
      throw new UnauthorizedException(
        'Correo o contraseña incorrectos',
      );
    }

    const nowSeconds =
      Math.floor(Date.now() / 1000);

    /*
     * Momento en que expira el JWT original.
     *
     * Ejemplo:
     * Login: 0 segundos
     * JWT_EXPIRES_IN: 60
     * Expiración original: segundo 60
     */
    const originalExpiration =
      nowSeconds +
      this.jwtExpiresInSeconds;

    /*
     * Límite absoluto hasta el cual la sesión
     * puede renovarse.
     *
     * Ejemplo:
     * Expiración original: segundo 60
     * JWT_REFRESH_TIME_SECONDS: 60
     * refreshUntil: segundo 120
     *
     * Este valor se conserva cuando JwtStrategy
     * genera un token nuevo.
     */
    const refreshUntil =
      originalExpiration +
      this.refreshTimeSeconds;

    const payload = {
      sub: user.id,
      role: user.role.nombre,
      refreshUntil,
    };

    /*
     * JwtModule agrega automáticamente:
     *
     * iat: fecha de emisión
     * exp: fecha de expiración
     *
     * según JWT_EXPIRES_IN.
     */
    const accessToken =
      await this.jwtService.signAsync(
        payload,
      );

    return {
      accessToken,
      user: {
        id: user.id,
        rol: user.role.nombre,
      },
    };
  }

  private async findUserByEmail(
    emailToFind: string,
  ): Promise<UserWithRole | null> {
    const users =
      await this.prisma.user.findMany({
        select: {
          id: true,
          correo: true,
          contrasena: true,
          role: {
            select: {
              nombre: true,
            },
          },
        },
      });

    for (const user of users) {
      try {
        const decryptedEmail =
          this.encryptionService
            .decrypt(user.correo)
            .trim()
            .toLowerCase();

        if (
          decryptedEmail === emailToFind
        ) {
          return user;
        }
      } catch {
        /*
         * Si un registro tiene un correo corrupto
         * o cifrado con otra llave, se ignora y se
         * continúa buscando entre los demás usuarios.
         */
        continue;
      }
    }

    return null;
  }

  private validateRegisterData(
    nombre: string | undefined,
    correo: string | undefined,
    contrasena: string | undefined,
    rol: string | undefined,
  ): asserts nombre is string {
    if (
      !nombre ||
      !correo ||
      !contrasena ||
      !rol
    ) {
      throw new BadRequestException(
        'Nombre, correo, contraseña y rol son obligatorios',
      );
    }

    if (
      rol !== 'Admin' &&
      rol !== 'Cliente'
    ) {
      throw new BadRequestException(
        'El rol debe ser Admin o Cliente',
      );
    }
  }
}