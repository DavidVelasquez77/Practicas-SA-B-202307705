import {
  IsNumber,
  IsPositive,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

import {
  ApiProperty,
} from '@nestjs/swagger';

export class CreateComicDto {

  @IsString()
  @Length(2, 150)
  @ApiProperty({
    example: 'Batman: Año Uno',
  })
  titulo!: string;


  @IsString()
  @Length(2, 120)
  @ApiProperty({
    example: 'Frank Miller',
  })
  autor!: string;


  @IsString()
  @Length(2, 100)
  @ApiProperty({
    example: 'DC Comics',
  })
  editorial!: string;


  @IsString()
  @MaxLength(80)
  @ApiProperty({
    example: 'Superheroes',
  })
  genero!: string;

  @IsNumber()
  @IsPositive()
  @ApiProperty({
    example: 25,
    description: 'Precio de alquiler en quetzales.',
  })
  precioAlquiler!: number;
}