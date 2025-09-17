import { useState } from 'react'

type Tool = {
  id: string
  name: string
  description: string
}

const DEFAULT_TOOLS: Array<Tool> = [
  { id: 'weather', name: 'Weather', description: 'Get current weather and forecasts for locations.' },
  { id: 'map', name: 'Map', description: 'Lookup places, routes, and coordinates.' },
  { id: 'web-search', name: 'Web Search', description: 'Search the web in real time.' }
]

export default function Tools() {
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DEFAULT_TOOLS.map((t) => [t.id, true]))
  )

  function toggleTool(id: string) {
    setEnabledTools((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <section>
      <div className="max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900/70 backdrop-blur p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]">
        <h3 className="text-lg font-semibold mb-2 text-neutral-100">Tools</h3>
        <p className="text-neutral-300 mb-3">Enable optional tools your agent can use.</p>

        <div className="max-h-64 overflow-y-auto pr-1">
          <ul className="space-y-3">
            {DEFAULT_TOOLS.map((tool) => {
              const isOn = Boolean(enabledTools[tool.id])
              return (
                <li key={tool.id} className="w-full rounded-2xl p-[1px] bg-gradient-to-r from-[#B191FF]/30 via-transparent to-[#B191FF]/30">
                  <div className="flex items-center justify-between gap-4 rounded-2xl bg-neutral-900/95 border border-[#B191FF]/30 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-neutral-100 font-medium truncate">{tool.name}</div>
                      <div className="text-sm text-neutral-400 truncate">{tool.description}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleTool(tool.id)}
                      aria-pressed={isOn}
                      className={`shrink-0 px-3 py-1.5 rounded-full border text-sm transition ${
                        isOn
                          ? 'border-blue-400 bg-blue-500/10 text-blue-300'
                          : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700/50'
                      }`}
                    >
                      {isOn ? 'Enabled' : 'Enable'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}


