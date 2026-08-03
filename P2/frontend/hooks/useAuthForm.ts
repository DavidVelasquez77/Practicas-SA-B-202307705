'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/auth.service';
import {
  AuthFormData,
  AuthMode,
} from '@/types/auth.types';

const INITIAL_FORM: AuthFormData = {
  nombre: '',
  correo: '',
  contrasena: '',
  rol: 'Cliente',
};

export function useAuthForm() {
  const router = useRouter();

  const [mode, setMode] =
    useState<AuthMode>('login');

  const [form, setForm] =
    useState<AuthFormData>(INITIAL_FORM);

  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isRegisterMode = mode === 'register';

  function updateField<K extends keyof AuthFormData>(
    field: K,
    value: AuthFormData[K],
  ): void {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function changeMode(nextMode: AuthMode): void {
    setMode(nextMode);
    setMessage('');
    setIsError(false);

    setForm((currentForm) => ({
      ...currentForm,
      nombre: '',
      contrasena: '',
    }));
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    setIsLoading(true);
    setMessage('');
    setIsError(false);

    try {
      if (isRegisterMode) {
        const response = await authService.register({
          nombre: form.nombre.trim(),
          correo: form.correo.trim().toLowerCase(),
          contrasena: form.contrasena,
          rol: form.rol,
        });

        setMessage(
          `${response.message}. Ahora puedes iniciar sesión.`,
        );

        setMode('login');

        setForm((currentForm) => ({
          ...currentForm,
          nombre: '',
          contrasena: '',
        }));

        return;
      }

      await authService.login({
        correo: form.correo.trim().toLowerCase(),
        contrasena: form.contrasena,
      });

      router.push('/dashboard');
      router.refresh();
    } catch (error: unknown) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : 'Ocurrió un error inesperado',
      );
    } finally {
      setIsLoading(false);
    }
  }

  return {
    mode,
    form,
    message,
    isError,
    isLoading,
    isRegisterMode,
    updateField,
    changeMode,
    submit,
  };
}