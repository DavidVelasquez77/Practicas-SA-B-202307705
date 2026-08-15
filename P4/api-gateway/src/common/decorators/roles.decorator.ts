import {
  SetMetadata,
} from '@nestjs/common';

import type {
  UserRole,
} from '../types/authenticated-user.interface';


export const ROLES_KEY =
  'gateway_roles';


export const Roles = (
  ...roles: UserRole[]
) => SetMetadata(
  ROLES_KEY,
  roles,
);