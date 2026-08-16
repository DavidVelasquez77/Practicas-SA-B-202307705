import {
  IsInt,
  IsString,
  Length,
  Min,
} from 'class-validator';

import {
  ApiProperty,
} from '@nestjs/swagger';

export class CreateCopyDto {

  @IsInt()
  @Min(1)
  @ApiProperty({
    example: 1,
    description: 'Identificador del comic ' + 'al que pertenece el ejemplar.',
  })
  comicId!: number;


  @IsString()
  @Length(2, 50)
  @ApiProperty({
    example: 'BAT-004',
    description: 'Código único del ejemplar físico.',
  })
  codigo!: string;
}