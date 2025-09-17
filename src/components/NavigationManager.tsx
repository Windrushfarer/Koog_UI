import { useNavigate, useSearch } from '@tanstack/react-router'
import { useForm } from '../context/FormContext'
import { NavigationProvider } from '../context/NavigationContext'
import MultiNavigationMenu from './menuContent/header/MultiNavigationMenu'
import FloatingNextButton from './ui/FloatingNextButton'

const defaultNavigation = [
  { id: 'trigger', label: 'Trigger' },
  { id: 'setup', label: 'Setup' },
  { id: 'agent', label: 'Agent' },
  { id: 'output', label: 'Output' },
]

export default function NavigationManager() {
  const { canProceedToNext } = useForm()
  const navigate = useNavigate()
  const search = useSearch({ from: '/' })

  const activeId = search.tab || 'trigger'

  const goToNextStep = () => {
    const currentIndex = defaultNavigation.findIndex(
      (item) => item.id === activeId,
    )
    if (
      currentIndex < defaultNavigation.length - 1 &&
      canProceedToNext(activeId)
    ) {
      const nextId = defaultNavigation[currentIndex + 1].id
      void navigate({
        to: '/',
        search: { tab: nextId },
      })
    }
  }

  const currentIndex = defaultNavigation.findIndex(
    (item) => item.id === activeId,
  )
  const isLastStep = currentIndex === defaultNavigation.length - 1
  const canGoToNext = isLastStep
    ? canProceedToNext(activeId)
    : currentIndex < defaultNavigation.length - 1 && canProceedToNext(activeId)

  return (
    <NavigationProvider
      goToNextStep={goToNextStep}
      canGoToNext={canGoToNext}
      currentStep={activeId}
    >
      <MultiNavigationMenu />
      <div className="sticky bottom-0 z-40 flex justify-end pointer-events-none">
        <div className="pointer-events-auto p-4">
          <FloatingNextButton />
        </div>
      </div>
    </NavigationProvider>
  )
}
