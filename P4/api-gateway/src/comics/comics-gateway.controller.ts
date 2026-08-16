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

import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Comics')
@ApiCookieAuth('access_token')
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


  @ApiOperation({
    summary: 'Listar comics',
    description:
      'Obtiene todos los comics '
      + 'registrados en el catálogo.',
  })
  @ApiOkResponse({
    description:
      'Listado de comics obtenido.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Sesión inexistente o expirada.',
  })
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

  @ApiOperation({
    summary: 'Consultar comic por ID',
  })
  @ApiParam({
    name: 'id',
    example: 1,
    description:
      'Identificador del comic.',
  })
  @ApiOkResponse({
    description:
      'Comic encontrado.',
  })
  @ApiNotFoundResponse({
    description:
      'Comic no encontrado.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Sesión inexistente o expirada.',
  })
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

  @ApiOperation({
    summary: 'Crear comic',
    description:
      'Registra un comic nuevo. '
      + 'Solo disponible para Admin.',
  })
  @ApiCreatedResponse({
    description:
      'Comic creado correctamente.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Sesión inexistente o expirada.',
  })
  @ApiForbiddenResponse({
    description:
      'Solo un Admin puede crear comics.',
  })
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