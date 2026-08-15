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