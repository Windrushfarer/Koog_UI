import { createContext, useContext, useReducer, useEffect } from 'react'
import type { ReactNode } from 'react'

type TriggerType =
  | 'youtrack'
  | 'github'
  | 'slack'
  | 'google-calendar'
  | 'telegram'
  | null

type Tool = {
  id: string
  name: string
  description: string
}

type FormState = {
  trigger: {
    selectedTrigger: TriggerType
    value: string
  }
  setup: {
    selectedProviderId: string
    selectedVersionId: string
    systemPrompt: string
  }
  output: {
    destination: 'slack' | 'telegram' | null
    slackChannel: string
    telegramChat: string
  }
  tools: {
    available: Array<Tool>
    enabledMap: Record<string, boolean>
  }
}

type FormAction =
  | { type: 'SET_TRIGGER'; payload: { selectedTrigger: TriggerType; value: string } }
  | { type: 'SET_SETUP'; payload: { selectedProviderId: string; selectedVersionId: string } }
  | { type: 'SET_SYSTEM_PROMPT'; payload: { systemPrompt: string } }
  | { type: 'SET_OUTPUT'; payload: { destination: 'slack' | 'telegram' | null; slackChannel: string; telegramChat: string } }
  | { type: 'INIT_TOOLS'; payload: { available: Array<Tool>; enabledMap?: Record<string, boolean> } }
  | { type: 'SET_TOOL_ENABLED'; payload: { id: string; enabled: boolean } }

const DEFAULT_TOOLS: Array<Tool> = [
  { id: 'weather', name: 'Weather', description: 'Get current weather and forecasts for locations.' },
  { id: 'map', name: 'Map', description: 'Lookup places, routes, and coordinates.' },
  { id: 'web-search', name: 'Web Search', description: 'Search the web in real time.' }
]

const initialState: FormState = {
  trigger: {
    selectedTrigger: null,
    value: '',
  },
  setup: {
    selectedProviderId: '',
    selectedVersionId: '',
    systemPrompt: ''
  },
  output: {
    destination: null,
    slackChannel: '',
    telegramChat: ''
  },
  tools: {
    available: DEFAULT_TOOLS,
    enabledMap: Object.fromEntries(DEFAULT_TOOLS.map(t => [t.id, true]))
  }
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_TRIGGER':
      return {
        ...state,
        trigger: action.payload,
      }
    case 'SET_SETUP':
      return {
        ...state,
        setup: { ...state.setup, ...action.payload }
      }
    case 'SET_SYSTEM_PROMPT':
      return {
        ...state,
        setup: { ...state.setup, systemPrompt: action.payload.systemPrompt }
      }
    case 'SET_OUTPUT':
      return {
        ...state,
        output: action.payload,
      }
    case 'INIT_TOOLS': {
      const available = action.payload.available
      const enabledMap = action.payload.enabledMap ?? Object.fromEntries(available.map(t => [t.id, true]))
      return {
        ...state,
        tools: { available, enabledMap }
      }
    }
    case 'SET_TOOL_ENABLED': {
      const { id, enabled } = action.payload
      return {
        ...state,
        tools: {
          ...state.tools,
          enabledMap: { ...state.tools.enabledMap, [id]: enabled }
        }
      }
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

  // Log global form state on every change
  useEffect(() => {
    // Grouped for readability in console
    // eslint-disable-next-line no-console
    console.log('[FormContext] State updated:', state)
  }, [state])

  const isTriggerValid = () => {
    return (
      state.trigger.selectedTrigger !== null &&
      (state.trigger.selectedTrigger === 'google-calendar' ||
        state.trigger.selectedTrigger === 'telegram' ||
        state.trigger.value.trim() !== '')
    )
  }

  const isSetupValid = () => {
    return (
      state.setup.selectedProviderId !== '' &&
      state.setup.selectedVersionId !== ''
    )
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
    <FormContext.Provider
      value={{
        state,
        dispatch,
        isTriggerValid,
        isSetupValid,
        isOutputValid,
        canProceedToNext,
      }}
    >
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
