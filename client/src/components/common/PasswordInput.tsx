import { useState } from 'react';
import { FaRegEye, FaRegEyeSlash } from 'react-icons/fa6';
import { Input, type InputProps } from './Input';

type PasswordInputProps = Omit<InputProps, 'type' | 'trailing'>;

export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="pointer-events-auto grid size-9 place-items-center rounded-lg text-ink-500 transition hover:bg-stone-100 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {visible ? <FaRegEyeSlash aria-hidden="true" className="size-4" /> : <FaRegEye aria-hidden="true" className="size-4" />}
        </button>
      }
    />
  );
}
