export const USER_ROLES = {
  ADMIN: 'Admin',
  CLIENTE: 'Cliente',
} as const;

export type UserRole =
  (typeof USER_ROLES)[keyof typeof USER_ROLES];