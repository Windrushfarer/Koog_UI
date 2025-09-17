import { useNavigation } from '../../context/NavigationContext'

type FloatingNextButtonProps = {
  onClick?: () => void
}

export default function FloatingNextButton({
  onClick,
}: FloatingNextButtonProps) {
  const { goToNextStep, canGoToNext, currentStep } = useNavigation()

  const handleClick = () => {
    if (canGoToNext) {
      goToNextStep()
      onClick?.()
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={!canGoToNext}
      className={`inline-flex items-center gap-2 rounded-full px-14 py-4 text-2xl font-bold shadow-lg ring-1 ring-white/10 transition select-none ${
        canGoToNext
          ? 'cursor-pointer bg-[#B191FF] text-white shadow-[#B191FF]/40 hover:brightness-110 active:brightness-95'
          : 'cursor-not-allowed bg-neutral-600 text-neutral-400 shadow-neutral-600/20'
      }`}
    >
      <span>{currentStep === 'output' ? "Let's Koog!" : 'Next'}</span>
      <span aria-hidden>→</span>
    </button>
  )
}
