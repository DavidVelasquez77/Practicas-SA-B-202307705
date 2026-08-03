import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<RegisterResult> {
    const nombre = registerDto.nombre?.trim();
    const correo = registerDto.correo?.trim().toLowerCase();
    const contrasena = registerDto.contrasena;
    const rol = registerDto.rol;

    this.validateRegisterData(nombre, correo, contrasena, rol);

    const existingUser = await this.findUserByEmail(correo);

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
     * Creamos el rol si todavía no existe.
     * Si ya existe, Prisma únicamente devuelve el registro actual.
     */
    const role = await this.prisma.role.upsert({
      where: {
        nombre: roleName,
      },
      update: {},
      create: {
        nombre: roleName,
      },
    });

    /*
     * Toda la información sensible se cifra antes
     * de enviarse a Prisma.
     */
    const encryptedName =
      this.encryptionService.encrypt(nombre);

    const encryptedEmail =
      this.encryptionService.encrypt(correo);

    const encryptedPassword =
      this.encryptionService.encrypt(contrasena);

    const user = await this.prisma.user.create({
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
      message: 'Usuario registrado correctamente',
      user: {
        id: user.id,
        rol: user.role.nombre,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<LoginResult> {
    const correo = loginDto.correo?.trim().toLowerCase();
    const contrasena = loginDto.contrasena;

    if (!correo || !contrasena) {
      throw new BadRequestException(
        'El correo y la contraseña son obligatorios',
      );
    }

    /*
     * Debido al IV aleatorio de AES, el mismo correo puede generar
     * ciphertexts diferentes. Por eso debemos obtener los usuarios
     * y comparar los correos después de desencriptarlos.
     */
    const user = await this.findUserByEmail(correo);

    if (!user) {
      throw new UnauthorizedException(
        'Correo o contraseña incorrectos',
      );
    }

    const storedPassword =
      this.encryptionService.decrypt(user.contrasena);

    if (storedPassword !== contrasena) {
      throw new UnauthorizedException(
        'Correo o contraseña incorrectos',
      );
    }

    /*
     * "sub" representa el identificador del sujeto autenticado.
     * El payload contiene únicamente los datos requeridos para
     * autenticación y autorización.
     */
    const payload = {
      sub: user.id,
      role: user.role.nombre,
    };

    const accessToken =
      await this.jwtService.signAsync(payload);

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
    const users = await this.prisma.user.findMany({
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
      const decryptedEmail =
        this.encryptionService
          .decrypt(user.correo)
          .trim()
          .toLowerCase();

      if (decryptedEmail === emailToFind) {
        return user;
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
    if (!nombre || !correo || !contrasena || !rol) {
      throw new BadRequestException(
        'Nombre, correo, contraseña y rol son obligatorios',
      );
    }

    if (rol !== 'Admin' && rol !== 'Cliente') {
      throw new BadRequestException(
        'El rol debe ser Admin o Cliente',
      );
    }
  }
}