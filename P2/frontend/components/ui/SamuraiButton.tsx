import { ButtonHTMLAttributes } from 'react';

interface SamuraiButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  fullWidth?: boolean;
}

export function SamuraiButton({
  children,
  fullWidth = true,
  ...buttonProps
}: SamuraiButtonProps) {
  return (
    <button
      {...buttonProps}
      className={`${fullWidth ? 'w-full' : ''} rounded-none border border-red-600 bg-red-700 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-white transition-all duration-200 hover:bg-red-600 hover:shadow-[0_0_15px_rgba(220,38,38,0.3)] disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600`}
    >
      {children}
    </button>
  );
}