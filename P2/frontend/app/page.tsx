import { AuthForm } from '@/components/auth/AuthForm';
import { AuthHeader } from '@/components/auth/AuthHeader';

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.18),transparent_42%)]" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16">
        <div className="grid w-full gap-12 lg:grid-cols-[1fr_460px] lg:items-center">
          <AuthHeader />
          <AuthForm />
        </div>
      </section>
    </main>
  );
}