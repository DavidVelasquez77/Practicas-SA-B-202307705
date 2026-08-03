import { InputHTMLAttributes } from 'react';

interface SamuraiInputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function SamuraiInput({
  label,
  ...inputProps
}: SamuraiInputProps) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
        {label}
      </span>

      <input
        {...inputProps}
        className="w-full rounded-none border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition-all duration-200 placeholder:text-zinc-700 focus:border-red-600 focus:shadow-[0_0_15px_rgba(220,38,38,0.18)]"
      />
    </label>
  );
}