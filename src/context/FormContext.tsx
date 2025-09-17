import { createContext, useContext, useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import {
  PROVIDERS,
  PROVIDER_LLMS,
} from '@/components/menuContent/body/SetupContent/SetupContent.consts.ts'

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

export type CanvasPortType =
  | 'String'
  | 'ToolCall'
  | 'ToolResult'
  | 'JudgeResult'

export type CanvasNodeKind =
  | 'start'
  | 'finish'
  | 'ask-llm'
  | 'ask-user'
  | 'tool-call'
  | 'task'
  | 'llm-judge'

export type CanvasAskLlmConfig = {
  name: string
  providerId: string
  modelId: string
  prompt: string
}

export type CanvasAskUserConfig = {
  name: string
  slackChannel: string
}

export type CanvasTaskConfig = {
  name: string
  task: string
  tools: Array<string>
}

export type CanvasSimpleNameConfig = {
  name: string
}

export type CanvasNodeConfigMap = {
  start: CanvasSimpleNameConfig
  finish: CanvasSimpleNameConfig
  'ask-llm': CanvasAskLlmConfig
  'ask-user': CanvasAskUserConfig
  'tool-call': CanvasSimpleNameConfig
  task: CanvasTaskConfig
  'llm-judge': CanvasAskLlmConfig
}

export type CanvasGraphNodeSnapshot = {
  id: string
  kind: CanvasNodeKind
  label: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  inputType: CanvasPortType | null
  outputTypes: Array<CanvasPortType>
  config: CanvasNodeConfigMap[CanvasNodeKind]
}

export type CanvasGraphEdgeSnapshot = {
  id: string
  sourceId: string
  sourcePort: number
  targetId: string
  control: { x: number; y: number }
  sourcePortType: CanvasPortType
  fieldName: string | null
}

export type CanvasGraphSnapshot = {
  nodes: Array<CanvasGraphNodeSnapshot>
  edges: Array<CanvasGraphEdgeSnapshot>
}

export type CanvasViewState = { scale: number; panX: number; panY: number }

export type CanvasState = {
  snapshot: CanvasGraphSnapshot
  view: CanvasViewState
}

export type AgentState =
  | { mode: 'default' }
  | { mode: 'custom'; state: CanvasState }

type FormState = {
  trigger: {
    selectedTrigger: TriggerType
    value: string
  }
  setup: {
    selectedProviderId: string
    selectedLLMId: string
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
  agent: AgentState
}

type FormAction =
  | {
      type: 'SET_TRIGGER'
      payload: { selectedTrigger: TriggerType; value: string }
    }
  | {
      type: 'SET_SETUP'
      payload: { selectedProviderId: string; selectedVersionId: string }
    }
  | { type: 'SET_SYSTEM_PROMPT'; payload: { systemPrompt: string } }
  | {
      type: 'SET_OUTPUT'
      payload: {
        destination: 'slack' | 'telegram' | null
        slackChannel: string
        telegramChat: string
      }
    }
  | {
      type: 'INIT_TOOLS'
      payload: { available: Array<Tool>; enabledMap?: Record<string, boolean> }
    }
  | { type: 'SET_TOOL_ENABLED'; payload: { id: string; enabled: boolean } }
  | { type: 'SET_AGENT_DEFAULT' }
  | { type: 'SET_AGENT_CUSTOM_STATE'; payload: CanvasState }

const DEFAULT_TOOLS: Array<Tool> = [
  {
    id: 'weather',
    name: 'Weather',
    description: 'Get current weather and forecasts for locations.',
  },
  {
    id: 'map',
    name: 'Map',
    description: 'Lookup places, routes, and coordinates.',
  },
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Search the web in real time.',
  },
]

const DEFAULT_CANVAS_VIEW: CanvasViewState = { scale: 1, panX: 0, panY: 0 }

const DEFAULT_CANVAS_SNAPSHOT: CanvasGraphSnapshot = {
  nodes: [
    {
      id: 'agent-start-node',
      kind: 'start',
      label: 'Start',
      position: { x: 140, y: 400 },
      size: { width: 220, height: 112 },
      inputType: null,
      outputTypes: ['String'],
      config: { name: 'Start' },
    },
    {
      id: 'agent-finish-node',
      kind: 'finish',
      label: 'Finish',
      position: { x: 800, y: 400 },
      size: { width: 220, height: 112 },
      inputType: 'String',
      outputTypes: [],
      config: { name: 'Finish' },
    },
  ],
  edges: [],
}

function cloneCanvasNode(
  node: CanvasGraphNodeSnapshot,
): CanvasGraphNodeSnapshot {
  const base = {
    id: node.id,
    kind: node.kind,
    label: node.label,
    position: { ...node.position },
    size: { ...node.size },
    inputType: node.inputType,
    outputTypes: [...node.outputTypes],
  }

  switch (node.kind) {
    case 'task': {
      const config = node.config as CanvasTaskConfig
      return {
        ...base,
        config: { ...config, tools: [...config.tools] },
      }
    }
    case 'ask-llm':
    case 'llm-judge':
      return {
        ...base,
        config: { ...node.config },
      }
    case 'ask-user':
      return {
        ...base,
        config: { ...node.config },
      }
    default:
      return {
        ...base,
        config: { ...node.config },
      }
  }
}

function cloneCanvasEdge(
  edge: CanvasGraphEdgeSnapshot,
): CanvasGraphEdgeSnapshot {
  return {
    ...edge,
    control: { ...edge.control },
  }
}

function cloneCanvasState(state: CanvasState): CanvasState {
  return {
    snapshot: {
      nodes: state.snapshot.nodes.map(cloneCanvasNode),
      edges: state.snapshot.edges.map(cloneCanvasEdge),
    },
    view: { ...state.view },
  }
}

export function createDefaultCanvasState(): CanvasState {
  return {
    snapshot: {
      nodes: DEFAULT_CANVAS_SNAPSHOT.nodes.map(cloneCanvasNode),
      edges: DEFAULT_CANVAS_SNAPSHOT.edges.map(cloneCanvasEdge),
    },
    view: { ...DEFAULT_CANVAS_VIEW },
  }
}

const initialState: FormState = {
  trigger: {
    selectedTrigger: null,
    value: '',
  },
  setup: {
    selectedProviderId: PROVIDERS[0].id,
    selectedLLMId: PROVIDER_LLMS[PROVIDERS[0].id][0].id,
    systemPrompt: '',
  },
  output: {
    destination: null,
    slackChannel: '',
    telegramChat: '',
  },
  tools: {
    available: DEFAULT_TOOLS,
    enabledMap: Object.fromEntries(DEFAULT_TOOLS.map((t) => [t.id, true])),
  },
  agent: { mode: 'default' },
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
        setup: { ...state.setup, ...action.payload },
      }
    case 'SET_SYSTEM_PROMPT':
      return {
        ...state,
        setup: { ...state.setup, systemPrompt: action.payload.systemPrompt },
      }
    case 'SET_OUTPUT':
      return {
        ...state,
        output: action.payload,
      }
    case 'INIT_TOOLS': {
      const available = action.payload.available
      const enabledMap =
        action.payload.enabledMap ??
        Object.fromEntries(available.map((t) => [t.id, true]))
      return {
        ...state,
        tools: { available, enabledMap },
      }
    }
    case 'SET_TOOL_ENABLED': {
      const { id, enabled } = action.payload
      return {
        ...state,
        tools: {
          ...state.tools,
          enabledMap: { ...state.tools.enabledMap, [id]: enabled },
        },
      }
    }
    case 'SET_AGENT_DEFAULT':
      return {
        ...state,
        agent: { mode: 'default' },
      }
    case 'SET_AGENT_CUSTOM_STATE':
      return {
        ...state,
        agent: { mode: 'custom', state: cloneCanvasState(action.payload) },
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
      state.setup.selectedProviderId !== '' && state.setup.selectedLLMId !== ''
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
