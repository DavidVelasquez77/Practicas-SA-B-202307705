import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  MicroservicesClientService,
} from '../clients/microservices-client.service';

import {
  CurrentUser,
} from '../common/decorators/current-user.decorator';

import {
  Roles,
} from '../common/decorators/roles.decorator';

import {
  GatewayAuthGuard,
} from '../common/guards/gateway-auth.guard';

import {
  GatewayRoleGuard,
} from '../common/guards/gateway-role.guard';

import type {
  AuthenticatedUser,
} from '../common/types/authenticated-user.interface';

import {
  CreateRentalDto,
} from './dto/create-rental.dto';


interface RentalResult {
  id: number;
  userId: number;
  comicId: number;
  copyId: number;
  fechaAlquiler: string;
  fechaLimite: string;
  fechaDevolucion?: string | null;
  precioAlquiler: number;
  estado: string;
}


@Controller('api/rentals')
@UseGuards(
  GatewayAuthGuard,
  GatewayRoleGuard,
)
@Roles(
  'Admin',
  'Cliente',
)
export class RentalsGatewayController {

  constructor(
    private readonly client:
      MicroservicesClientService,
  ) {}


  @Post()
  async create(
    @CurrentUser()
    user: AuthenticatedUser,

    @Body()
    dto: CreateRentalDto,
  ) {

    const data =
      await this.client
        .rentalsGraphql<{
          createRental:
            RentalResult;
        }>(
          `
          mutation CreateRental(
            $input: CreateRentalInput!
          ) {
            createRental(
              input: $input
            ) {
              id
              userId
              comicId
              copyId
              fechaAlquiler
              fechaLimite
              precioAlquiler
              estado
            }
          }
          `,
          {
            input: {
              userId: user.id,
              comicId:
                dto.comicId,
              dias:
                dto.dias,
            },
          },
        );


    return data.createRental;
  }


  @Get('me')
  async findMine(
    @CurrentUser()
    user: AuthenticatedUser,
  ) {

    const data =
      await this.client
        .rentalsGraphql<{
          rentalsByUser:
            RentalResult[];
        }>(
          `
          query RentalsByUser(
            $userId: Int!
          ) {
            rentalsByUser(
              userId: $userId
            ) {
              id
              userId
              comicId
              copyId
              fechaAlquiler
              fechaLimite
              fechaDevolucion
              precioAlquiler
              estado
            }
          }
          `,
          {
            userId: user.id,
          },
        );


    return data.rentalsByUser;
  }


  private async getRental(
    id: number,
  ): Promise<RentalResult> {

    const data =
      await this.client
        .rentalsGraphql<{
          rental:
            RentalResult | null;
        }>(
          `
          query Rental(
            $id: Int!
          ) {
            rental(id: $id) {
              id
              userId
              comicId
              copyId
              fechaAlquiler
              fechaLimite
              fechaDevolucion
              precioAlquiler
              estado
            }
          }
          `,
          {
            id,
          },
        );


    if (!data.rental) {
      throw new NotFoundException(
        'El alquiler no existe.',
      );
    }


    return data.rental;
  }


  @Get(':id')
  async findOne(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {

    const rental =
      await this.getRental(id);


    if (
      user.role !== 'Admin' &&
      rental.userId !== user.id
    ) {

      throw new ForbiddenException(
        'No puede consultar '
        + 'el alquiler de otro '
        + 'usuario.',
      );
    }


    return rental;
  }


  @Patch(':id/return')
  async returnRental(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {

    const rental =
      await this.getRental(id);


    if (
      user.role !== 'Admin' &&
      rental.userId !== user.id
    ) {

      throw new ForbiddenException(
        'No puede devolver '
        + 'el alquiler de otro '
        + 'usuario.',
      );
    }


    const data =
      await this.client
        .rentalsGraphql<{
          returnRental:
            RentalResult;
        }>(
          `
          mutation ReturnRental(
            $id: Int!
          ) {
            returnRental(
              id: $id
            ) {
              id
              userId
              comicId
              copyId
              fechaDevolucion
              estado
            }
          }
          `,
          {
            id,
          },
        );


    return data.returnRental;
  }
}