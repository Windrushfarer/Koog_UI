import type {
  CanvasAskLlmConfig,
  CanvasGraphNodeSnapshot,
  CanvasGraphSnapshot,
  CanvasTaskConfig,
} from '@/context/FormContext.tsx'

export function generateCodeFromGraph(snapshot: CanvasGraphSnapshot): string {
  const segments: Array<string> = []

  for (const node of snapshot.nodes) {
    if (isTaskNode(node)) {
      segments.push(generateTaskNodeContent(node))
      continue
    }

    if (isJudgeNode(node)) {
      segments.push(generateJudgeNodeContent(node))
    }
  }

  return segments.join('\n\n')
}

type TaskNodeSnapshot = CanvasGraphNodeSnapshot & {
  kind: 'task'
  config: CanvasTaskConfig
}

export function generateTaskNodeContent(node: TaskNodeSnapshot): string {
  const name = toPascalCase(node.config.name, 'Task')
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

type JudgeNodeSnapshot = CanvasGraphNodeSnapshot & {
  kind: 'llm-judge'
  config: CanvasAskLlmConfig
}

export function generateJudgeNodeContent(node: JudgeNodeSnapshot): string {
  const name = toPascalCase(node.config.name, 'Judge')
  const prompt = node.config.prompt.trim()
  const escapedPrompt = prompt.replace(/"/g, '\\"')

  return `val critic${name} by llmAsAJudge(
        llmModel = OpenAIModels.GPT_4_1,
        task = "${escapedPrompt}"
    )`
}

function isJudgeNode(node: CanvasGraphNodeSnapshot): node is JudgeNodeSnapshot {
  return node.kind === 'llm-judge'
}

function toPascalCase(value: string, fallback: string): string {
  const parts = value
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  const effectiveParts = parts.length > 0 ? parts : [fallback]

  return effectiveParts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('')
}
