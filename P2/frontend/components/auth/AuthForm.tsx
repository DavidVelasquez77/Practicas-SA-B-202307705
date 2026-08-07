'use client';

import { SamuraiButton } from '@/components/ui/SamuraiButton';
import { SamuraiInput } from '@/components/ui/SamuraiInput';
import { SamuraiSelect } from '@/components/ui/SamuraiSelect';
import { useAuthForm } from '@/hooks/useAuthForm';
import type { UserRole } from '@/types/auth.types';
import { AuthModeSelector } from './AuthModeSelector';
import { AuthStatusMessage } from './AuthStatusMessage';

const ROLE_OPTIONS: Array<{
  value: UserRole;
  label: string;
}> = [
  {
    value: 'Cliente',
    label: 'Cliente',
  },
  {
    value: 'Admin',
    label: 'Admin',
  },
];

const NAME_PATTERN =
  '[A-Za-zÁÉÍÓÚáéíóúÑñÜü\\s]+';

const PASSWORD_PATTERN =
  '(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,64}';

const PASSWORD_REQUIREMENTS =
  'La contraseña debe tener entre 8 y 64 caracteres, al menos una letra mayúscula, una minúscula, un número y un símbolo';

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
    <section className="w-full overflow-hidden border border-zinc-800 bg-black shadow-2xl">
      <AuthModeSelector
        mode={mode}
        onChange={changeMode}
      />

      <form
        onSubmit={submit}
        className="space-y-6 p-7 sm:p-10"
        noValidate={false}
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
            name="nombre"
            value={form.nombre}
            required
            minLength={3}
            maxLength={100}
            pattern={NAME_PATTERN}
            title="El nombre debe tener entre 3 y 100 caracteres y solo puede contener letras y espacios"
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
          name="correo"
          value={form.correo}
          required
          maxLength={150}
          autoComplete="email"
          placeholder="usuario@correo.com"
          title="Ingresa un correo electrónico válido"
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
          name="contrasena"
          value={form.contrasena}
          required
          minLength={
            isRegisterMode
              ? 8
              : undefined
          }
          maxLength={64}
          pattern={
            isRegisterMode
              ? PASSWORD_PATTERN
              : undefined
          }
          title={
            isRegisterMode
              ? PASSWORD_REQUIREMENTS
              : 'Ingresa tu contraseña'
          }
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
          <>
            <div className="border border-red-950 bg-red-950/10 px-4 py-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-red-500">
                Requisitos de contraseña
              </p>

              <ul className="space-y-1 font-mono text-xs text-zinc-500">
                <li>• Mínimo 8 caracteres</li>
                <li>• Una letra mayúscula</li>
                <li>• Una letra minúscula</li>
                <li>• Un número</li>
                <li>• Un símbolo</li>
              </ul>
            </div>

            <SamuraiSelect
              label="Rol"
              name="rol"
              value={form.rol}
              options={ROLE_OPTIONS}
              required
              onChange={(event) => {
                updateField(
                  'rol',
                  event.target.value as UserRole,
                );
              }}
            />
          </>
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