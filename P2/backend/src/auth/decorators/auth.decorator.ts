import {
  applyDecorators,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UserRoleGuard } from '../guards/user-role.guard';
import type { UserRole } from '../types/user-role.type';
import { RoleProtected } from './role-protected.decorator';

export function Auth(
  ...roles: UserRole[]
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    RoleProtected(...roles),
    UseGuards(
      JwtAuthGuard,
      UserRoleGuard,
    ),
  );
}