export type ProtectedRoute =
  | 'ruta1'
  | 'ruta2';

export interface ProtectedApiResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
  ruta?: string;
  rolesPermitidos?: string[];
}

export interface AuthorizationResult {
  route: string;
  status: number;
  statusText: string;
  ok: boolean;
  timestamp: string;
  body: ProtectedApiResponse;
}