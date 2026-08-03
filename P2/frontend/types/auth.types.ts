export type AuthMode = 'login' | 'register';

export type UserRole = 'Admin' | 'Cliente';

export interface AuthFormData {
  nombre: string;
  correo: string;
  contrasena: string;
  rol: UserRole;
}

export interface LoginRequest {
  correo: string;
  contrasena: string;
}

export interface RegisterRequest {
  nombre: string;
  correo: string;
  contrasena: string;
  rol: UserRole;
}

export interface AuthenticatedUser {
  id: number;
  rol: UserRole;
}

export interface LoginResponse {
  message: string;
  user: AuthenticatedUser;
}

export interface RegisterResponse {
  message: string;
  user: AuthenticatedUser;
}