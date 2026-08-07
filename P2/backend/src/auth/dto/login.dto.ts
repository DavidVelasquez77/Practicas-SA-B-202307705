import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class LoginDto {
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
  contrasena!: string;
}