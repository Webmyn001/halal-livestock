import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  trailing?: ReactNode;
}

export function Input({ label, error, hint, id, className = '', trailing, ...rest }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-ink-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-ink-900 shadow-sm transition placeholder:text-stone-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12 ${
            error ? 'border-red-400' : 'border-stone-300 hover:border-stone-400'
          } ${trailing ? 'pr-12' : ''} ${className}`}
          {...rest}
        />
        {trailing ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">{trailing}</div>
        ) : null}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}
