import { useId, type TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, id, className = '', ...rest }: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  return (
    <div className="space-y-1.5">
      <label htmlFor={textareaId} className="block text-sm font-medium text-ink-700">
        {label}
      </label>
      <textarea
        id={textareaId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${textareaId}-error` : undefined}
        className={`w-full rounded-xl border bg-white px-4 py-3 text-sm leading-relaxed text-ink-900 shadow-sm transition placeholder:text-stone-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12 ${
          error ? 'border-red-400' : 'border-stone-300 hover:border-stone-400'
        } ${className}`}
        {...rest}
      />
      {error ? (
        <p id={`${textareaId}-error`} className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}
