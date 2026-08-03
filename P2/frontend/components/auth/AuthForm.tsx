'use client';

import { AuthModeSelector } from './AuthModeSelector';
import { AuthStatusMessage } from './AuthStatusMessage';
import { SamuraiButton } from '@/components/ui/SamuraiButton';
import { SamuraiInput } from '@/components/ui/SamuraiInput';
import { SamuraiSelect } from '@/components/ui/SamuraiSelect';
import { useAuthForm } from '@/hooks/useAuthForm';
import type { UserRole } from '@/types/auth.types';

const ROLE_OPTIONS = [
  {
    value: 'Cliente',
    label: 'Cliente',
  },
  {
    value: 'Admin',
    label: 'Admin',
  },
];

export function AuthForm() {
  const {
    mode,
    form,
    message,
    isError,
    isLoading,
    isRegisterMode,
    updateField,
    changeMode,
    submit,
  } = useAuthForm();

  return (
    <section className="border border-red-900 bg-black/70 shadow-[0_0_40px_rgba(127,29,29,0.12)] backdrop-blur">
      <AuthModeSelector
        mode={mode}
        onChange={changeMode}
      />

      <form
        onSubmit={submit}
        className="space-y-6 p-7 sm:p-10"
      >
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-500">
            {isRegisterMode
              ? 'Nuevo guerrero'
              : 'Identificación'}
          </p>

          <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white">
            {isRegisterMode
              ? 'Crear una identidad'
              : 'Cruzar el umbral'}
          </h2>
        </header>

        {isRegisterMode && (
          <SamuraiInput
            label="Nombre"
            type="text"
            value={form.nombre}
            required
            autoComplete="name"
            placeholder="Nombre del usuario"
            onChange={(event) => {
              updateField(
                'nombre',
                event.target.value,
              );
            }}
          />
        )}

        <SamuraiInput
          label="Correo"
          type="email"
          value={form.correo}
          required
          autoComplete="email"
          placeholder="usuario@correo.com"
          onChange={(event) => {
            updateField(
              'correo',
              event.target.value,
            );
          }}
        />

        <SamuraiInput
          label="Contraseña"
          type="password"
          value={form.contrasena}
          required
          autoComplete={
            isRegisterMode
              ? 'new-password'
              : 'current-password'
          }
          placeholder="••••••••••••"
          onChange={(event) => {
            updateField(
              'contrasena',
              event.target.value,
            );
          }}
        />

        {isRegisterMode && (
          <SamuraiSelect
            label="Rol"
            value={form.rol}
            options={ROLE_OPTIONS}
            onChange={(event) => {
              updateField(
                'rol',
                event.target.value as UserRole,
              );
            }}
          />
        )}

        <AuthStatusMessage
          message={message}
          isError={isError}
        />

        <SamuraiButton
          type="submit"
          disabled={isLoading}
        >
          {isLoading
            ? 'Procesando...'
            : isRegisterMode
              ? 'Registrar identidad'
              : 'Ingresar'}
        </SamuraiButton>
      </form>

      <footer className="border-t border-red-950 px-7 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-700 sm:px-10">
        access_token · httpOnly · sameSite=lax
      </footer>
    </section>
  );
}