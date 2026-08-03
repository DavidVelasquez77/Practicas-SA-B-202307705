import { API_BASE_URL } from '@/constants/api.constants';
import type {
  AuthorizationResult,
  ProtectedApiResponse,
  ProtectedRoute,
} from '@/types/protected.types';

export const protectedService = {
  async testRoute(
    route: ProtectedRoute,
  ): Promise<AuthorizationResult> {
    const response = await fetch(
      `${API_BASE_URL}/protected/${route}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      },
    );

    let body: ProtectedApiResponse;

    try {
      body =
        (await response.json()) as ProtectedApiResponse;
    } catch {
      body = {
        message:
          'El servidor no devolvió una respuesta JSON válida',
      };
    }

    return {
      route: `/protected/${route}`,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      timestamp:
        new Date().toLocaleTimeString(),
      body,
    };
  },
};