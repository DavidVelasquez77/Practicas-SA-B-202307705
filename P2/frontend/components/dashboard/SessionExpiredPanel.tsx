'use client';

import Link from 'next/link';

export function SessionExpiredPanel() {
  return (
    <section
      role="alert"
      aria-live="assertive"
      className="mx-auto flex min-h-[520px] w-full max-w-3xl items-center justify-center"
    >
      <div className="w-full border border-red-700 bg-black shadow-[0_0_35px_rgba(220,38,38,0.22)]">
        <header className="border-b border-red-800 bg-red-950/40 px-7 py-5">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.35em] text-red-500">
            Session terminated
          </p>
        </header>

        <div className="space-y-8 px-7 py-12 text-center sm:px-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center border border-red-700 bg-red-950/30">
            <span className="font-mono text-4xl font-black text-red-500">
              !
            </span>
          </div>

          <div className="space-y-4">
            <h2 className="text-3xl font-black uppercase tracking-tight text-white sm:text-5xl">
              Sesión
              <span className="block text-red-600">
                expirada
              </span>
            </h2>

            <p className="mx-auto max-w-xl font-mono text-sm leading-7 text-zinc-400">
              El JWT expiró y también se superó el tiempo de
              gracia permitido para su renovación. Por
              seguridad, debes iniciar sesión nuevamente.
            </p>
          </div>

          <div className="border-y border-red-950 py-5 font-mono text-xs leading-6 text-zinc-600">
            <p>
              <span className="text-red-500">&gt;</span>{' '}
              HTTP 401 Unauthorized
            </p>

            <p>
              <span className="text-red-500">&gt;</span>{' '}
              access_token inválido o expirado
            </p>

            <p>
              <span className="text-red-500">&gt;</span>{' '}
              renovación no disponible
            </p>
          </div>

          <Link
            href="/"
            className="inline-block w-full rounded-none border border-red-600 bg-red-700 px-6 py-4 text-sm font-black uppercase tracking-[0.25em] text-white transition-all duration-200 hover:bg-red-600 hover:shadow-[0_0_15px_rgba(220,38,38,0.3)]"
          >
            Regresar al login
          </Link>
        </div>

        <footer className="border-t border-red-950 px-7 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-700">
          Authentication required · access denied
        </footer>
      </div>
    </section>
  );
}