'use client';

import { useState } from 'react';
import { protectedService } from '@/services/protected.service';
import type {
  AuthorizationResult,
  ProtectedRoute,
} from '@/types/protected.types';

export function useProtectedRoutes() {
  const [result, setResult] =
    useState<AuthorizationResult | null>(null);

  const [loadingRoute, setLoadingRoute] =
    useState<ProtectedRoute | null>(null);

  const [sessionExpired, setSessionExpired] =
    useState(false);

  async function testRoute(
    route: ProtectedRoute,
  ): Promise<void> {
    if (sessionExpired) {
      return;
    }

    setLoadingRoute(route);

    try {
      const response =
        await protectedService.testRoute(route);

      setResult(response);

      /*
       * Un 401 significa que:
       *
       * - no existe una cookie válida;
       * - el JWT expiró;
       * - o ya se superó el tiempo de gracia.
       *
       * En cualquiera de estos casos, el usuario
       * debe volver a iniciar sesión.
       */
      if (response.status === 401) {
        setSessionExpired(true);
      }
    } catch (error: unknown) {
      setResult({
        route: `/protected/${route}`,
        status: 0,
        statusText: 'NETWORK_ERROR',
        ok: false,
        timestamp:
          new Date().toLocaleTimeString(),
        body: {
          message:
            error instanceof Error
              ? error.message
              : 'No fue posible conectar con el backend',
        },
      });
    } finally {
      setLoadingRoute(null);
    }
  }

  return {
    result,
    loadingRoute,
    sessionExpired,
    testRoute,
  };
}