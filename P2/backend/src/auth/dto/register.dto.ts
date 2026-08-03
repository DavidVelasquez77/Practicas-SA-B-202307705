export type UserRole = 'Admin' | 'Cliente';

export class RegisterDto {
  nombre!: string;
  correo!: string;
  contrasena!: string;
  rol!: UserRole;
} 