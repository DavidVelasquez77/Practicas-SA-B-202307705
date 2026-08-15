import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  MicroservicesClientService,
} from '../clients/microservices-client.service';

import {
  Roles,
} from '../common/decorators/roles.decorator';

import {
  GatewayAuthGuard,
} from '../common/guards/gateway-auth.guard';

import {
  GatewayRoleGuard,
} from '../common/guards/gateway-role.guard';

import {
  CreateComicDto,
} from './dto/create-comic.dto';


@Controller('api/comics')
@UseGuards(
  GatewayAuthGuard,
  GatewayRoleGuard,
)
@Roles(
  'Admin',
  'Cliente',
)
export class ComicsGatewayController {

  constructor(
    private readonly client:
      MicroservicesClientService,
  ) {}


  @Get()
  async findAll() {

    const data =
      await this.client
        .comicsGraphql<{
          comics: unknown[];
        }>(
          `
          query {
            comics {
              id
              titulo
              autor
              editorial
              genero
              precioAlquiler
              activo
            }
          }
          `,
        );


    return data.comics;
  }


  @Get(':id')
  async findOne(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,
  ) {

    const data =
      await this.client
        .comicsGraphql<{
          comic: unknown;
        }>(
          `
          query Comic($id: Int!) {
            comic(id: $id) {
              id
              titulo
              autor
              editorial
              genero
              precioAlquiler
              activo
            }
          }
          `,
          {
            id,
          },
        );


    return data.comic;
  }


  @Post()
  @Roles('Admin')
  async create(
    @Body()
    dto: CreateComicDto,
  ) {

    const data =
      await this.client
        .comicsGraphql<{
          createComic: unknown;
        }>(
          `
          mutation CreateComic(
            $input: CreateComicInput!
          ) {
            createComic(
              input: $input
            ) {
              id
              titulo
              autor
              editorial
              genero
              precioAlquiler
              activo
            }
          }
          `,
          {
            input: dto,
          },
        );


    return data.createComic;
  }
}