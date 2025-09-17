import { createContext, useContext, useReducer } from 'react'
import type { ReactNode } from 'react';

type TriggerType = 'youtrack' | 'github' | 'slack' | 'google-calendar' | 'telegram' | null

type FormState = {
  trigger: {
    selectedTrigger: TriggerType
    value: string
  }
  setup: {
    selectedProviderId: string
    selectedVersionId: string
  }
  output: {
    destination: 'slack' | 'telegram' | null
    slackChannel: string
    telegramChat: string
  }
}

type FormAction =
  | { type: 'SET_TRIGGER'; payload: { selectedTrigger: TriggerType; value: string } }
  | { type: 'SET_SETUP'; payload: { selectedProviderId: string; selectedVersionId: string } }
  | { type: 'SET_OUTPUT'; payload: { destination: 'slack' | 'telegram' | null; slackChannel: string; telegramChat: string } }

const initialState: FormState = {
  trigger: {
    selectedTrigger: null,
    value: ''
  },
  setup: {
    selectedProviderId: '',
    selectedVersionId: ''
  },
  output: {
    destination: null,
    slackChannel: '',
    telegramChat: ''
  }
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_TRIGGER':
      return {
        ...state,
        trigger: action.payload
      }
    case 'SET_SETUP':
      return {
        ...state,
        setup: action.payload
      }
    case 'SET_OUTPUT':
      return {
        ...state,
        output: action.payload
      }
    default:
      return state
  }
}

type FormContextType = {
  state: FormState
  dispatch: React.Dispatch<FormAction>
  isTriggerValid: () => boolean
  isSetupValid: () => boolean
  isOutputValid: () => boolean
  canProceedToNext: (currentTab: string) => boolean
}

const FormContext = createContext<FormContextType | undefined>(undefined)

export function FormProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(formReducer, initialState)

  const isTriggerValid = () => {
    return state.trigger.selectedTrigger !== null &&
           (state.trigger.selectedTrigger === 'google-calendar' ||
            state.trigger.selectedTrigger === 'telegram' ||
            state.trigger.value.trim() !== '')
  }

  const isSetupValid = () => {
    return state.setup.selectedProviderId !== '' && state.setup.selectedVersionId !== ''
  }

  const isOutputValid = () => {
    if (state.output.destination === 'slack') {
      return state.output.slackChannel.trim() !== ''
    }
    if (state.output.destination === 'telegram') {
      return state.output.telegramChat.trim() !== ''
    }
    return false
  }

  const canProceedToNext = (currentTab: string) => {
    switch (currentTab) {
      case 'trigger':
        return isTriggerValid()
      case 'setup':
        return isSetupValid()
      case 'agent':
        return true
      case 'output':
        return isOutputValid()
      default:
        return false
    }
  }

  return (
    <FormContext.Provider value={{
      state,
      dispatch,
      isTriggerValid,
      isSetupValid,
      isOutputValid,
      canProceedToNext
    }}>
      {children}
    </FormContext.Provider>
  )
}

export function useForm() {
  const context = useContext(FormContext)
  if (context === undefined) {
    throw new Error('useForm must be used within a FormProvider')
  }
  return context
}