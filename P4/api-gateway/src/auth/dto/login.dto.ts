import {
  IsEmail,
  IsString,
} from 'class-validator';

import {
  ApiProperty,
} from '@nestjs/swagger';


export class LoginDto {

  @ApiProperty({
    example: 'admin@p4.com',
    description:
      'Correo electrónico registrado.',
  })
  @IsEmail()
  correo!: string;


  @ApiProperty({
    example: 'Clave123!',
    description:
      'Contraseña del usuario.',
  })
  @IsString()
  contrasena!: string;
}