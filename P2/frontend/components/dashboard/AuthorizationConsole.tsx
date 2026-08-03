import type {
  AuthorizationResult,
  ProtectedRoute,
} from '@/types/protected.types';

interface AuthorizationConsoleProps {
  result: AuthorizationResult | null;
  loadingRoute: ProtectedRoute | null;
}

function formatMessage(
  message: string | string[] | undefined,
): string {
  if (Array.isArray(message)) {
    return message.join(', ');
  }

  return message ?? 'Respuesta recibida';
}

function getStatusClass(ok: boolean): string {
  return ok
    ? 'text-zinc-200'
    : 'text-red-500';
}

function getResultContainerClass(ok: boolean): string {
  return ok
    ? 'border-zinc-500 bg-zinc-900/50'
    : 'border-red-600 bg-red-950/30';
}

function getMessageClass(ok: boolean): string {
  return ok
    ? 'text-zinc-300'
    : 'text-red-300';
}

export function AuthorizationConsole({
  result,
  loadingRoute,
}: AuthorizationConsoleProps) {
  return (
    <section className="min-h-[390px] border border-zinc-800 bg-black">
      <header className="flex items-center justify-between border-b border-red-900 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 bg-red-600" />

          <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
            Consola de autorización
          </p>
        </div>

        <p className="font-mono text-[10px] text-zinc-700">
          NESTJS://3000
        </p>
      </header>

      <div className="p-6 font-mono text-sm">
        {loadingRoute && (
          <LoadingConsole route={loadingRoute} />
        )}

        {!loadingRoute && !result && (
          <EmptyConsole />
        )}

        {!loadingRoute && result && (
          <ResultConsole result={result} />
        )}
      </div>
    </section>
  );
}

interface LoadingConsoleProps {
  route: ProtectedRoute;
}

function LoadingConsole({
  route,
}: LoadingConsoleProps) {
  return (
    <div className="space-y-2 text-zinc-400">
      <p>
        <span className="text-red-500">&gt;</span>{' '}
        Ejecutando prueba...
      </p>

      <p>
        <span className="text-red-500">&gt;</span>{' '}
        GET /protected/{route}
      </p>

      <p className="text-zinc-600">
        <span className="text-red-700">&gt;</span>{' '}
        Enviando cookie HTTP-only...
      </p>
    </div>
  );
}

function EmptyConsole() {
  return (
    <div className="space-y-3 text-zinc-600">
      <p>
        <span className="text-red-700">&gt;</span>{' '}
        Sistema preparado.
      </p>

      <p>
        <span className="text-red-700">&gt;</span>{' '}
        Selecciona una ruta para validar el rol.
      </p>
    </div>
  );
}

interface ResultConsoleProps {
  result: AuthorizationResult;
}

function ResultConsole({
  result,
}: ResultConsoleProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2 border-b border-zinc-900 pb-5">
        <p>
          <span className="text-red-500">&gt;</span>{' '}
          GET {result.route}
        </p>

        <p className="text-zinc-600">
          [{result.timestamp}]
        </p>

        <p className={getStatusClass(result.ok)}>
          HTTP {result.status} {result.statusText}
        </p>
      </div>

      <div
        className={`border-l-2 px-4 py-4 ${getResultContainerClass(
          result.ok,
        )}`}
      >
        <p className={getMessageClass(result.ok)}>
          {formatMessage(result.body.message)}
        </p>

        {result.body.error && (
          <p className="mt-2 text-red-500">
            Error: {result.body.error}
          </p>
        )}

        {result.body.rolesPermitidos && (
          <p className="mt-3 text-zinc-500">
            Roles permitidos:{' '}
            {result.body.rolesPermitidos.join(', ')}
          </p>
        )}
      </div>

      <pre className="overflow-x-auto border-t border-zinc-900 pt-5 text-xs leading-6 text-zinc-500">
        {JSON.stringify(result.body, null, 2)}
      </pre>
    </div>
  );
}