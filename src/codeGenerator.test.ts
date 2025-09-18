import { describe, expect, it } from 'vitest'

import { generateCodeFromGraph } from './codeGenerator'
import type { CanvasGraphSnapshot } from '@/context/FormContext.tsx'

describe('generateCodeFromGraph', () => {
  const baseTaskNode = {
    id: 'task-1',
    kind: 'task' as const,
    label: 'Task',
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    inputType: 'String',
    outputTypes: ['String'],
  }

  const baseJudgeNode = {
    id: 'judge-1',
    kind: 'llm-judge' as const,
    label: 'Judge',
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    inputType: 'String',
    outputTypes: ['String'],
  }

  it('generates Kotlin snippet for task node with PascalCase name', () => {
    const snapshot: CanvasGraphSnapshot = {
      nodes: [
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        {
          ...baseTaskNode,
          config: {
            name: 'Prepare Trip',
            task: 'Prepare me a trip for the team',
            tools: [],
          },
        },
      ],
      edges: [],
    }

    const result = generateCodeFromGraph(snapshot)

    expect(result)
      .toBe(`val taskNodePrepareTrip by subgraphWithTask<String, String>(
        toolSelectionStrategy = ToolSelectionStrategy.ALL
    ) { input ->
        """
        Prepare me a trip for the team
        """.trimIndent()
    }`)
  })

  it('falls back to default name when task name is empty', () => {
    const snapshot: CanvasGraphSnapshot = {
      nodes: [
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        {
          ...baseTaskNode,
          config: {
            name: '   ',
            task: 'Do something great',
            tools: [],
          },
        },
      ],
      edges: [],
    }

    const result = generateCodeFromGraph(snapshot)

    expect(result).toBe(`val taskNodeTask by subgraphWithTask<String, String>(
        toolSelectionStrategy = ToolSelectionStrategy.ALL
    ) { input ->
        """
        Do something great
        """.trimIndent()
    }`)
  })

  it('generates Kotlin snippet for judge node with PascalCase name', () => {
    const snapshot: CanvasGraphSnapshot = {
      nodes: [
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        {
          ...baseJudgeNode,
          config: {
            name: 'Sentiment Analysis',
            prompt: 'Critique something',
            providerId: 'openai',
            modelId: 'gpt-5',
          },
        },
      ],
      edges: [],
    }

    const result = generateCodeFromGraph(snapshot)

    expect(result).toBe(`val criticSentimentAnalysis by llmAsAJudge(
        llmModel = OpenAIModels.GPT_4_1,
        task = "Critique something"
    )`)
  })

  it('escapes double quotes inside judge prompt and falls back name when empty', () => {
    const snapshot: CanvasGraphSnapshot = {
      nodes: [
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        {
          ...baseJudgeNode,
          config: {
            name: '',
            prompt: 'Explain "why" carefully',
            providerId: 'openai',
            modelId: 'gpt-4',
          },
        },
      ],
      edges: [],
    }

    const result = generateCodeFromGraph(snapshot)

    expect(result).toBe(`val criticJudge by llmAsAJudge(
        llmModel = OpenAIModels.GPT_4_1,
        task = "Explain \\\"why\\\" carefully"
    )`)
  })
})
