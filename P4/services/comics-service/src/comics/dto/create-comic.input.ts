import {
  Field,
  Float,
  InputType,
} from '@nestjs/graphql';

import {
  IsNumber,
  IsPositive,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

@InputType()
export class CreateComicInput {
  @Field()
  @IsString()
  @Length(2, 150)
  titulo!: string;

  @Field()
  @IsString()
  @Length(2, 120)
  autor!: string;

  @Field()
  @IsString()
  @Length(2, 100)
  editorial!: string;

  @Field()
  @IsString()
  @MaxLength(80)
  genero!: string;

  @Field(() => Float)
  @IsNumber()
  @IsPositive()
  precioAlquiler!: number;
}