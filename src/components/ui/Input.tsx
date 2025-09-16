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
        'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ' +
        className
      }
    />
  )
}


