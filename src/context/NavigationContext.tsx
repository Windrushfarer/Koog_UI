import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

type NavigationContextType = {
  goToNextStep: () => void
  canGoToNext: boolean
  currentStep: string
}

const NavigationContext = createContext<NavigationContextType | undefined>(
  undefined,
)

type NavigationProviderProps = {
  children: ReactNode
  goToNextStep: () => void
  canGoToNext: boolean
  currentStep: string
}

export function NavigationProvider({
  children,
  goToNextStep,
  canGoToNext,
  currentStep,
}: NavigationProviderProps) {
  return (
    <NavigationContext.Provider
      value={{
        goToNextStep,
        canGoToNext,
        currentStep,
      }}
    >
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider')
  }
  return context
}
