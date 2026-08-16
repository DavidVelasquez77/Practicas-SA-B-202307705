import {
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class CreateRentalDto {

  @IsInt()
  @Min(1)
  @ApiProperty({
    example: 1,
    description:'Identificador del comic ' + 'que se desea alquilar.',
  })
  comicId!: number;


  @IsOptional()
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({
  example: 7,
  default: 7,
  description: 'Cantidad de días del alquiler.',
  })
  dias = 7;
} 