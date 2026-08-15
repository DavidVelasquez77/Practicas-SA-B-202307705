import type { UserRole } from './user-role.type';

export interface AuthenticatedUser {
  id: number;
  role: UserRole;
}