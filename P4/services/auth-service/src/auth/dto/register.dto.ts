import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import type {
  UserRole,
} from '../types/user-role.type';

export class RegisterDto {
  @IsString({
    message:
      'El nombre debe ser una cadena de texto',
  })
  @IsNotEmpty({
    message:
      'El nombre es obligatorio',
  })
  @MinLength(3, {
    message:
      'El nombre debe tener al menos 3 caracteres',
  })
  @MaxLength(100, {
    message:
      'El nombre no puede superar los 100 caracteres',
  })
  @Matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/, {
    message:
      'El nombre solo puede contener letras y espacios',
  })
  nombre!: string;

  @IsString({
    message:
      'El correo debe ser una cadena de texto',
  })
  @IsNotEmpty({
    message:
      'El correo es obligatorio',
  })
  @IsEmail(
    {},
    {
      message:
        'El correo electrónico no tiene un formato válido',
    },
  )
  @MaxLength(150, {
    message:
      'El correo no puede superar los 150 caracteres',
  })
  correo!: string;

  @IsString({
    message:
      'La contraseña debe ser una cadena de texto',
  })
  @IsNotEmpty({
    message:
      'La contraseña es obligatoria',
  })
  @MinLength(8, {
    message:
      'La contraseña debe tener al menos 8 caracteres',
  })
  @MaxLength(64, {
    message:
      'La contraseña no puede superar los 64 caracteres',
  })
  @Matches(/[a-z]/, {
    message:
      'La contraseña debe contener al menos una letra minúscula',
  })
  @Matches(/[A-Z]/, {
    message:
      'La contraseña debe contener al menos una letra mayúscula',
  })
  @Matches(/[0-9]/, {
    message:
      'La contraseña debe contener al menos un número',
  })
  @Matches(/[^A-Za-z0-9]/, {
    message:
      'La contraseña debe contener al menos un símbolo',
  })
  contrasena!: string;

  @IsNotEmpty({
    message:
      'El rol es obligatorio',
  })
  @IsIn(
    ['Admin', 'Cliente'],
    {
      message:
        'El rol debe ser Admin o Cliente',
    },
  )
  rol!: UserRole;
}