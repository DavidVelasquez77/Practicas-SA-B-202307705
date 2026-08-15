import {
  IsNumber,
  IsPositive,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';


export class CreateComicDto {

  @IsString()
  @Length(2, 150)
  titulo!: string;


  @IsString()
  @Length(2, 120)
  autor!: string;


  @IsString()
  @Length(2, 100)
  editorial!: string;


  @IsString()
  @MaxLength(80)
  genero!: string;


  @IsNumber()
  @IsPositive()
  precioAlquiler!: number;
}