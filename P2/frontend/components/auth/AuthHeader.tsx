export function AuthHeader() {
  return (
    <header className="space-y-8 border-b border-red-800 pb-10 lg:border-b-0 lg:border-r lg:pr-16">
      <div className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.38em] text-red-500">
        <span className="h-px w-12 bg-red-700" />
        Sistema de acceso
      </div>

      <div>
        <p className="text-sm uppercase tracking-[0.45em] text-zinc-500">
          認証 · Autenticación
        </p>

        <h1 className="mt-4 text-5xl font-black uppercase leading-[0.95] text-white md:text-7xl">
          El camino
          <span className="block text-red-600">
            del Ronin
          </span>
        </h1>
      </div>

      <p className="border-l-2 border-red-700 pl-5 leading-7 text-zinc-400">
        Acceso disciplinado mediante JWT, cookies HTTP-only y
        autorización por roles.
      </p>
    </header>
  );
}