import Link from 'next/link';

export function DashboardHeader() {
  return (
    <header className="border-b border-red-800 bg-black/70">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-red-500">
            Área protegida
          </p>

          <h1 className="mt-2 text-2xl font-black uppercase tracking-tight text-white">
            Dashboard del Ronin
          </h1>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden border-l border-red-700 pl-5 text-right sm:block">
            <p className="font-mono text-xs text-zinc-500">
              SESSION
            </p>

            <p className="mt-1 font-mono text-xs font-bold text-red-500">
              ACCESS_GRANTED
            </p>
          </div>

          <Link
            href="/"
            className="rounded-none border border-red-700 bg-transparent px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-red-500 transition-all duration-200 hover:bg-red-700 hover:text-white hover:shadow-[0_0_15px_rgba(220,38,38,0.3)]"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </header>
  );
}