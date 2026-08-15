import {
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import {
  CreateComicInput,
} from './dto/create-comic.input';

import {
  Comic,
} from './models/comic.model';

@Injectable()
export class ComicsService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async findAll(): Promise<Comic[]> {
    return this.prisma.comic.findMany({
      orderBy: {
        id: 'asc',
      },
    });
  }

  async findOne(
    id: number,
  ): Promise<Comic | null> {
    return this.prisma.comic.findUnique({
      where: {
        id,
      },
    });
  }

  async create(
    input: CreateComicInput,
  ): Promise<Comic> {
    return this.prisma.comic.create({
      data: {
        titulo:
          input.titulo.trim(),

        autor:
          input.autor.trim(),

        editorial:
          input.editorial.trim(),

        genero:
          input.genero.trim(),

        precioAlquiler:
          input.precioAlquiler,
      },
    });
  }
}