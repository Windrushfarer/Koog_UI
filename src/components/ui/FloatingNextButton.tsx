import React from 'react'

type FloatingNextButtonProps = {
  onClick?: () => void
}

export default function FloatingNextButton({ onClick }: FloatingNextButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-[#B191FF] px-5 py-3 text-xl font-semibold text-white shadow-lg shadow-[#B191FF]/40 ring-1 ring-white/10 hover:brightness-110 active:brightness-95 transition select-none"
    >
      <span>Next</span>
      <span aria-hidden>→</span>
    </button>
  )
}


