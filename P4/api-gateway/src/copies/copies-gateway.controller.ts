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
  CreateCopyDto,
} from './dto/create-copy.dto';

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

@ApiTags('Copies')
@ApiCookieAuth('access_token')
@Controller('api/copies')
@UseGuards(
  GatewayAuthGuard,
  GatewayRoleGuard,
)
@Roles(
  'Admin',
  'Cliente',
)
export class CopiesGatewayController {

  constructor(
    private readonly client:
      MicroservicesClientService,
  ) {}

  @ApiOperation({
    summary:
      'Listar ejemplares de un comic',
  })
  @ApiParam({
    name: 'comicId',
    example: 1,
  })
  @ApiOkResponse({
    description:
      'Ejemplares obtenidos correctamente.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Sesión inexistente o expirada.',
  })
  @Get('by-comic/:comicId')
  async findByComic(
    @Param(
      'comicId',
      ParseIntPipe,
    )
    comicId: number,
  ) {

    return this.client
      .copiesRequest(
        `/copies/by-comic/${comicId}`,
      );
  }

  @ApiOperation({
    summary:
      'Buscar ejemplar disponible',
  })
  @ApiParam({
    name: 'comicId',
    example: 1,
  })
  @ApiOkResponse({
    description:
      'Ejemplar disponible encontrado.',
  })
  @ApiNotFoundResponse({
    description:
      'No existen ejemplares disponibles.',
  })
  @Get(
    'available/by-comic/:comicId',
  )
  async findAvailable(
    @Param(
      'comicId',
      ParseIntPipe,
    )
    comicId: number,
  ) {

    return this.client
      .copiesRequest(
        '/copies/available/'
        + `by-comic/${comicId}`,
      );
  }

  @ApiOperation({
    summary: 'Registrar ejemplar',
    description:
      'Crea un ejemplar físico '
      + 'para un comic. Solo Admin.',
  })
  @ApiCreatedResponse({
    description:
      'Ejemplar registrado correctamente.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Sesión inexistente o expirada.',
  })
  @ApiForbiddenResponse({
    description:
      'Solo un Admin puede '
      + 'registrar ejemplares.',
  })
  @Post()
  @Roles('Admin')
  async create(
    @Body()
    dto: CreateCopyDto,
  ) {

    return this.client
      .copiesRequest(
        '/copies',
        'POST',
        {
          comic_id:
            dto.comicId,

          codigo:
            dto.codigo,
        },
      );
  }
}