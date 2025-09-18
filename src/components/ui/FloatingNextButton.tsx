import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useNavigation } from '../../context/NavigationContext'

type FloatingNextButtonProps = {
  onClick?: () => void
}

export default function FloatingNextButton({
  onClick,
}: FloatingNextButtonProps) {
  const { goToNextStep, canGoToNext, currentStep } = useNavigation()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const loadingTimeoutRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (currentStep !== 'output' && isLoading) {
      setIsLoading(false)

      if (loadingTimeoutRef.current) {
        window.clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = undefined
      }
    }
  }, [currentStep, isLoading])

  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        window.clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = undefined
      }
    }
  }, [])

  const handleClick = () => {
    if (!canGoToNext || isLoading) return

    if (currentStep === 'output') {
      setIsLoading(true)
      loadingTimeoutRef.current = window.setTimeout(() => {
        loadingTimeoutRef.current = undefined
        setIsLoading(false)
        void navigate({ to: '/logs' })
      }, 3000)
      return
    }

    goToNextStep()
    onClick?.()
  }

  return (
    <button
      onClick={handleClick}
      disabled={!canGoToNext || isLoading}
      className={`inline-flex items-center gap-2 rounded-full px-14 py-4 text-2xl font-bold shadow-lg ring-1 ring-white/10 transition select-none ${
        canGoToNext && !isLoading
          ? 'cursor-pointer bg-[#B191FF] text-white shadow-[#B191FF]/40 hover:brightness-110 active:brightness-95'
          : 'cursor-not-allowed bg-neutral-600 text-neutral-400 shadow-neutral-600/20'
      }`}
    >
      {isLoading ? (
        <span className="flex items-center gap-3">
          <span className="relative flex h-6 w-6 items-center justify-center">
            <span className="absolute h-6 w-6 animate-ping rounded-full border-2 border-white/50" />
            <span className="absolute h-4 w-4 animate-spin rounded-full border-2 border-white border-b-transparent" />
          </span>
          <span>KOOG-ing...</span>
        </span>
      ) : (
        <>
          <span>{currentStep === 'output' ? "Let's Koog!" : 'Next'}</span>
          <span aria-hidden>→</span>
        </>
      )}
    </button>
  )
}
