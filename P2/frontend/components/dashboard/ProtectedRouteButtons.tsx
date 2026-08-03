import type { ProtectedRoute } from '@/types/protected.types';

interface ProtectedRouteButtonsProps {
  loadingRoute: ProtectedRoute | null;
  onTestRoute: (route: ProtectedRoute) => Promise<void>;
}

interface RouteOption {
  route: ProtectedRoute;
  title: string;
  description: string;
}

const ROUTE_OPTIONS: RouteOption[] = [
  {
    route: 'ruta1',
    title: 'Test Ruta 1',
    description: 'Solo Admin · GET /protected/ruta1',
  },
  {
    route: 'ruta2',
    title: 'Test Ruta 2',
    description: 'Admin y Cliente · GET /protected/ruta2',
  },
];

export function ProtectedRouteButtons({
  loadingRoute,
  onTestRoute,
}: ProtectedRouteButtonsProps) {
  const isLoading = loadingRoute !== null;

  return (
    <section className="border border-red-900 bg-black/60">
      <header className="border-b border-red-900 px-6 py-5">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">
          Pruebas de autorización
        </p>
      </header>

      <div className="space-y-5 p-6">
        {ROUTE_OPTIONS.map((option) => {
          const isCurrentRoute =
            loadingRoute === option.route;

          return (
            <button
              key={option.route}
              type="button"
              disabled={isLoading}
              onClick={() => {
                void onTestRoute(option.route);
              }}
              className="w-full rounded-none border border-red-600 bg-red-700 px-5 py-4 text-left transition-all duration-200 hover:bg-red-600 hover:shadow-[0_0_15px_rgba(220,38,38,0.3)] disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
            >
              <span className="block text-xs font-black uppercase tracking-[0.22em] text-white">
                {isCurrentRoute
                  ? 'Ejecutando...'
                  : option.title}
              </span>

              <span className="mt-2 block font-mono text-[11px] text-red-100">
                {option.description}
              </span>
            </button>
          );
        })}

        <div className="border-t border-red-950 pt-5 font-mono text-[11px] leading-6 text-zinc-600">
          <p>&gt; credentials: include</p>
          <p>&gt; cookie: access_token</p>
          <p>&gt; transport: HTTP local</p>
        </div>
      </div>
    </section>
  );
}