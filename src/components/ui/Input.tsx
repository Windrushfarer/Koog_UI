import type { ChangeEventHandler, InputHTMLAttributes } from 'react'

type InputProps = {
  value: string
  onChange: ChangeEventHandler<HTMLInputElement>
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>

export default function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      {...props}
      className={
        'block w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 placeholder-neutral-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ' +
        className
      }
    />
  )
}
