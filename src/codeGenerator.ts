import type {
  CanvasGraphNodeSnapshot,
  CanvasGraphSnapshot,
  CanvasTaskConfig,
} from '@/context/FormContext.tsx'

export function generateCodeFromGraph(snapshot: CanvasGraphSnapshot): string {
  const segments: Array<string> = []

  for (const node of snapshot.nodes) {
    if (isTaskNode(node)) {
      segments.push(generateTaskNodeContent(node))
    }
  }

  return segments.join('\n\n')
}

type TaskNodeSnapshot = CanvasGraphNodeSnapshot & {
  kind: 'task'
  config: CanvasTaskConfig
}

export function generateTaskNodeContent(node: TaskNodeSnapshot): string {
  const name = toPascalCase(node.config.name)
  const instructions = node.config.task.trim()

  return `val taskNode${name} by subgraphWithTask<String, String>(
        toolSelectionStrategy = ToolSelectionStrategy.ALL
    ) { input ->
        """
        ${instructions}
        """.trimIndent()
    }`
}

function isTaskNode(node: CanvasGraphNodeSnapshot): node is TaskNodeSnapshot {
  return node.kind === 'task'
}

function toPascalCase(value: string): string {
  const parts = value
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  const effectiveParts = parts.length > 0 ? parts : ['Task']

  return effectiveParts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('')
}
