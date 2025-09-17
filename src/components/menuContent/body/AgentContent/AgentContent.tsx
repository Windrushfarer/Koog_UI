import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'

type StrategyOption = {
  id: 'default' | 'custom'
  title: string
  description: string
  actionLabel: string
}

export default function AgentContent() {
  const search = useSearch({ from: '/' })
  const navigate = useNavigate()
  const [selected, setSelected] = useState<'default' | 'custom'>(
    search.agentStrategy === 'custom' ? 'custom' : 'default',
  )

  useEffect(() => {
    setSelected(search.agentStrategy === 'custom' ? 'custom' : 'default')
  }, [search.agentStrategy])

  const options = useMemo<Array<StrategyOption>>(
    () => [
      {
        id: 'default',
        title: 'Default strategy',
        description:
          "Use Koog's recommended agent behavior with automatic tooling.",
        actionLabel: 'Use default',
      },
      {
        id: 'custom',
        title: 'Custom strategy',
        description:
          'Jump into the canvas to orchestrate a fully bespoke agent flow.',
        actionLabel: 'Open canvas',
      },
    ],
    [],
  )

  return (
    <section className='h-screen'>
      <h2 className="mb-2 text-xl font-semibold text-neutral-100">Agent</h2>
      <p className="mb-4 text-neutral-300">
        Define agent behavior, tools, and capabilities.
      </p>

      <div
        className="flex flex-col gap-3"
        role="radiogroup"
        aria-label="Agent strategy"
      >
        {options.map((option) => {
          const isActive = selected === option.id
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => {
                setSelected(option.id)

                if (option.id === 'custom') {
                  void navigate({ to: '/canvas' })
                  return
                }

                void navigate({
                  to: '/',
                  search: { tab: 'agent', agentStrategy: undefined },
                })
              }}
              className={`group w-full rounded-xl border-2 px-5 py-4 text-left transition ${
                isActive
                  ? 'border-blue-400 bg-blue-500/10 shadow-[0_0_0_1px_rgba(96,165,250,0.35)]'
                  : 'border-neutral-700 bg-neutral-800 hover:border-neutral-500 hover:bg-neutral-700/40'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <span
                    className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${
                      isActive
                        ? 'border-blue-400 bg-blue-500/20'
                        : 'border-neutral-600 bg-neutral-900'
                    }`}
                    aria-hidden
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full transition ${
                        isActive ? 'bg-blue-300' : 'bg-transparent'
                      }`}
                    />
                  </span>

                  <div>
                    <p className="text-base font-semibold text-neutral-100">
                      {option.title}
                    </p>
                    <p className="mt-1 text-sm text-neutral-300">
                      {option.description}
                    </p>
                  </div>
                </div>

                <span
                  className={`mt-1 text-sm font-medium transition ${
                    isActive
                      ? 'text-blue-300'
                      : 'text-neutral-400 group-hover:text-neutral-200'
                  }`}
                >
                  {option.actionLabel}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
