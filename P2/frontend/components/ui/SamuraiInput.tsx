import type {
  InputHTMLAttributes,
} from 'react';

interface SamuraiInputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function SamuraiInput({
  label,
  id,
  name,
  className = '',
  ...inputProps
}: SamuraiInputProps) {
  const inputId =
    id ??
    name ??
    label
      .toLowerCase()
      .replace(/\s+/g, '-');

  return (
    <label
      htmlFor={inputId}
      className="block space-y-2"
    >
      <span className="block text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
        {label}
      </span>

      <input
        id={inputId}
        name={name}
        {...inputProps}
        className={[
          'w-full rounded-none border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition-all duration-200',
          'placeholder:text-zinc-700',
          'focus:border-red-600 focus:shadow-[0_0_15px_rgba(220,38,38,0.18)]',
          'invalid:border-red-800',
          className,
        ].join(' ')}
      />
    </label>
  );
}