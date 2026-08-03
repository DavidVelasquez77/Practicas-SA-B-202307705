import type {
  SelectHTMLAttributes,
} from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SamuraiSelectProps
  extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
}

export function SamuraiSelect({
  label,
  options,
  ...selectProps
}: SamuraiSelectProps) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
        {label}
      </span>

      <select
        {...selectProps}
        className="w-full rounded-none border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition-all duration-200 focus:border-red-600 focus:shadow-[0_0_15px_rgba(220,38,38,0.18)]"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}