import {
  Controller,
  Get,
} from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator';
import { USER_ROLES } from '../auth/types/user-role.type';

interface ProtectedRouteResponse {
  message: string;
  ruta: string;
  rolesPermitidos: string[];
}

@Controller('protected')
export class ProtectedController {
  @Get('ruta1')
  @Auth(USER_ROLES.ADMIN)
  rutaSoloAdmin(): ProtectedRouteResponse {
    return {
      message:
        'Acceso permitido: esta ruta es exclusiva para administradores',
      ruta: '/protected/ruta1',
      rolesPermitidos: [
        USER_ROLES.ADMIN,
      ],
    };
  }

  @Get('ruta2')
  @Auth(
    USER_ROLES.ADMIN,
    USER_ROLES.CLIENTE,
  )
  rutaAdminYCliente(): ProtectedRouteResponse {
    return {
      message:
        'Acceso permitido: esta ruta acepta administradores y clientes',
      ruta: '/protected/ruta2',
      rolesPermitidos: [
        USER_ROLES.ADMIN,
        USER_ROLES.CLIENTE,
      ],
    };
  }
}