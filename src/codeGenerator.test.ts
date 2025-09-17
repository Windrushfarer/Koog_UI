import { describe, expect, it } from 'vitest'

import { generateCodeFromGraph } from './codeGenerator'
import type { CanvasGraphSnapshot } from '@/context/FormContext.tsx'

describe('generateCodeFromGraph', () => {
  const baseTaskNode = {
    id: 'node-1',
    kind: 'task' as const,
    label: 'Task',
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    inputType: 'String',
    outputTypes: ['String'],
  }

  it('generates Kotlin snippet for task node with PascalCase name', () => {
    const snapshot: CanvasGraphSnapshot = {
      nodes: [
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

    expect(result).toBe(`val taskNodePrepareTrip by subgraphWithTask<String, String>(
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
})
