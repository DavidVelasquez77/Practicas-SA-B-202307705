import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../types/user-role.type';

export const ROLE_PROTECTED_KEY = 'allowed_roles';

export const RoleProtected = (
  ...roles: UserRole[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLE_PROTECTED_KEY, roles);