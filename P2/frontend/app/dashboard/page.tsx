'use client';

import { AuthorizationConsole } from '@/components/dashboard/AuthorizationConsole';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { ProtectedRouteButtons } from '@/components/dashboard/ProtectedRouteButtons';
import { useProtectedRoutes } from '@/hooks/useProtectedRoutes';

export default function DashboardPage() {
  const {
    result,
    loadingRoute,
    testRoute,
  } = useProtectedRoutes();

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(127,29,29,0.08),transparent_45%)]" />

      <div className="relative">
        <DashboardHeader />

        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="mb-14 max-w-3xl">
            <div className="flex items-center gap-4">
              <span className="h-px w-16 bg-red-700" />

              <p className="text-xs font-bold uppercase tracking-[0.35em] text-red-500">
                Confirmación de acceso
              </p>
            </div>

            <h2 className="mt-6 text-4xl font-black uppercase leading-none tracking-tight text-white md:text-6xl">
              Identidad
              <span className="block text-red-700">
                verificada
              </span>
            </h2>

            <p className="mt-6 max-w-2xl border-l-2 border-red-800 pl-5 leading-7 text-zinc-400">
              El inicio de sesión fue exitoso. El JWT permanece
              protegido dentro de una cookie HTTP-only y se
              envía automáticamente en cada prueba de
              autorización.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
            <ProtectedRouteButtons
              loadingRoute={loadingRoute}
              onTestRoute={testRoute}
            />

            <AuthorizationConsole
              result={result}
              loadingRoute={loadingRoute}
            />
          </div>

          <footer className="mt-14 border-t border-red-950 pt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-700">
              Autenticación centralizada · AES-256-CBC · JWT
              · autorización por roles
            </p>
          </footer>
        </section>
      </div>
    </main>
  );
}