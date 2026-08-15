import {
  Field,
  Float,
  Int,
  ObjectType,
} from '@nestjs/graphql';

@ObjectType()
export class Comic {
  @Field(() => Int)
  id!: number;

  @Field()
  titulo!: string;

  @Field()
  autor!: string;

  @Field()
  editorial!: string;

  @Field()
  genero!: string;

  @Field(() => Float)
  precioAlquiler!: number;

  @Field()
  activo!: boolean;
}