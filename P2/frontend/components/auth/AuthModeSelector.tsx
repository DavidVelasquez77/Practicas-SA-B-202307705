import { AuthMode } from '@/types/auth.types';

interface AuthModeSelectorProps {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
}

export function AuthModeSelector({
  mode,
  onChange,
}: AuthModeSelectorProps) {
  return (
    <div className="grid grid-cols-2 border-b border-red-900">
      {(['login', 'register'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-none px-5 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-all duration-200 ${
            mode === option
              ? 'bg-red-700 text-white'
              : 'bg-zinc-950 text-zinc-500 hover:bg-red-950 hover:text-white'
          }`}
        >
          {option === 'login'
            ? 'Iniciar sesión'
            : 'Registrarse'}
        </button>
      ))}
    </div>
  );
}