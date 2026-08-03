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

  async function testRoute(
    route: ProtectedRoute,
  ): Promise<void> {
    setLoadingRoute(route);

    try {
      const response =
        await protectedService.testRoute(route);

      setResult(response);
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
    testRoute,
  };
}