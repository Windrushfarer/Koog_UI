import { useEffect, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'

export default function AgentContent() {
  const search = useSearch({ from: '/' })
  const [selected, setSelected] = useState<'default' | 'custom'>(search.agentStrategy === 'custom' ? 'custom' : 'default')
  const navigate = useNavigate()

  useEffect(() => {
    setSelected(search.agentStrategy === 'custom' ? 'custom' : 'default')
  }, [search.agentStrategy])

  return (
    <section>
      <h2 className="text-xl font-semibold mb-2 text-neutral-100">Agent</h2>
      <p className="text-neutral-300 mb-4">Define agent behavior, tools, and capabilities.</p>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'default' as const, label: 'Default strategy' },
          { id: 'custom' as const, label: 'Custom stategy' }
        ].map((btn) => {
          const isActive = selected === btn.id
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => {
                if (btn.id === 'custom') {
                  void navigate({ to: '/canvas' })
                } else {
                  setSelected(btn.id)
                  void navigate({ to: '/', search: { tab: 'agent', agentStrategy: undefined } })
                }
              }}
              className={`px-3 py-1.5 rounded-full border text-sm transition ${
                isActive
                  ? 'border-blue-400 bg-blue-500/10 text-blue-300'
                  : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700/50'
              }`}
              aria-pressed={isActive}
            >
              {btn.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}


