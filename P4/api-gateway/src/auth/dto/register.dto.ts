import {
  IsEmail,
  IsIn,
  IsString,
  Length,
} from 'class-validator';

import {
  ApiProperty,
} from '@nestjs/swagger';


export class RegisterDto {

  @ApiProperty({
    example: 'David Velasquez',
    description:
      'Nombre completo del usuario.',
  })
  @IsString()
  @Length(3, 100)
  nombre!: string;


  @ApiProperty({
    example: 'cliente@comicrent.com',
    description:
      'Correo electrónico del usuario.',
  })
  @IsEmail()
  correo!: string;


  @ApiProperty({
    example: 'Clave123!',
    description:
      'Contraseña del usuario.',
  })
  @IsString()
  @Length(8, 64)
  contrasena!: string;


  @ApiProperty({
    enum: [
      'Admin',
      'Cliente',
    ],
    example: 'Cliente',
    description:
      'Rol asignado al usuario.',
  })
  @IsIn([
    'Admin',
    'Cliente',
  ])
  rol!: 'Admin' | 'Cliente';
}