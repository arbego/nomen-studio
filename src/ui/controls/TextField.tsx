import { DesignInput } from '../DesignHistory';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
}

export function TextField({ label, value, onChange, maxLength, placeholder }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">{label}</span>
      <DesignInput
        type="text"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-base text-stone-800 dark:text-stone-200 outline-none transition-colors focus:border-stone-500 dark:focus:border-stone-400"
      />
    </label>
  );
}
