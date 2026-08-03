import type { UserRole } from '../types/user-role.type';

export class RegisterDto {
  nombre!: string;
  correo!: string;
  contrasena!: string;
  rol!: UserRole;
}