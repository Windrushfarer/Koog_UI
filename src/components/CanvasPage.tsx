import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { nanoid } from 'nanoid'
import {
  PROVIDERS,
  PROVIDER_LLMS,
} from './menuContent/body/SetupContent/SetupContent.consts'
import TriggerSlackForm from './menuContent/body/TriggerPointContent/TriggerSlackForm'
import CodeViewModal from './CodeViewModal'
import type { ProviderVersion } from './menuContent/body/SetupContent/SetupContent.consts'
import type {
  CanvasGraphSnapshot,
  CanvasState,
  CanvasViewState,
} from '@/context/FormContext.tsx'
import { createDefaultCanvasState, useForm } from '@/context/FormContext.tsx'

const uid = (() => {
  return () => nanoid()
})()

// ----------------------------------------
// Math / helpers
// ----------------------------------------
const GRID = 24 // grid size in world units
const MIN_SCALE = 0.5
const MAX_SCALE = 3
const BG_EXTENT = 100000 // big world rect for full-bleed grid
const WORLD = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }
const NODE_WIDTH = 200
const NODE_HEIGHT = 200
const TOOL_OPTIONS = ['Web Search', 'Weather', 'Map']

type Point = { x: number; y: number }
type PortType = 'String' | 'ToolCall' | 'ToolResult' | 'JudgeResult'
type NodeKind =
  | 'start'
  | 'finish'
  | 'ask-llm'
  | 'ask-user'
  | 'tool-call'
  | 'task'
  | 'llm-judge'
type PaletteNodeKind = Exclude<NodeKind, 'start' | 'finish'>

type AskLlmConfig = {
  name: string
  providerId: string
  modelId: string
  prompt: string
}

type AskUserConfig = {
  name: string
  slackChannel: string
}

type TaskConfig = {
  name: string
  task: string
  tools: Array<string>
}

type SimpleNameConfig = {
  name: string
}

type NodeConfigMap = {
  start: SimpleNameConfig
  finish: SimpleNameConfig
  'ask-llm': AskLlmConfig
  'ask-user': AskUserConfig
  'tool-call': SimpleNameConfig
  task: TaskConfig
  'llm-judge': AskLlmConfig
}

type NodeData = {
  id: string
  kind: NodeKind
  x: number
  y: number
  width: number
  height: number
  label: string
  inputType: PortType | null
  outputTypes: Array<PortType>
  config: NodeConfigMap[NodeKind]
}
type EdgeData = {
  id: string
  sourceId: string
  sourcePort: number
  sourcePortType: PortType
  targetId: string
  cx: number
  cy: number
  fieldName: string | null
}
type ViewState = { scale: number; panX: number; panY: number }
type Mode = 'select' | 'add-node' | 'connect'
type Selection =
  | { type: 'node'; id: string }
  | { type: 'edge'; id: string }
  | { type: null; id: null }
type HoverState =
  | { type: 'node'; id: string }
  | { type: 'edge'; id: string }
  | { type: null; id: null }
type DragState =
  | { type: 'node'; id: string; dx: number; dy: number; t: number }
  | { type: 'ctrl'; id: string; dx: number; dy: number; t: number }
  | { type: 'pan'; id: null; dx: number; dy: number; t: number }
  | { type: null; id: null; dx: number; dy: number; t: number }

type PanDelta = { dx: number; dy: number }
type NodeConnection = { source: NodeData; target: NodeData }

type PaletteTemplate = {
  id: PaletteNodeKind
  label: string
  icon: () => string
  inputType: PortType | null
  outputTypes: Array<PortType>
}

type EdgeGeometry = {
  d: string
  p0: Point
  p2: Point
  c: Point
  tMid: number
  mid: Point
  arrowPath: string
}

type EdgeWithGeometry = {
  edge: EdgeData
  geometry: EdgeGeometry
  gradientId: string
}

type PathData = { d: string }
type ConnectorHighlight = {
  input: boolean
  outputs: Set<number>
}

type ConnectSourceState = {
  nodeId: string
  port: number
}

type PendingFieldSelection = {
  sourceId: string
  sourcePort: number
  sourcePortType: PortType
  targetId: string
  targetInputType: PortType | null
  options: Array<FieldSpec>
}

type GraphNodeSnapshot = {
  id: string
  kind: NodeKind
  label: string
  position: Point
  size: { width: number; height: number }
  inputType: PortType | null
  outputTypes: Array<PortType>
  config: NodeConfigMap[NodeKind]
}

type GraphEdgeSnapshot = {
  id: string
  sourceId: string
  sourcePort: number
  targetId: string
  control: Point
  sourcePortType: PortType
  fieldName: string | null
}

type GraphSnapshot = {
  nodes: Array<GraphNodeSnapshot>
  edges: Array<GraphEdgeSnapshot>
}

type PersistedNode = CanvasGraphSnapshot['nodes'][number]

function cloneConfigFromPersistedNode(
  node: PersistedNode,
): NodeConfigMap[NodeKind] {
  switch (node.kind) {
    case 'task': {
      const config = node.config as TaskConfig
      return { ...config, tools: [...config.tools] }
    }
    case 'ask-llm':
    case 'llm-judge': {
      const config = node.config as NodeConfigMap['ask-llm']
      return { ...config }
    }
    case 'ask-user': {
      const config = node.config as NodeConfigMap['ask-user']
      return { ...config }
    }
    default: {
      const config = node.config as NodeConfigMap['start']
      return { ...config }
    }
  }
}

function hydrateNodesFromPersistedSnapshot(
  snapshot: CanvasGraphSnapshot,
): Array<NodeData> {
  return snapshot.nodes.map((node) => ({
    id: node.id,
    kind: node.kind as NodeKind,
    x: node.position.x,
    y: node.position.y,
    width: node.size.width,
    height: node.size.height,
    label: node.label,
    inputType: node.inputType as PortType | null,
    outputTypes: [...node.outputTypes] as Array<PortType>,
    config: cloneConfigFromPersistedNode(node),
  }))
}

function hydrateEdgesFromPersistedSnapshot(
  snapshot: CanvasGraphSnapshot,
): Array<EdgeData> {
  return snapshot.edges.map((edge) => ({
    id: edge.id,
    sourceId: edge.sourceId,
    sourcePort: edge.sourcePort,
    targetId: edge.targetId,
    cx: edge.control.x,
    cy: edge.control.y,
    sourcePortType: edge.sourcePortType as PortType,
    fieldName: edge.fieldName,
  }))
}

function cloneConfigFromGraphNode(
  node: GraphNodeSnapshot,
): NodeConfigMap[NodeKind] {
  switch (node.kind) {
    case 'task':
      return {
        ...(node.config as TaskConfig),
        tools: [...(node.config as TaskConfig).tools],
      }
    default:
      return { ...node.config }
  }
}

function toPersistedGraphSnapshot(
  snapshot: GraphSnapshot,
): CanvasGraphSnapshot {
  return {
    nodes: snapshot.nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      label: node.label,
      position: { ...node.position },
      size: { ...node.size },
      inputType: node.inputType,
      outputTypes: [...node.outputTypes],
      config: cloneConfigFromGraphNode(node),
    })),
    edges: snapshot.edges.map((edge) => ({
      id: edge.id,
      sourceId: edge.sourceId,
      sourcePort: edge.sourcePort,
      targetId: edge.targetId,
      control: { ...edge.control },
      sourcePortType: edge.sourcePortType,
      fieldName: edge.fieldName,
    })),
  }
}

function hydrateViewStateFromPersisted(view: CanvasViewState): ViewState {
  return { scale: view.scale, panX: view.panX, panY: view.panY }
}

function toPersistedViewState(view: ViewState): CanvasViewState {
  return { scale: view.scale, panX: view.panX, panY: view.panY }
}

function isViewEqual(a: CanvasViewState, b: CanvasViewState) {
  return a.scale === b.scale && a.panX === b.panX && a.panY === b.panY
}

function isSnapshotEqualToDefault(
  snapshot: CanvasGraphSnapshot,
  defaultSnapshotJson: string,
) {
  return JSON.stringify(snapshot) === defaultSnapshotJson
}

function getNodeMetaLines(node: NodeData): Array<string> | null {
  switch (node.kind) {
    case 'ask-llm':
    case 'llm-judge': {
      const config = node.config as AskLlmConfig
      const model = config.modelId.trim() || 'Not set'
      const prompt = config.prompt.trim()
      const promptPreview = prompt.trim() || 'Not set'
      return [`LLM: ${model}`, `Prompt: ${promptPreview}`]
    }
    case 'task': {
      const config = node.config as TaskConfig
      const task = config.task.trim()
      const preview = task.trim() || 'Not set'
      return [`Task: ${preview}`]
    }
    case 'ask-user': {
      const config = node.config as AskUserConfig
      const channel = config.slackChannel.trim() || 'Not set'
      return ['Slack', `Channel: ${channel}`]
    }
    default:
      return null
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const snap = (v: number, step = GRID) => Math.round(v / step) * step

function nodeCenter(n: NodeData) {
  return { cx: n.x + n.width / 2, cy: n.y + n.height / 2 }
}

function outputAnchors(node: NodeData): Array<Point> {
  const count = Math.max(0, node.outputTypes.length)
  if (count === 0) return []
  const anchors: Array<Point> = []
  const x = node.x + node.width
  if (count === 1) {
    anchors.push({ x, y: node.y + node.height / 2 })
    return anchors
  }
  const margin = Math.min(node.height / 4, 22)
  const usable = Math.max(node.height - margin * 2, 0)
  const step = count > 1 ? usable / (count - 1 || 1) : 0
  for (let i = 0; i < count; i += 1) {
    anchors.push({ x, y: node.y + margin + step * i })
  }
  return anchors
}

function fixedOutputAnchor(node: NodeData, portIndex = 0): Point {
  const all = outputAnchors(node)
  if (!all.length) {
    const { cx, cy } = nodeCenter(node)
    return { x: cx + node.width / 2, y: cy }
  }
  const idx = clamp(portIndex, 0, all.length - 1)
  return all[idx]
}

function closestOutputPort(node: NodeData, point: Point | null): number {
  const anchors = outputAnchors(node)
  if (!anchors.length || !point) {
    return 0
  }
  let bestIndex = 0
  let bestDist = Infinity
  for (let i = 0; i < anchors.length; i += 1) {
    const anchor = anchors[i]
    const dx = point.x - anchor.x
    const dy = point.y - anchor.y
    const dist = dx * dx + dy * dy
    if (dist < bestDist) {
      bestDist = dist
      bestIndex = i
    }
  }
  return bestIndex
}

function closestOutputPortOfType(
  node: NodeData,
  portType: PortType | null,
  point: Point | null,
): number {
  const anchors = outputAnchors(node)
  if (!anchors.length) return -1
  if (!portType) {
    return closestOutputPort(node, point)
  }
  let bestIndex = -1
  let bestDist = Infinity
  if (point) {
    for (let i = 0; i < anchors.length; i += 1) {
      if (node.outputTypes[i] !== portType) continue
      const anchor = anchors[i]
      const dx = point.x - anchor.x
      const dy = point.y - anchor.y
      const dist = dx * dx + dy * dy
      if (dist < bestDist) {
        bestDist = dist
        bestIndex = i
      }
    }
  }
  if (bestIndex === -1) {
    bestIndex = node.outputTypes.findIndex((type) => type === portType)
  }
  return bestIndex
}

function fixedInputAnchor(node: NodeData): Point {
  const { cx, cy } = nodeCenter(node)
  return { x: cx - node.width / 2, y: cy }
}

function normal2D(x: number, y: number): [number, number] {
  return [-y, x]
}

function vecNormalize(x: number, y: number): [number, number] {
  const L = Math.hypot(x, y) || 1
  return [x / L, y / L]
}

function defaultControlPoint(p0: Point, p2: Point, bump = 80): Point {
  const mx = (p0.x + p2.x) / 2
  const my = (p0.y + p2.y) / 2
  const [nx, ny] = vecNormalize(...normal2D(p2.x - p0.x, p2.y - p0.y))
  return { x: mx + nx * bump, y: my + ny * bump }
}

function svgPoint(
  svgEl: SVGSVGElement,
  clientX: number,
  clientY: number,
): Point {
  const pt = svgEl.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const mat = svgEl.getScreenCTM()?.inverse()
  if (!mat) {
    return { x: clientX, y: clientY }
  }
  const { x, y } = pt.matrixTransform(mat)
  return { x, y }
}

function qPoint(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = 1 - t
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  }
}

function controlFromT(p0: Point, p2: Point, t: number, M: Point): Point {
  const u = 1 - t
  const denom = 2 * u * t
  if (denom < 1e-6) {
    return {
      x: 2 * M.x - 0.5 * p0.x - 0.5 * p2.x,
      y: 2 * M.y - 0.5 * p0.y - 0.5 * p2.y,
    }
  }
  return {
    x: (M.x - u * u * p0.x - t * t * p2.x) / denom,
    y: (M.y - u * u * p0.y - t * t * p2.y) / denom,
  }
}

// ----------------------------------------
// Icons & palette
// ----------------------------------------
const CallLLMIcon = () => '🤖'
const AskUserIcon = () => '💬'

const ToolCallIcon = () => '⚙️'

const TaskIcon = () => '📝'

const VerificationIcon = () => '🛡️'

const paletteTemplates: Array<PaletteTemplate> = [
  {
    id: 'ask-llm',
    label: 'Ask LLM',
    icon: CallLLMIcon,
    inputType: 'String',
    outputTypes: ['String', 'ToolCall'],
  },
  {
    id: 'ask-user',
    label: 'Ask User',
    icon: AskUserIcon,
    inputType: 'String',
    outputTypes: ['String'],
  },
  {
    id: 'tool-call',
    label: 'Tool call',
    icon: ToolCallIcon,
    inputType: 'ToolCall',
    outputTypes: ['ToolResult'],
  },
  {
    id: 'task',
    label: 'Sub-Agent',
    icon: TaskIcon,
    inputType: 'String',
    outputTypes: ['String'],
  },
  {
    id: 'llm-judge',
    label: 'LLM Judge',
    icon: VerificationIcon,
    inputType: 'String',
    outputTypes: ['JudgeResult', 'JudgeResult'],
  },
]

const nodeOutputDescriptions: Record<NodeKind, Array<string>> = {
  start: [],
  finish: [],
  'ask-llm': ['onAssistantMessage', 'onToolCall'],
  'ask-user': [],
  'tool-call': [],
  task: [],
  'llm-judge': ['successful == true', 'successful == false'],
}

type FieldSpec = { name: string; type: PortType }

const typeFields: Record<PortType, Array<FieldSpec>> = {
  String: [],
  ToolCall: [
    { name: 'tool', type: 'String' },
    { name: 'content', type: 'String' },
  ],
  ToolResult: [
    { name: 'tool', type: 'String' },
    { name: 'content', type: 'String' },
  ],
  JudgeResult: [
    { name: 'feedback', type: 'String' },
    { name: 'input', type: 'String' },
  ],
}

type PaletteButtonProps = {
  template: PaletteTemplate
  active: boolean
  onSelect: (templateId: PaletteNodeKind) => void
}

const PaletteButton = ({ template, active, onSelect }: PaletteButtonProps) => {
  const Icon = template.icon
  return (
    <button
      type="button"
      onClick={() => onSelect(template.id)}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition shadow-sm ${
        active
          ? 'bg-sky-900/30 border-sky-500 text-sky-200'
          : 'bg-neutral-800 border-neutral-700 hover:border-neutral-500 text-neutral-200'
      }`}
    >
      {<Icon />}
      <span>{template.label}</span>
    </button>
  )
}

type ModeButtonProps = {
  name: string
  value: Mode
  hotkey?: string
  current: Mode
  onSelect: (mode: Mode) => void
}

const ModeButton = ({
  name,
  value,
  hotkey,
  current,
  onSelect,
}: ModeButtonProps) => (
  <button
    type="button"
    onClick={() => onSelect(value)}
    className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
      current === value
        ? 'bg-sky-600/80 text-white border-sky-500'
        : 'bg-neutral-800 text-neutral-200 border-neutral-700 hover:border-neutral-500'
    }`}
    title={hotkey ? `${name} (${hotkey})` : name}
  >
    {name}
    {hotkey ? ` (${hotkey})` : ''}
  </button>
)

export default function CanvasPage() {
  const navigate = useNavigate()
  const svgRef = useRef<SVGSVGElement | null>(null)

  const { state: formState, dispatch } = useForm()
  const agentState = formState.agent
  const defaultCanvasState = useMemo<CanvasState>(
    () => createDefaultCanvasState(),
    [],
  )
  const defaultSnapshotSignature = useMemo(
    () => JSON.stringify(defaultCanvasState.snapshot),
    [defaultCanvasState],
  )
  const initialCanvasState =
    agentState.mode === 'custom' ? agentState.state : defaultCanvasState

  const providerDefaults = useMemo(() => {
    const providerId = (() => {
      if (formState.setup.selectedProviderId) {
        return formState.setup.selectedProviderId
      }
      return PROVIDERS[0]?.id ?? ''
    })()
    const versions: Array<ProviderVersion> = providerId
      ? (PROVIDER_LLMS[providerId] ?? [])
      : []
    const modelId = (() => {
      if (
        formState.setup.selectedLLMId &&
        versions.some((version) => version.id === formState.setup.selectedLLMId)
      ) {
        return formState.setup.selectedLLMId
      }
      return versions[0]?.id ?? ''
    })()
    return { providerId, modelId }
  }, [formState.setup.selectedProviderId, formState.setup.selectedLLMId])

  const createConfigForKind = useCallback(
    (kind: NodeKind, name: string): NodeConfigMap[NodeKind] => {
      switch (kind) {
        case 'ask-llm':
          return {
            name,
            providerId: formState.setup.selectedProviderId,
            modelId: formState.setup.selectedLLMId,
            prompt: 'You are a helpful assistant',
          }
        case 'llm-judge':
          return {
            name,
            providerId: formState.setup.selectedProviderId,
            modelId: formState.setup.selectedLLMId,
            prompt: "Critique the user's response",
          }
        case 'ask-user':
          return {
            name,
            slackChannel: '',
          }
        case 'task':
          return {
            name,
            task: '',
            tools: [],
          }
        default:
          return { name }
      }
    },
    [formState, providerDefaults],
  )

  // View (pan/zoom)
  const [view, setView] = useState<ViewState>(() =>
    hydrateViewStateFromPersisted(initialCanvasState.view),
  )
  const viewRef = useRef<ViewState>(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])

  const [mode, setMode] = useState<Mode>('select')
  const [pendingTemplateId, setPendingTemplateId] =
    useState<PaletteNodeKind | null>(null)
  const [nodes, setNodes] = useState<Array<NodeData>>(() =>
    hydrateNodesFromPersistedSnapshot(initialCanvasState.snapshot),
  )
  const [edges, setEdges] = useState<Array<EdgeData>>(() =>
    hydrateEdgesFromPersistedSnapshot(initialCanvasState.snapshot),
  )
  const [configDialog, setConfigDialog] = useState<{
    nodeId: string
    kind: NodeKind
  } | null>(null)
  const [configDraft, setConfigDraft] = useState<
    NodeConfigMap[NodeKind] | null
  >(null)

  // Selection & hover
  const [selection, setSelection] = useState<Selection>({
    type: null,
    id: null,
  })
  const [hover, setHover] = useState<HoverState>({ type: null, id: null })
  const [connectSource, setConnectSource] = useState<ConnectSourceState | null>(
    null,
  )
  const [connectPreview, setConnectPreview] = useState<Point | null>(null)
  const [nodePreview, setNodePreview] = useState<Point | null>(null)
  const [isPointerInsideCanvas, setIsPointerInsideCanvas] = useState(false)
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null)
  const [editingLabelValue, setEditingLabelValue] = useState('')
  const [fieldSelection, setFieldSelection] =
    useState<PendingFieldSelection | null>(null)
  const [fieldOptionHover, setFieldOptionHover] = useState<string | null>(null)
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false)
  const [codeContent, setCodeContent] = useState('')

  // Drag state: 'node' | 'ctrl' | 'pan'
  const dragRef = useRef<DragState>({
    type: null,
    id: null,
    dx: 0,
    dy: 0,
    t: 0.5,
  })
  const [spacePressed, setSpacePressed] = useState(false)

  // rAF batching for panning
  const panDeltaRef = useRef<PanDelta>({ dx: 0, dy: 0 })
  const panRafRef = useRef<number>(0)
  const lastPointerWorldRef = useRef<Point | null>(null)
  const [pointerWorld, setPointerWorld] = useState<Point | null>(null)
  const editingInputRef = useRef<HTMLInputElement | null>(null)

  const commitLabelEdit = useCallback(
    (commit = true) => {
      setEditingLabelId((currentId) => {
        if (!currentId) return null
        if (commit) {
          const value = editingLabelValue.trim()
          const nextLabel = value.length ? value : 'Untitled'
          setNodes((prev) =>
            prev.map((n) =>
              n.id === currentId
                ? {
                    ...n,
                    label: nextLabel,
                    config: { ...n.config, name: nextLabel },
                  }
                : n,
            ),
          )
        }
        setEditingLabelValue('')
        return null
      })
    },
    [editingLabelValue, setNodes],
  )

  const currentTemplate = useMemo<PaletteTemplate | null>(() => {
    if (!pendingTemplateId) {
      return null
    }
    return paletteTemplates.find((tpl) => tpl.id === pendingTemplateId) ?? null
  }, [pendingTemplateId])

  const clampPanToWorld = useCallback(
    (
      panX: number,
      panY: number,
      scale: number,
    ): { panX: number; panY: number } => {
      const svg = svgRef.current
      if (!svg) return { panX, panY }
      const { width: w, height: h } = svg.getBoundingClientRect()
      const minPanX = w - WORLD.maxX * scale
      const maxPanX = -WORLD.minX * scale
      const minPanY = h - WORLD.maxY * scale
      const maxPanY = -WORLD.minY * scale

      const worldWidthPx = (WORLD.maxX - WORLD.minX) * scale
      const worldHeightPx = (WORLD.maxY - WORLD.minY) * scale
      let x = panX
      let y = panY
      if (worldWidthPx <= w) {
        const centerX = w / 2 - ((WORLD.minX + WORLD.maxX) / 2) * scale
        x = centerX
      } else {
        x = clamp(panX, minPanX, maxPanX)
      }
      if (worldHeightPx <= h) {
        const centerY = h / 2 - ((WORLD.minY + WORLD.maxY) / 2) * scale
        y = centerY
      } else {
        y = clamp(panY, minPanY, maxPanY)
      }
      return { panX: x, panY: y }
    },
    [],
  )

  const schedulePanFrame = useCallback(() => {
    if (panRafRef.current) return
    panRafRef.current = requestAnimationFrame(() => {
      const { dx, dy } = panDeltaRef.current
      panDeltaRef.current.dx = 0
      panDeltaRef.current.dy = 0
      panRafRef.current = 0
      if (dx || dy) {
        setView((prev) => {
          const unclampedX = prev.panX + dx
          const unclampedY = prev.panY + dy
          const { panX, panY } = clampPanToWorld(
            unclampedX,
            unclampedY,
            prev.scale,
          )
          return { ...prev, panX, panY }
        })
      }
    })
  }, [clampPanToWorld])

  const closeConfigDialog = useCallback(() => {
    setConfigDialog(null)
    setConfigDraft(null)
    setFieldOptionHover(null)
  }, [])

  const openConfigDialog = useCallback(
    (node: NodeData) => {
      setFieldSelection(null)
      setFieldOptionHover(null)
      setConnectSource(null)
      setConnectPreview(null)
      const baseConfig = { ...node.config } as NodeConfigMap[NodeKind]
      if (node.kind === 'ask-llm' || node.kind === 'llm-judge') {
        const cfg = baseConfig as AskLlmConfig
        let providerId = cfg.providerId || providerDefaults.providerId
        if (providerId && !PROVIDERS.some((p) => p.id === providerId)) {
          providerId = providerDefaults.providerId
        }
        const versions = providerId ? (PROVIDER_LLMS[providerId] ?? []) : []
        let modelId = cfg.modelId
        if (!modelId || !versions.some((version) => version.id === modelId)) {
          modelId = providerDefaults.modelId || versions[0]?.id || ''
        }
        cfg.providerId = providerId
        cfg.modelId = modelId
      }
      if (node.kind === 'ask-user') {
        const cfg = baseConfig as AskUserConfig
        if (!cfg.slackChannel && formState.output.slackChannel) {
          cfg.slackChannel = formState.output.slackChannel
        }
      }
      if (node.kind === 'task') {
        const cfg = baseConfig as TaskConfig
        if (!Array.isArray(cfg.tools)) {
          cfg.tools = ['Web Search', 'Weather', 'Map']
        }
      }
      setConfigDraft(baseConfig)
      setConfigDialog({ nodeId: node.id, kind: node.kind })
    },
    [formState.output.slackChannel, providerDefaults],
  )

  const handleConfigSave = useCallback(() => {
    if (!configDialog || !configDraft) return
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== configDialog.nodeId) {
          return node
        }
        return {
          ...node,
          config: {
            ...configDraft,
            name: node.label,
          } as NodeConfigMap[NodeKind],
        }
      }),
    )
    closeConfigDialog()
  }, [configDialog, configDraft, closeConfigDialog, setNodes])

  const activateSelectMode = useCallback(() => {
    setMode('select')
    setPendingTemplateId(null)
    setConnectSource(null)
    setConnectPreview(null)
    setNodePreview(null)
    setFieldSelection(null)
    setFieldOptionHover(null)
    closeConfigDialog()
  }, [closeConfigDialog])
  const activateConnectMode = useCallback(() => {
    if (mode === 'connect') {
      activateSelectMode()
      return
    }
    setMode('connect')
    setPendingTemplateId(null)
    setConnectSource(null)
    setConnectPreview(null)
    setNodePreview(null)
    setFieldSelection(null)
    setFieldOptionHover(null)
    closeConfigDialog()
  }, [mode, activateSelectMode, closeConfigDialog])

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const editingActive =
        Boolean(editingLabelId) &&
        editingInputRef.current === document.activeElement
      if (editingActive && e.key !== 'Escape') {
        return
      }
      if (configDialog) {
        if (e.key === 'Escape') {
          e.preventDefault()
          closeConfigDialog()
        }
        return
      }
      if (e.code === 'Space') {
        e.preventDefault()
        setSpacePressed(true)
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection.type === 'node') {
          const { id } = selection
          setNodes((prev) => prev.filter((n) => n.id !== id))
          setEdges((prev) =>
            prev.filter((ed) => ed.sourceId !== id && ed.targetId !== id),
          )
          setSelection({ type: null, id: null })
        } else if (selection.type === 'edge') {
          const { id } = selection
          setEdges((prev) => prev.filter((ed) => ed.id !== id))
          setSelection({ type: null, id: null })
        }
      }
      if (e.key.toLowerCase() === 'c') {
        e.preventDefault()
        setPendingTemplateId(null)
        activateConnectMode()
      }
      if (e.key === 'Escape') {
        if (fieldSelection) {
          e.preventDefault()
          setFieldSelection(null)
          setConnectSource(null)
          setConnectPreview(null)
          return
        }
        if ((mode === 'add-node' && currentTemplate) || mode === 'connect') {
          e.preventDefault()
          activateSelectMode()
        }
        if (editingLabelId) {
          e.preventDefault()
          commitLabelEdit(false)
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setSpacePressed(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [
    selection,
    mode,
    currentTemplate,
    editingLabelId,
    commitLabelEdit,
    activateConnectMode,
    activateSelectMode,
    fieldSelection,
    configDialog,
    closeConfigDialog,
  ])

  const nodeMap = useMemo(
    () => new Map<string, NodeData>(nodes.map((n) => [n.id, n])),
    [nodes],
  )
  const resolveConnection = useCallback(
    (
      firstId: string | null,
      secondId: string | null,
    ): NodeConnection | null => {
      if (!firstId || !secondId || firstId === secondId) return null
      const first = nodeMap.get(firstId)
      const second = nodeMap.get(secondId)
      if (!first || !second) return null

      const firstIsStart = first.kind === 'start'
      const secondIsStart = second.kind === 'start'
      if (firstIsStart && secondIsStart) return null

      const firstIsFinish = first.kind === 'finish'
      const secondIsFinish = second.kind === 'finish'
      if (firstIsFinish && secondIsFinish) return null

      let source = first
      let target = second

      if (firstIsStart || secondIsStart) {
        source = firstIsStart ? first : second
        target = firstIsStart ? second : first
      }

      if (firstIsFinish || secondIsFinish) {
        target = firstIsFinish ? first : second
        source = firstIsFinish ? second : first
      }

      if (source.id === target.id) {
        return null
      }

      return { source, target }
    },
    [nodeMap],
  )

  const computeNodePreviewPosition = useCallback((point: Point): Point => {
    const halfWidth = NODE_WIDTH / 2
    const halfHeight = NODE_HEIGHT / 2
    const x = clamp(point.x - halfWidth, WORLD.minX, WORLD.maxX - NODE_WIDTH)
    const y = clamp(point.y - halfHeight, WORLD.minY, WORLD.maxY - NODE_HEIGHT)
    return { x, y }
  }, [])

  const startEditingLabel = useCallback(
    (nodeId: string) => {
      const node = nodeMap.get(nodeId)
      if (!node) return
      if (node.kind === 'start' || node.kind === 'finish') {
        return
      }
      const label = (node.label || '').trim()
      if (!label) {
        return
      }
      setEditingLabelId(nodeId)
      setEditingLabelValue(label)
      setSelection({ type: 'node', id: nodeId })
    },
    [nodeMap],
  )

  useEffect(() => {
    if (!connectSource) {
      setConnectPreview(null)
    }
  }, [connectSource])

  useEffect(() => {
    if (!fieldSelection) {
      setFieldOptionHover(null)
    }
  }, [fieldSelection])

  useEffect(() => {
    if (mode !== 'connect') {
      setConnectSource(null)
      setConnectPreview(null)
    }
  }, [mode])

  useEffect(() => {
    if (
      spacePressed ||
      mode !== 'add-node' ||
      !currentTemplate ||
      !isPointerInsideCanvas
    ) {
      setNodePreview(null)
      return
    }
    if (lastPointerWorldRef.current) {
      setNodePreview(computeNodePreviewPosition(lastPointerWorldRef.current))
    }
  }, [
    spacePressed,
    mode,
    currentTemplate,
    isPointerInsideCanvas,
    computeNodePreviewPosition,
  ])

  useEffect(() => {
    if (editingLabelId && editingInputRef.current) {
      const handle = requestAnimationFrame(() => {
        editingInputRef.current?.focus()
        editingInputRef.current?.select()
      })
      return () => cancelAnimationFrame(handle)
    }
  }, [editingLabelId])

  function getSvgPointInWorld(clientX: number, clientY: number): Point {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    return svgPoint(svg, clientX, clientY)
  }
  function getWorldPoint(clientX: number, clientY: number): Point {
    const p = getSvgPointInWorld(clientX, clientY)
    const v = viewRef.current
    return { x: (p.x - v.panX) / v.scale, y: (p.y - v.panY) / v.scale }
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current
      if (drag.type === null) return

      if (drag.type === 'pan') {
        const mx = e.movementX
        const my = e.movementY
        panDeltaRef.current.dx += mx
        panDeltaRef.current.dy += my
        schedulePanFrame()
        e.preventDefault()
        return
      }

      const pw = getWorldPoint(e.clientX, e.clientY)
      if (drag.type === 'node') {
        setNodes((prev) =>
          prev.map((n) => {
            if (n.id !== drag.id) return n
            const x = clamp(
              snap(pw.x - drag.dx),
              WORLD.minX,
              WORLD.maxX - n.width,
            )
            const y = clamp(
              snap(pw.y - drag.dy),
              WORLD.minY,
              WORLD.maxY - n.height,
            )
            return { ...n, x, y }
          }),
        )
      } else {
        setEdges((prev) =>
          prev.map((ed) => {
            if (ed.id !== drag.id) return ed
            const s = nodeMap.get(ed.sourceId)
            const t = nodeMap.get(ed.targetId)
            if (!s || !t) return ed
            const portIndex = clamp(
              ed.sourcePort,
              0,
              Math.max(0, s.outputTypes.length - 1),
            )
            const p0 = fixedOutputAnchor(s, portIndex)
            const p2 = fixedInputAnchor(t)
            const snapped: Point = {
              x: clamp(snap(pw.x), WORLD.minX, WORLD.maxX),
              y: clamp(snap(pw.y), WORLD.minY, WORLD.maxY),
            }
            const cp = controlFromT(p0, p2, drag.t, snapped)
            return { ...ed, cx: cp.x, cy: cp.y }
          }),
        )
      }
      e.preventDefault()
    }
    const onUp = (e: PointerEvent) => {
      const svg = svgRef.current
      if (svg && dragRef.current.type === 'pan') {
        try {
          svg.releasePointerCapture(e.pointerId)
        } catch {}
      }
      dragRef.current = { type: null, id: null, dx: 0, dy: 0, t: 0.5 }
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [nodeMap, schedulePanFrame])

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const svg = svgRef.current
    if (!svg) return
    const pSvg = svgPoint(svg, e.clientX, e.clientY)
    const factor = Math.pow(1.0015, -e.deltaY)
    setView((prev) => {
      const newScale = clamp(prev.scale * factor, MIN_SCALE, MAX_SCALE)
      const worldX = (pSvg.x - prev.panX) / prev.scale
      const worldY = (pSvg.y - prev.panY) / prev.scale
      let panX = pSvg.x - worldX * newScale
      let panY = pSvg.y - worldY * newScale
      ;({ panX, panY } = clampPanToWorld(panX, panY, newScale))
      return { scale: newScale, panX, panY }
    })
  }

  const activateTemplate = (templateId: PaletteNodeKind) => {
    if (mode === 'add-node' && pendingTemplateId === templateId) {
      activateSelectMode()
      return
    }
    setConnectSource(null)
    setMode('add-node')
    setPendingTemplateId(templateId)
  }

  const onSVGPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (configDialog) {
      e.preventDefault()
      return
    }
    if (fieldSelection) {
      e.preventDefault()
      return
    }
    const svg = svgRef.current
    if (!svg) return
    if (spacePressed) {
      try {
        svg.setPointerCapture(e.pointerId)
      } catch {}
      dragRef.current = { type: 'pan', id: null, dx: 0, dy: 0, t: 0.5 }
      e.preventDefault()
    }
  }
  const onSVGPointerEnter = (e: React.PointerEvent<SVGSVGElement>) => {
    if (configDialog) return
    if (fieldSelection) return
    setIsPointerInsideCanvas(true)
    const pw = getWorldPoint(e.clientX, e.clientY)
    lastPointerWorldRef.current = pw
    setPointerWorld(pw)
    if (spacePressed) return
    if (mode === 'connect' && connectSource) {
      setConnectPreview(pw)
    } else if (mode === 'add-node' && currentTemplate) {
      setNodePreview(computeNodePreviewPosition(pw))
    }
  }
  const onSVGPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (configDialog) return
    if (fieldSelection) return
    const pw = getWorldPoint(e.clientX, e.clientY)
    lastPointerWorldRef.current = pw

    if (spacePressed) {
      setPointerWorld(null)
      if (nodePreview) {
        setNodePreview(null)
      }
      return
    }

    setPointerWorld(pw)

    if (mode === 'connect' && connectSource) {
      setConnectPreview(pw)
    } else if (mode === 'add-node' && currentTemplate) {
      setNodePreview(computeNodePreviewPosition(pw))
    }
  }
  const onSVGPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    if (dragRef.current.type === 'pan') {
      try {
        svg.releasePointerCapture(e.pointerId)
      } catch {}
    }
  }

  const onSVGPointerLeave = () => {
    if (configDialog) return
    if (fieldSelection) return
    setIsPointerInsideCanvas(false)
    lastPointerWorldRef.current = null
    if (mode === 'connect') {
      setConnectPreview(null)
    }
    setNodePreview(null)
    setPointerWorld(null)
  }

  const onSVGClick = (e: React.PointerEvent<SVGSVGElement>) => {
    if (configDialog) return
    if (fieldSelection) return
    if (spacePressed) return
    const pw = getWorldPoint(e.clientX, e.clientY)
    if (mode === 'add-node' && currentTemplate) {
      const id = uid()
      const placement = nodePreview || computeNodePreviewPosition(pw)
      const outputTypes = [...currentTemplate.outputTypes]
      const config = createConfigForKind(
        currentTemplate.id,
        currentTemplate.label,
      )
      setNodes((prev) =>
        prev.concat({
          id,
          kind: currentTemplate.id,
          x: placement.x,
          y: placement.y,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          label: currentTemplate.label,
          inputType: currentTemplate.inputType,
          outputTypes,
          config,
        }),
      )
      setSelection({ type: 'node', id })
      if (!nodePreview) {
        setNodePreview(placement)
      }
      setPendingTemplateId(null)
      return
    }
    setSelection({ type: null, id: null })
    setHover({ type: null, id: null })
    setConnectSource(null)
  }

  const onNodePointerDown = (
    e: React.PointerEvent<SVGGElement>,
    id: string,
  ) => {
    if (fieldSelection || configDialog) return
    if (spacePressed) return
    e.stopPropagation()
    if (editingLabelId) {
      commitLabelEdit()
    }
    const pw = getWorldPoint(e.clientX, e.clientY)
    const node = nodes.find((n) => n.id === id)
    if (!node) return
    dragRef.current = {
      type: 'node',
      id,
      dx: pw.x - node.x,
      dy: pw.y - node.y,
      t: 0.5,
    }
    setSelection({ type: 'node', id })
  }
  const onNodeClick = (e: React.MouseEvent<SVGGElement>, id: string) => {
    if (fieldSelection || configDialog) return
    if (spacePressed) return
    e.stopPropagation()

    const pointer = getWorldPoint(e.clientX, e.clientY)
    setPointerWorld(pointer)

    if (mode === 'connect') {
      const node = nodeMap.get(id)
      if (!node) return
      if (!connectSource && node.outputTypes.length === 0) {
        setSelection({ type: 'node', id })
        return
      }
      const port = closestOutputPort(node, pointer)

      if (!connectSource) {
        setConnectSource({ nodeId: id, port })
        setSelection({ type: 'node', id })
        setConnectPreview(pointer)
        return
      }

      if (connectSource.nodeId === id) {
        setConnectSource({ nodeId: id, port })
        setSelection({ type: 'node', id })
        setConnectPreview(pointer)
        return
      }

      const connection = resolveConnection(connectSource.nodeId, id)
      if (connection) {
        const { source, target } = connection

        if (source.outputTypes.length === 0) {
          return
        }

        let sourcePort: number
        if (source.id === connectSource.nodeId) {
          sourcePort = clamp(
            connectSource.port,
            0,
            Math.max(0, source.outputTypes.length - 1),
          )
        } else if (source.id === id) {
          sourcePort = clamp(
            port,
            0,
            Math.max(0, source.outputTypes.length - 1),
          )
        } else {
          const initialPort = target.inputType
            ? closestOutputPortOfType(source, target.inputType, pointer)
            : closestOutputPort(source, pointer)
          if (initialPort === -1) {
            return
          }
          sourcePort = clamp(
            initialPort,
            0,
            Math.max(0, source.outputTypes.length - 1),
          )
        }

        const targetInputType = target.inputType
        const sourcePortType = source.outputTypes[sourcePort]

        if (sourcePort < 0 || sourcePort >= source.outputTypes.length) {
          return
        }

        const duplicateEdge = edges.find(
          (ed) =>
            ed.sourceId === source.id &&
            ed.sourcePort === sourcePort &&
            ed.targetId === target.id,
        )
        if (duplicateEdge) {
          setSelection({ type: 'edge', id: duplicateEdge.id })
          activateSelectMode()
          return
        }

        if (targetInputType && sourcePortType !== targetInputType) {
          const available = typeFields[sourcePortType].filter(
            (field) => field.type === targetInputType,
          )
          if (!available.length) {
            return
          }
          setFieldSelection({
            sourceId: source.id,
            sourcePort,
            sourcePortType,
            targetId: target.id,
            targetInputType,
            options: available,
          })
          setConnectPreview(fixedInputAnchor(target))
          return
        }

        const a = fixedOutputAnchor(source, sourcePort)
        const b = fixedInputAnchor(target)
        const cp = defaultControlPoint(a, b, 60)
        const edgeId = uid()
        setEdges((prev) =>
          prev.concat({
            id: edgeId,
            sourceId: source.id,
            sourcePort,
            sourcePortType,
            targetId: target.id,
            cx: cp.x,
            cy: cp.y,
            fieldName: null,
          }),
        )
        setSelection({ type: 'edge', id: edgeId })
        activateSelectMode()
        return
      }

      setConnectSource(null)
      setConnectPreview(null)
      return
    }

    setSelection({ type: 'node', id })
  }

  const fulfillFieldSelection = useCallback(
    (field: FieldSpec) => {
      if (!fieldSelection) {
        return
      }
      const {
        sourceId,
        sourcePort,
        sourcePortType,
        targetId,
        targetInputType,
      } = fieldSelection
      const source = nodeMap.get(sourceId)
      const target = nodeMap.get(targetId)
      if (!source || !target) {
        setFieldSelection(null)
        setFieldOptionHover(null)
        return
      }
      if (targetInputType && field.type !== targetInputType) {
        return
      }
      const clampedPort = clamp(
        sourcePort,
        0,
        Math.max(0, source.outputTypes.length - 1),
      )
      const duplicateEdge = edges.find(
        (ed) =>
          ed.sourceId === source.id &&
          ed.sourcePort === clampedPort &&
          ed.targetId === target.id,
      )
      if (duplicateEdge) {
        setSelection({ type: 'edge', id: duplicateEdge.id })
        activateSelectMode()
        return
      }
      const a = fixedOutputAnchor(source, clampedPort)
      const b = fixedInputAnchor(target)
      const cp = defaultControlPoint(a, b, 60)
      const edgeId = uid()
      setEdges((prev) =>
        prev.concat({
          id: edgeId,
          sourceId: source.id,
          sourcePort: clampedPort,
          sourcePortType,
          targetId: target.id,
          cx: cp.x,
          cy: cp.y,
          fieldName: field.name,
        }),
      )
      setSelection({ type: 'edge', id: edgeId })
      activateSelectMode()
    },
    [activateSelectMode, edges, fieldSelection, nodeMap],
  )

  const onEdgeClick = (e: React.MouseEvent<SVGPathElement>, id: string) => {
    if (configDialog || fieldSelection) return
    if (spacePressed) return
    e.stopPropagation()
    setSelection({ type: 'edge', id })
  }
  const onEdgeEnter = (id: string) => {
    setHover({ type: 'edge', id })
  }
  const onEdgeLeave = () => {
    setHover({ type: null, id: null })
  }
  const onNodeEnter = (id: string) => {
    setHover({ type: 'node', id })
  }
  const onNodeLeave = () => {
    setHover({ type: null, id: null })
  }

  const onEdgeHandlePointerDown = (
    e: React.PointerEvent<SVGGElement>,
    edgeId: string,
    tFixed: number,
  ) => {
    if (configDialog || fieldSelection) return
    if (spacePressed) return
    e.stopPropagation()
    dragRef.current = { type: 'ctrl', id: edgeId, dx: 0, dy: 0, t: tFixed }
    setSelection({ type: 'edge', id: edgeId })
  }

  const nodeMapRender = useMemo(
    () => new Map<string, NodeData>(nodes.map((n) => [n.id, n])),
    [nodes],
  )
  const connectPreviewPath = useMemo<PathData | null>(() => {
    if (mode !== 'connect' || !connectSource || !connectPreview) return null
    let activeSourceId = connectSource.nodeId
    let portIndex = connectSource.port
    const hoveredNodeId = hover.type === 'node' ? hover.id : null
    if (hoveredNodeId && hoveredNodeId !== connectSource.nodeId) {
      const connection = resolveConnection(connectSource.nodeId, hoveredNodeId)
      if (connection) {
        activeSourceId = connection.source.id
        const sourceNodeCandidate = nodeMapRender.get(connection.source.id)
        const targetNodeCandidate = nodeMapRender.get(connection.target.id)
        if (sourceNodeCandidate) {
          if (sourceNodeCandidate.outputTypes.length > 0) {
            if (connection.source.id === connectSource.nodeId) {
              portIndex = clamp(
                connectSource.port,
                0,
                sourceNodeCandidate.outputTypes.length - 1,
              )
            } else {
              const targetInputType = targetNodeCandidate?.inputType ?? null
              if (targetInputType) {
                const compatible = closestOutputPortOfType(
                  sourceNodeCandidate,
                  targetInputType,
                  connectPreview,
                )
                if (compatible !== -1) {
                  portIndex = compatible
                } else {
                  portIndex = closestOutputPort(
                    sourceNodeCandidate,
                    connectPreview,
                  )
                }
              } else {
                portIndex = closestOutputPort(
                  sourceNodeCandidate,
                  connectPreview,
                )
              }
            }
          }
        }
      }
    }
    const sourceNode = nodeMapRender.get(activeSourceId)
    if (!sourceNode || sourceNode.outputTypes.length === 0) return null
    const clampedPort = clamp(portIndex, 0, sourceNode.outputTypes.length - 1)
    const start = fixedOutputAnchor(sourceNode, clampedPort)
    const cp = defaultControlPoint(start, connectPreview, 60)
    const d = `M ${start.x} ${start.y} Q ${cp.x} ${cp.y} ${connectPreview.x} ${connectPreview.y}`
    return { d }
  }, [
    mode,
    connectSource,
    connectPreview,
    nodeMapRender,
    hover,
    resolveConnection,
  ])

  const graphSnapshot = useMemo<GraphSnapshot>(() => {
    const nodeSnapshots: Array<GraphNodeSnapshot> = nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      label: node.label,
      position: { x: node.x, y: node.y },
      size: { width: node.width, height: node.height },
      inputType: node.inputType,
      outputTypes: [...node.outputTypes],
      config: { ...node.config },
    }))
    const edgeSnapshots: Array<GraphEdgeSnapshot> = edges.map((edge) => ({
      id: edge.id,
      sourceId: edge.sourceId,
      sourcePort: edge.sourcePort,
      targetId: edge.targetId,
      control: { x: edge.cx, y: edge.cy },
      sourcePortType: edge.sourcePortType,
      fieldName: edge.fieldName,
    }))
    return { nodes: nodeSnapshots, edges: edgeSnapshots }
  }, [nodes, edges])

  const graphSnapshotRef = useRef<GraphSnapshot>(graphSnapshot)
  useEffect(() => {
    graphSnapshotRef.current = graphSnapshot
  }, [graphSnapshot])

  const persistCanvasState = useCallback(() => {
    const persistedSnapshot = toPersistedGraphSnapshot(graphSnapshotRef.current)
    const persistedView = toPersistedViewState(viewRef.current)

    if (
      isViewEqual(persistedView, defaultCanvasState.view) &&
      isSnapshotEqualToDefault(persistedSnapshot, defaultSnapshotSignature)
    ) {
      dispatch({ type: 'SET_AGENT_DEFAULT' })
      return
    }

    dispatch({
      type: 'SET_AGENT_CUSTOM_STATE',
      payload: {
        snapshot: persistedSnapshot,
        view: persistedView,
      },
    })
  }, [defaultCanvasState, defaultSnapshotSignature, dispatch])

  useEffect(() => {
    return () => {
      persistCanvasState()
    }
  }, [persistCanvasState])

  const handleSave = useCallback(() => {
    persistCanvasState()
    // Replace with real persistence when ready
    // For now, just log the current graph state
    console.log('Canvas saved', { nodes, edges })
    void navigate({
      to: '/',
      search: { tab: 'agent' },
    })
  }, [edges, navigate, nodes, persistCanvasState])

  const handleViewCode = useCallback(() => {
    const exampleCode = `fun agentStrategy() = strategy<String, String>("Trip planning") {
    val proposeGatheringPlan by subgraphWithTask<String, String>(
        toolSelectionStrategy = ToolSelectionStrategy.ALL
    ) { input ->
        """
        Task: Create the plan for the trip
        Additional feedback: $input
        """.trimIndent()
    }

    val criticPlan by llmAsAJudge(
        llmModel = OpenAIModels.GPT_4_1,
        task = "You must evaluate the travel plan and decide if it's good or not.\\nLook at the LAST tool call that contains the full plan, and analyze if it needs any adjustments."
    )

    val askUser by askUserInSlack(channelId = "koog-next-bot")

    val analyzeSentiment by llmAsAJudge(
        llmModel = OpenAIModels.GPT_4_1,
        task = "You must understand the sentiment of user. Look at the LAST message from the user, and analyze if the user wants to refine the plan or is the user happy with it."
    )

    edge(nodeStart forwardTo proposeGatheringPlan)
    edge(proposeGatheringPlan forwardTo criticPlan)
    edge(criticPlan forwardTo askUser onCondition { it.successful } transformed { it.input })
    edge(criticPlan forwardTo proposeGatheringPlan onCondition { !it.successful } transformed { it.feedback })
    edge(askUser forwardTo analyzeSentiment)
    edge(analyzeSentiment forwardTo nodeFinish onCondition { it.successful } transformed { it.input })
    edge(analyzeSentiment forwardTo proposeGatheringPlan onCondition { !it.successful } transformed { it.feedback })
}`
    setCodeContent(exampleCode)
    setIsCodeModalOpen(true)
  }, [])

  const connectorHighlights = useMemo(() => {
    const highlights = new Map<string, ConnectorHighlight>()
    if (mode !== 'connect') {
      return highlights
    }

    const ensure = (id: string) => {
      if (!highlights.has(id)) {
        highlights.set(id, { input: false, outputs: new Set<number>() })
      }
      return highlights.get(id)!
    }
    const markInput = (id: string) => {
      ensure(id).input = true
    }
    const markOutput = (id: string, portIndex = 0) => {
      ensure(id).outputs.add(portIndex)
    }
    const hoveredNodeId = hover.type === 'node' ? hover.id : null

    if (connectSource) {
      const selectedSourceNode = nodeMapRender.get(connectSource.nodeId)
      let connectionHighlighted = false
      if (hoveredNodeId && hoveredNodeId !== connectSource.nodeId) {
        const connection = resolveConnection(
          connectSource.nodeId,
          hoveredNodeId,
        )
        if (connection) {
          const { source, target } = connection
          const sourceNode = nodeMapRender.get(source.id)
          const targetNode = nodeMapRender.get(target.id)
          if (sourceNode && targetNode) {
            const targetInputType = targetNode.inputType
            let highlightPort = -1
            if (sourceNode.outputTypes.length > 0) {
              if (source.id === connectSource.nodeId) {
                highlightPort = clamp(
                  connectSource.port,
                  0,
                  sourceNode.outputTypes.length - 1,
                )
              } else {
                const preferred = closestOutputPort(sourceNode, pointerWorld)
                highlightPort = preferred
                if (targetInputType) {
                  const compatible = closestOutputPortOfType(
                    sourceNode,
                    targetInputType,
                    pointerWorld,
                  )
                  if (compatible !== -1) {
                    highlightPort = compatible
                  }
                }
              }
            }

            if (
              highlightPort !== -1 &&
              highlightPort < sourceNode.outputTypes.length
            ) {
              const duplicateEdge = edges.some(
                (ed) =>
                  ed.sourceId === source.id &&
                  ed.sourcePort === highlightPort &&
                  ed.targetId === target.id,
              )
              if (!duplicateEdge) {
                markOutput(source.id, highlightPort)
                const outputType = sourceNode.outputTypes[highlightPort]
                const fields = typeFields[outputType]
                const canTransform =
                  !targetInputType ||
                  outputType === targetInputType ||
                  fields.some((field) => field.type === targetInputType)
                if (canTransform) {
                  markInput(targetNode.id)
                  connectionHighlighted = true
                }
              }
            }
          }
        }
      }
      if (!connectionHighlighted && selectedSourceNode) {
        if (selectedSourceNode.outputTypes.length > 0) {
          const clamped = clamp(
            connectSource.port,
            0,
            selectedSourceNode.outputTypes.length - 1,
          )
          markOutput(selectedSourceNode.id, clamped)
        } else {
          markInput(selectedSourceNode.id)
        }
      }
      return highlights
    }

    if (hoveredNodeId != null) {
      const hoveredNode = nodeMapRender.get(hoveredNodeId)
      if (hoveredNode) {
        if (hoveredNode.outputTypes.length > 0) {
          const portIndex = closestOutputPort(hoveredNode, pointerWorld)
          markOutput(hoveredNode.id, portIndex)
        } else {
          markInput(hoveredNode.id)
        }
      }
    }

    return highlights
  }, [
    mode,
    connectSource,
    hover,
    nodeMapRender,
    pointerWorld,
    resolveConnection,
    edges,
  ])
  function edgeGeometry(edge: EdgeData): EdgeGeometry | null {
    const s = nodeMapRender.get(edge.sourceId)
    const t = nodeMapRender.get(edge.targetId)
    if (!s || !t) return null
    const maxPort = Math.max(0, s.outputTypes.length - 1)
    const portIndex = clamp(edge.sourcePort, 0, maxPort)
    const p0 = fixedOutputAnchor(s, portIndex)
    const p2 = fixedInputAnchor(t)
    const c: Point = { x: edge.cx, y: edge.cy }
    const d = `M ${p0.x} ${p0.y} Q ${c.x} ${c.y} ${p2.x} ${p2.y}`
    const tMid = 0.5
    const mid = qPoint(p0, c, p2, tMid)
    const [dirX, dirY] = vecNormalize(p2.x - c.x, p2.y - c.y)
    const arrowLength = 24
    const arrowWidth = 24
    const baseX = p2.x - dirX * arrowLength
    const baseY = p2.y - dirY * arrowLength
    const [perpX, perpY] = vecNormalize(...normal2D(dirX, dirY))
    const halfWidth = arrowWidth / 2
    const leftX = baseX + perpX * halfWidth
    const leftY = baseY + perpY * halfWidth
    const rightX = baseX - perpX * halfWidth
    const rightY = baseY - perpY * halfWidth
    const arrowPath = `M ${p2.x} ${p2.y} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`
    return { d, p0, p2, c, tMid, mid, arrowPath }
  }

  const edgesWithGeometry = useMemo(() => {
    const acc: Array<EdgeWithGeometry> = []
    edges.forEach((edge) => {
      const geometry = edgeGeometry(edge)
      if (!geometry) return
      acc.push({ edge, geometry, gradientId: `edge-gradient-${edge.id}` })
    })
    return acc
  }, [edges, nodeMapRender])

  const activeConfigNode = configDialog
    ? (nodeMapRender.get(configDialog.nodeId) ?? null)
    : null
  const isConfigModalOpen = Boolean(
    configDialog && configDraft && activeConfigNode,
  )

  let configModalContent: React.ReactNode = null
  if (isConfigModalOpen && configDialog && configDraft && activeConfigNode) {
    const title = `Configure ${activeConfigNode.label}`

    if (configDialog.kind === 'ask-llm' || configDialog.kind === 'llm-judge') {
      const draft = configDraft as AskLlmConfig
      const handleProviderChange = (providerId: string) => {
        const versions = PROVIDER_LLMS[providerId] ?? []
        const nextModelId = versions.some(
          (version) => version.id === draft.modelId,
        )
          ? draft.modelId
          : (versions[0]?.id ?? '')
        setConfigDraft({
          ...draft,
          providerId,
          modelId: nextModelId,
        } as NodeConfigMap[NodeKind])
      }
      const handleModelChange = (modelId: string) => {
        setConfigDraft({ ...draft, modelId } as NodeConfigMap[NodeKind])
      }
      const handlePromptChange = (prompt: string) => {
        setConfigDraft({ ...draft, prompt } as NodeConfigMap[NodeKind])
      }
      const providerVersions = draft.providerId
        ? (PROVIDER_LLMS[draft.providerId] ?? [])
        : []
      configModalContent = (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-neutral-200 mb-2">
              LLM Provider
            </h3>
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map((provider) => {
                const isActive = provider.id === draft.providerId
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => handleProviderChange(provider.id)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition ${
                      isActive
                        ? 'border-sky-400 bg-sky-500/15 text-sky-200'
                        : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-500'
                    }`}
                  >
                    {provider.name}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label
              className="block text-sm font-medium text-neutral-300 mb-1"
              htmlFor="config-model"
            >
              Model version
            </label>
            <select
              id="config-model"
              value={draft.modelId}
              onChange={(event) => handleModelChange(event.target.value)}
              className="block w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              {providerVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="block text-sm font-medium text-neutral-300 mb-1"
              htmlFor="config-prompt"
            >
              Prompt
            </label>
            <textarea
              id="config-prompt"
              value={draft.prompt}
              onChange={(event) => handlePromptChange(event.target.value)}
              rows={5}
              placeholder="Describe how the model should respond..."
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            />
            <p className="mt-2 text-xs text-neutral-500">
              This prompt is stored per node.
            </p>
          </div>
        </div>
      )
    } else if (configDialog.kind === 'ask-user') {
      const draft = configDraft as AskUserConfig
      const handleSlackChange = (value: string) => {
        setConfigDraft({
          ...draft,
          slackChannel: value,
        } as NodeConfigMap[NodeKind])
      }
      configModalContent = (
        <div className="space-y-4">
          <div className="group w-full">
            <div className="flex items-center justify-center gap-5 py-4">
              <div className="relative">
                <span className="absolute -inset-3 -z-10 rounded-2xl bg-violet-200/30 blur-xl opacity-0 group-hover:opacity-100 transition" />
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-b from-neutral-900 to-neutral-800 shadow-md">
                  <img
                    src="/slack-logo.png"
                    alt="Slack logo"
                    className="h-10 w-10 object-contain"
                  />
                </div>
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <div className="text-lg sm:text-xl font-semibold text-neutral-100 tracking-tight">
                    Slack
                  </div>
                </div>
                <div className="text-sm text-neutral-300 mt-0.5">
                  Send a message to Slack channel.
                </div>
              </div>
            </div>
          </div>
          <TriggerSlackForm
            value={draft.slackChannel}
            onValueChange={handleSlackChange}
          />
        </div>
      )
    } else if (configDialog.kind === 'task') {
      const draft = configDraft as TaskConfig
      const handleTaskChange = (value: string) => {
        setConfigDraft({ ...draft, task: value } as NodeConfigMap[NodeKind])
      }
      const toggleTool = (tool: string) => {
        const nextTools = draft.tools.includes(tool)
          ? draft.tools.filter((item) => item !== tool)
          : [...draft.tools, tool]
        setConfigDraft({
          ...draft,
          tools: nextTools,
        } as NodeConfigMap[NodeKind])
      }
      configModalContent = (
        <div className="space-y-5">
          <div>
            <label
              className="block text-sm font-medium text-neutral-300 mb-1"
              htmlFor="config-task"
            >
              Task instructions
            </label>
            <textarea
              id="config-task"
              value={draft.task}
              onChange={(event) => handleTaskChange(event.target.value)}
              rows={5}
              placeholder="Describe what should be done..."
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            />
            <p className="mt-2 text-xs text-neutral-500">
              {'Use the ${input} to use the input text of the node'}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-200 mb-2">
              Tools
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {TOOL_OPTIONS.map((tool) => {
                const checked = draft.tools.includes(tool)
                return (
                  <label
                    key={tool}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                      checked
                        ? 'border-sky-400 bg-sky-500/10 text-sky-100'
                        : 'border-neutral-700 bg-neutral-900 text-neutral-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-sky-500"
                      checked={true}
                      disabled={true}
                      onChange={() => toggleTool(tool)}
                    />
                    <span>{tool}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>
      )
    }

    if (
      configDialog.kind === 'ask-llm' ||
      configDialog.kind === 'ask-user' ||
      configDialog.kind === 'task' ||
      configDialog.kind === 'llm-judge'
    ) {
      const formContent = configModalContent
      configModalContent = (
        <div className="w-[520px] max-w-full rounded-3xl border border-neutral-800/80 bg-neutral-950/95 p-8 shadow-[0_45px_140px_rgba(15,23,42,0.92)]">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
            <p className="text-xs text-neutral-400">
              Stored as part of this node's configuration.
            </p>
          </div>
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <div className="py-2">{formContent}</div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeConfigDialog}
              className="rounded-full border border-neutral-700 bg-neutral-900 px-4 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfigSave}
              className="rounded-full border border-sky-500 bg-sky-600/80 px-4 py-1.5 text-sm font-semibold text-white shadow hover:bg-sky-600"
            >
              Save
            </button>
          </div>
        </div>
      )
    }
  }

  const lightBlue = '#38bdf8'
  const selectedBlue = '#0ea5e9'
  const baseStroke = '#94a3b8'
  const outputColor = '#FF3B70'
  const inputColor = '#B191FF'
  const nodeFill = '#1e293b'
  const nodeText = '#e2e8f0'

  const { scale, panX, panY } = view
  const humanMode =
    mode === 'connect'
      ? 'Connect'
      : mode === 'add-node' && currentTemplate
        ? `Add ${currentTemplate.label}`
        : mode === 'add-node'
          ? 'Add node'
          : 'Select/Move'

  return (
    <div className="w-full h-[100vh] bg-neutral-950 flex flex-col text-neutral-100">
      <div className="flex-1 relative">
        <div className="absolute top-6 left-6 z-30">
          <div className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/90 px-3 py-2 shadow-lg backdrop-blur">
            <ModeButton
              name="Connect"
              value="connect"
              hotkey="C"
              current={mode}
              onSelect={activateConnectMode}
            />
          </div>
        </div>

        <div className="absolute top-6 right-6 z-30">
          <div className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/90 px-3 py-2 shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={handleViewCode}
              className="px-3 py-1.5 rounded-xl border text-xs font-medium transition bg-neutral-800 text-neutral-200 border-neutral-700 hover:border-neutral-500"
              title="View code"
            >
              View code
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 rounded-xl border text-xs font-medium transition bg-sky-600/80 text-white border-sky-500"
              title="Save"
            >
              Save
            </button>
          </div>
        </div>

        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30">
          <div className="flex items-center gap-2 rounded-3xl border border-neutral-800 bg-neutral-900/95 px-4 py-2 shadow-xl backdrop-blur">
            {paletteTemplates.map((template) => (
              <PaletteButton
                key={template.id}
                template={template}
                active={
                  mode === 'add-node' && pendingTemplateId === template.id
                }
                onSelect={activateTemplate}
              />
            ))}
          </div>
          {mode !== 'select' ? (
            <div className="mt-2 text-[12px] text-neutral-400 text-center">
              Press Esc to stop action.
            </div>
          ) : null}
        </div>

        <svg
          ref={svgRef}
          className="w-full h-full"
          onWheel={onWheel}
          onPointerDown={onSVGPointerDown}
          onPointerEnter={onSVGPointerEnter}
          onPointerMove={onSVGPointerMove}
          onPointerUp={onSVGPointerUp}
          onPointerLeave={onSVGPointerLeave}
          onClick={onSVGClick}
          style={{
            touchAction: 'none',
            userSelect: 'none',
            cursor: spacePressed
              ? dragRef.current.type === 'pan'
                ? 'grabbing'
                : 'grab'
              : undefined,
          }}
        >
          <defs>
            <pattern
              id="grid"
              width={GRID}
              height={GRID}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${GRID} 0 L 0 0 0 ${GRID}`}
                fill="none"
                stroke="#1f2937"
                strokeWidth="1"
              />
            </pattern>
            {edgesWithGeometry.map(({ gradientId, geometry }) => (
              <linearGradient
                key={gradientId}
                id={gradientId}
                x1={geometry.p0.x}
                y1={geometry.p0.y}
                x2={geometry.p2.x}
                y2={geometry.p2.y}
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor={outputColor} />
                <stop offset="100%" stopColor={inputColor} />
              </linearGradient>
            ))}
          </defs>

          <g transform={`translate(${panX} ${panY}) scale(${scale})`}>
            <rect
              x={-BG_EXTENT}
              y={-BG_EXTENT}
              width={BG_EXTENT * 2}
              height={BG_EXTENT * 2}
              fill="url(#grid)"
            />

            {edgesWithGeometry.map(({ edge, geometry: g, gradientId }) => {
              const isSelected =
                selection.type === 'edge' && selection.id === edge.id
              const isHovered = hover.type === 'edge' && hover.id === edge.id
              const gradientStroke = `url(#${gradientId})`
              const highlightStroke = isSelected ? selectedBlue : lightBlue
              const highlightOpacity = isSelected ? 0.55 : 0.35
              const fieldLabel = edge.fieldName
                ? `transformed { ${edge.fieldName} }`
                : null
              const fieldLabelWidth = fieldLabel
                ? Math.max(100, fieldLabel.length * 6.1 + 64)
                : 0
              const fieldLabelHeight = 32
              const fieldLabelOffset = 28
              const fieldAnchorX = fieldLabel ? g.mid.x : 0
              const fieldAnchorY = fieldLabel ? g.mid.y - fieldLabelOffset : 0
              return (
                <g key={edge.id}>
                  <path
                    d={g.d}
                    stroke="transparent"
                    strokeWidth={24}
                    fill="none"
                    style={{
                      pointerEvents: 'stroke',
                      cursor: !isSelected
                        ? isHovered
                          ? 'pointer'
                          : 'default'
                        : 'default',
                    }}
                    onClick={(e) => onEdgeClick(e, edge.id)}
                    onPointerEnter={() => onEdgeEnter(edge.id)}
                    onPointerLeave={onEdgeLeave}
                  />
                  <path
                    d={g.d}
                    stroke={gradientStroke}
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    style={{ pointerEvents: 'none' }}
                  />
                  {(isHovered || isSelected) && (
                    <path
                      d={g.d}
                      stroke={highlightStroke}
                      strokeWidth={4}
                      fill="none"
                      strokeOpacity={highlightOpacity}
                      strokeLinecap="round"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                  {fieldLabel ? (
                    <g
                      transform={`translate(${fieldAnchorX} ${fieldAnchorY})`}
                      style={{ pointerEvents: 'none' }}
                    >
                      <rect
                        x={-fieldLabelWidth / 2}
                        y={-fieldLabelHeight / 2}
                        width={fieldLabelWidth}
                        height={fieldLabelHeight}
                        rx={6}
                        ry={6}
                        fill="#0f172a"
                        fillOpacity={0.85}
                        stroke={isSelected ? selectedBlue : nodeFill}
                        strokeWidth={isSelected ? 1 : 0.8}
                      />
                      <text
                        x={0}
                        y={0}
                        dominantBaseline="middle"
                        textAnchor="middle"
                        fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI"
                        fontSize={18}
                        fill={isSelected ? selectedBlue : '#cbd5f5'}
                        fillOpacity={isSelected ? 0.95 : 0.8}
                      >
                        <tspan fill={inputColor}>transformed</tspan>
                        <tspan> </tspan>
                        <tspan fill={inputColor}>{'{'} </tspan>
                        <tspan>{edge.fieldName}</tspan>
                        <tspan fill={inputColor}>{' }'}</tspan>
                      </text>
                    </g>
                  ) : null}
                  <path
                    d={g.arrowPath}
                    fill={gradientStroke}
                    stroke={nodeFill}
                    strokeWidth={0.8}
                    style={{ pointerEvents: 'none' }}
                  />
                  {(isHovered || isSelected) && (
                    <path
                      d={g.arrowPath}
                      fill={highlightStroke}
                      fillOpacity={highlightOpacity}
                      stroke="none"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                  <circle
                    cx={g.p0.x}
                    cy={g.p0.y}
                    r={4.5}
                    fill={outputColor}
                    stroke={nodeFill}
                    strokeWidth={1.5}
                    style={{ pointerEvents: 'none' }}
                  />
                  <circle
                    cx={g.p2.x}
                    cy={g.p2.y}
                    r={4.5}
                    fill={inputColor}
                    stroke={nodeFill}
                    strokeWidth={1.5}
                    style={{ pointerEvents: 'none' }}
                  />
                  {isSelected && (
                    <g
                      style={{ cursor: 'grab' }}
                      onPointerDown={(e) =>
                        onEdgeHandlePointerDown(e, edge.id, 0.5)
                      }
                    >
                      <circle
                        cx={g.mid.x}
                        cy={g.mid.y}
                        r={14}
                        fill={nodeFill}
                        stroke={gradientStroke}
                        strokeWidth={2}
                      />
                    </g>
                  )}
                </g>
              )
            })}

            {connectPreviewPath ? (
              <path
                d={connectPreviewPath.d}
                stroke={selectedBlue}
                strokeWidth={2}
                fill="none"
                strokeDasharray="6 6"
                style={{ pointerEvents: 'none' }}
              />
            ) : null}

            {nodePreview && mode === 'add-node' && currentTemplate ? (
              <g style={{ pointerEvents: 'none' }}>
                <rect
                  x={nodePreview.x}
                  y={nodePreview.y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={16}
                  ry={16}
                  fill={nodeFill}
                  fillOpacity={0.4}
                  stroke={selectedBlue}
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                />
                <text
                  x={nodePreview.x + NODE_WIDTH / 2}
                  y={nodePreview.y + NODE_HEIGHT / 2 + 4}
                  textAnchor="middle"
                  fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI"
                  fontSize={16}
                  fill="#bae6fd"
                  fillOpacity={0.7}
                >
                  {currentTemplate.label}
                </text>
              </g>
            ) : null}

            {nodes.map((n) => {
              const isSelected =
                selection.type === 'node' && selection.id === n.id
              const isHovered = hover.type === 'node' && hover.id === n.id
              const stroke = isSelected
                ? selectedBlue
                : isHovered
                  ? lightBlue
                  : baseStroke
              const isPredefinedNode = n.kind === 'start' || n.kind === 'finish'
              const canEditLabel = !isPredefinedNode
              const isEditingLabel = canEditLabel && editingLabelId === n.id
              const displayLabel = n.label
              const desiredCursor =
                mode === 'connect'
                  ? 'crosshair'
                  : !isSelected && isHovered
                    ? 'pointer'
                    : 'grab'
              const inputAnchor = fixedInputAnchor(n)
              const connectorHighlight = connectorHighlights.get(n.id)
              const highlightInput = Boolean(connectorHighlight?.input)
              const highlightedOutputs = connectorHighlight?.outputs
              const outputPoints = outputAnchors(n)
              const outputDescriptions = nodeOutputDescriptions[n.kind]
              const showFieldDropdown = Boolean(
                fieldSelection && fieldSelection.targetId === n.id,
              )
              const dropdownOptions = showFieldDropdown
                ? fieldSelection!.options
                : []
              const dropdownWidth = 176
              const optionHeight = 20
              const optionGap = 4
              const paddingX = 12
              const paddingY = 8
              const dropdownContentHeight = dropdownOptions.length
                ? dropdownOptions.length * optionHeight +
                  (dropdownOptions.length - 1) * optionGap
                : 0
              const dropdownHeight = dropdownContentHeight + paddingY * 2
              const dropdownX = inputAnchor.x - dropdownWidth - 18
              const dropdownY = inputAnchor.y - dropdownHeight / 2
              const canConfigure =
                n.kind !== 'start' &&
                n.kind !== 'finish' &&
                n.kind !== 'tool-call'
              const configureButtonWidth = 96
              const configureButtonHeight = 22
              const configureButtonX =
                n.x + n.width / 2 - configureButtonWidth / 2
              const configureButtonY = n.y + n.height + 8
              const metaLines = getNodeMetaLines(n)
              const metaWidth = Math.max(120, n.width - 32)
              const metaHeight = Math.min(
                n.height - 24,
                Math.max(48, n.height - 60),
              )
              const metaX = n.x + (n.width - metaWidth) / 2
              const metaY = n.y + (n.height - metaHeight) / 2
              return (
                <g
                  key={n.id}
                  onPointerDown={(e) => onNodePointerDown(e, n.id)}
                  onClick={(e) => onNodeClick(e, n.id)}
                  onPointerEnter={() => onNodeEnter(n.id)}
                  onPointerLeave={onNodeLeave}
                  style={{
                    cursor: spacePressed
                      ? dragRef.current.type === 'pan'
                        ? 'grabbing'
                        : 'grab'
                      : desiredCursor,
                  }}
                >
                  {canEditLabel ? (
                    isEditingLabel ? (
                      <foreignObject
                        x={n.x}
                        y={n.y - 28}
                        width={n.width}
                        height={24}
                        style={{ overflow: 'visible' }}
                      >
                        <input
                          ref={editingInputRef}
                          value={editingLabelValue}
                          onChange={(e) =>
                            setEditingLabelValue(
                              e.target.value.replace(/\n/g, ''),
                            )
                          }
                          onBlur={() => commitLabelEdit()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              commitLabelEdit()
                            } else if (e.key === 'Escape') {
                              e.preventDefault()
                              commitLabelEdit(false)
                            }
                          }}
                          className="w-full text-center text-[11px] font-medium rounded-full bg-neutral-800 text-neutral-200 border border-neutral-700 px-2 py-1 outline-none focus:ring-1 focus:ring-sky-500"
                          style={{ lineHeight: '1.2', height: '20px' }}
                        />
                      </foreignObject>
                    ) : (
                      <text
                        x={n.x + n.width / 2}
                        y={n.y - 8}
                        textAnchor="middle"
                        fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI"
                        fontSize={20}
                        fill="#94a3b8"
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          startEditingLabel(n.id)
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{
                          userSelect: mode === 'select' ? 'none' : 'auto',
                          cursor: mode === 'select' ? 'text' : 'default',
                        }}
                      >
                        {displayLabel}
                      </text>
                    )
                  ) : null}
                  <rect
                    x={n.x}
                    y={n.y}
                    width={n.width}
                    height={n.height}
                    rx={16}
                    ry={16}
                    fill={nodeFill}
                    stroke={stroke}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                  {metaLines ? (
                    <foreignObject
                      x={metaX}
                      y={metaY}
                      width={metaWidth}
                      height={metaHeight}
                      style={{ overflow: 'visible', pointerEvents: 'none' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          height: '100%',
                          width: '100%',
                          pointerEvents: 'none',
                        }}
                      >
                        <div
                          style={{
                            border: '1px solid rgba(148, 163, 184, 0.35)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            margin: '8px',
                            fontSize: '14px',
                            lineHeight: '1.35',
                            color: '#e2e8f0',
                            backgroundColor: 'rgba(15, 23, 42, 0.45)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            gap: '4px',
                            minWidth: 0,
                          }}
                        >
                          {metaLines.map((line, idx) => (
                            <span
                              key={`${n.id}-meta-${idx}`}
                              style={{
                                overflow: 'hidden',
                                pointerEvents: 'none',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {line}
                            </span>
                          ))}
                        </div>
                      </div>
                    </foreignObject>
                  ) : null}
                  {isPredefinedNode ? (
                    <text
                      x={n.x + n.width / 2}
                      y={n.y + n.height / 2 + 4}
                      textAnchor="middle"
                      fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI"
                      fontSize={32}
                      fill={nodeText}
                    >
                      {displayLabel}
                    </text>
                  ) : null}
                  <g style={{ pointerEvents: 'none' }}>
                    {n.kind !== 'start' && (
                      <>
                        <circle
                          cx={inputAnchor.x}
                          cy={inputAnchor.y}
                          r={7}
                          fill={inputColor}
                          stroke={highlightInput ? selectedBlue : nodeFill}
                          strokeWidth={highlightInput ? 2.2 : 1.5}
                        />
                        {highlightInput ? (
                          <circle
                            cx={inputAnchor.x}
                            cy={inputAnchor.y}
                            r={8}
                            fill="none"
                            stroke={selectedBlue}
                            strokeWidth={1.2}
                            strokeOpacity={0.6}
                          />
                        ) : null}
                        {n.inputType ? (
                          <g
                            transform={`translate(${inputAnchor.x - 72} ${inputAnchor.y - 24})`}
                          >
                            <rect
                              x={-8}
                              y={-6}
                              width={72}
                              height={24}
                              rx={6}
                              ry={6}
                              fill="#0f172a"
                              fillOpacity={0.85}
                              stroke={highlightInput ? selectedBlue : nodeFill}
                              strokeWidth={0.8}
                            />
                            <text
                              x={28}
                              y={12}
                              textAnchor="middle"
                              fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI"
                              fontSize={16}
                              fill={highlightInput ? selectedBlue : '#cbd5f5'}
                              fillOpacity={highlightInput ? 0.95 : 0.75}
                            >
                              {n.inputType}
                            </text>
                          </g>
                        ) : null}
                      </>
                    )}
                    {outputPoints.map((anchor, index) => {
                      const isHighlighted = Boolean(
                        highlightedOutputs?.has(index),
                      )
                      const typeLabel = n.outputTypes[index]
                      const outputLabel = outputDescriptions[index]
                      const arrowColor = isHighlighted
                        ? selectedBlue
                        : outputColor
                      const arrowTipX = anchor.x - 6
                      const arrowHeadBaseX = arrowTipX - 5
                      const arrowTailX = arrowHeadBaseX - 12
                      const arrowTextX = arrowTailX - 4
                      return (
                        <g key={`output-${n.id}-${index}`}>
                          {outputLabel ? (
                            <>
                              <text
                                x={arrowTextX}
                                y={anchor.y}
                                textAnchor="end"
                                dominantBaseline="middle"
                                fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI"
                                fontSize={13}
                                fontWeight={500}
                                fill={outputColor}
                                fillOpacity={isHighlighted ? 0.95 : 0.85}
                              >
                                {outputLabel}
                              </text>
                              <line
                                x1={arrowTailX}
                                y1={anchor.y}
                                x2={arrowHeadBaseX}
                                y2={anchor.y}
                                stroke={arrowColor}
                                strokeWidth={1.4}
                                strokeLinecap="round"
                              />
                              <path
                                d={`M ${arrowTipX} ${anchor.y} L ${arrowHeadBaseX} ${anchor.y - 3} L ${arrowHeadBaseX} ${anchor.y + 3} Z`}
                                fill={arrowColor}
                                fillOpacity={isHighlighted ? 0.95 : 0.85}
                              />
                            </>
                          ) : null}
                          <circle
                            cx={anchor.x}
                            cy={anchor.y}
                            r={7}
                            fill={outputColor}
                            stroke={isHighlighted ? selectedBlue : nodeFill}
                            strokeWidth={isHighlighted ? 2.2 : 1.5}
                          />
                          {isHighlighted ? (
                            <circle
                              cx={anchor.x}
                              cy={anchor.y}
                              r={8}
                              fill="none"
                              stroke={selectedBlue}
                              strokeWidth={1.2}
                              strokeOpacity={0.6}
                            />
                          ) : null}
                          <g
                            transform={`translate(${anchor.x + 32} ${anchor.y - 24})`}
                          >
                            <rect
                              x={-24}
                              y={-6}
                              width={104}
                              height={24}
                              rx={6}
                              ry={6}
                              fill="#0f172a"
                              fillOpacity={0.85}
                              stroke={isHighlighted ? selectedBlue : nodeFill}
                              strokeWidth={0.8}
                            />
                            <text
                              x={28}
                              y={11}
                              textAnchor="middle"
                              fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI"
                              fontSize={16}
                              fill={isHighlighted ? selectedBlue : '#cbd5f5'}
                              fillOpacity={isHighlighted ? 0.95 : 0.75}
                            >
                              {typeLabel}
                            </text>
                          </g>
                        </g>
                      )
                    })}
                  </g>
                  {canConfigure ? (
                    <foreignObject
                      x={configureButtonX}
                      y={configureButtonY}
                      width={configureButtonWidth}
                      height={configureButtonHeight}
                      style={{ overflow: 'visible' }}
                    >
                      <button
                        type="button"
                        onClick={(evt) => {
                          evt.stopPropagation()
                          openConfigDialog(n)
                        }}
                        className="w-full text-[11px] font-medium rounded-full border border-sky-500/50 bg-neutral-900/90 text-sky-200 px-3 py-1 shadow-sm hover:bg-sky-950/40 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                      >
                        Configure
                      </button>
                    </foreignObject>
                  ) : null}
                  {showFieldDropdown && dropdownOptions.length ? (
                    <g
                      transform={`translate(${dropdownX} ${dropdownY})`}
                      style={{ pointerEvents: 'auto' }}
                      onPointerDown={(evt) => evt.stopPropagation()}
                      onPointerUp={(evt) => evt.stopPropagation()}
                    >
                      <rect
                        x={0}
                        y={0}
                        width={dropdownWidth}
                        height={dropdownHeight}
                        rx={12}
                        ry={12}
                        fill="#0f172a"
                        fillOpacity={0.92}
                        stroke={selectedBlue}
                        strokeWidth={1}
                      />
                      {dropdownOptions.map((option, index) => {
                        const optionY =
                          paddingY + index * (optionHeight + optionGap)
                        const optionHovered = fieldOptionHover === option.name
                        return (
                          <g
                            key={option.name}
                            transform={`translate(0 ${optionY})`}
                            onPointerEnter={() =>
                              setFieldOptionHover(option.name)
                            }
                            onPointerLeave={() => {
                              setFieldOptionHover((current) =>
                                current === option.name ? null : current,
                              )
                            }}
                            onPointerDown={(evt) => {
                              evt.stopPropagation()
                              evt.preventDefault()
                              fulfillFieldSelection(option)
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <rect
                              x={paddingX - 6}
                              y={-2}
                              width={dropdownWidth - (paddingX - 6) * 2}
                              height={optionHeight + 4}
                              rx={6}
                              ry={6}
                              fill={optionHovered ? '#172133' : 'transparent'}
                              stroke={
                                optionHovered ? selectedBlue : 'transparent'
                              }
                              strokeWidth={optionHovered ? 0.8 : 0}
                            />
                            <text
                              x={paddingX}
                              y={optionHeight / 2 + 4}
                              textAnchor="start"
                              fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI"
                              fontSize={18}
                              fill="#e2e8f0"
                            >
                              {`${option.name}: ${option.type}`}
                            </text>
                            {index < dropdownOptions.length - 1 ? (
                              <line
                                x1={1}
                                x2={dropdownWidth - 1}
                                y1={optionHeight + optionGap / 2 + 1}
                                y2={optionHeight + optionGap / 2 + 1}
                                stroke="#344a70"
                                strokeWidth={1}
                              />
                            ) : null}
                          </g>
                        )
                      })}
                    </g>
                  ) : null}
                </g>
              )
            })}
          </g>
        </svg>

        {isConfigModalOpen ? (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/70"
            onClick={closeConfigDialog}
          >
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              {configModalContent}
            </div>
          </div>
        ) : null}

        <div className="absolute bottom-2 left-2 text-[11px] bg-neutral-900/80 backdrop-blur px-2 py-1 rounded-md border border-neutral-700 text-neutral-300">
          Mode: <span className="font-semibold">{humanMode}</span>
          {mode === 'connect' && connectSource ? (
            <span className="ml-2">(pick a target)</span>
          ) : null}
        </div>
        <div className="absolute bottom-2 right-2 text-[11px] bg-neutral-900/80 backdrop-blur px-2 py-1 rounded-md border border-neutral-700 text-neutral-200">
          {Math.round(scale * 100)}%
        </div>
      </div>

      <CodeViewModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        code={codeContent}
      />
    </div>
  )
}
