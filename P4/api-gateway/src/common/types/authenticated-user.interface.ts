export type UserRole =
  | 'Admin'
  | 'Cliente';

export interface AuthenticatedUser {
  id: number;
  role: UserRole;
}  