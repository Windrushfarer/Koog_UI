import { useState } from 'react'
import TriggerPointContent from '../body/TriggerPointContent/TriggerPointContent'
import SetupContent from '../body/SetupContent/SetupContent'
import AgentContent from '../body/AgentContent/AgentContent'

type NavigationItem = {
  id: string
  label: string
  href?: string
  children?: NavigationItem[]
}

const defaultNavigation: NavigationItem[] = [
  { id: 'trigger', label: 'Trigger' },
  { id: 'setup', label: 'Setup' },
  { id: 'agent', label: 'Agent' },
  { id: 'output', label: 'Output' },
]

type MultiNavigationMenuProps = {
  items?: NavigationItem[]
}

export default function MultiNavigationMenu({ items = defaultNavigation }: MultiNavigationMenuProps) {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({})
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? 'trigger')

  function toggle(id: string) {
    setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function renderItems(nodes: NavigationItem[], level: number = 0) {
    const isTopLevel = level === 0
    return (
      <ul className={isTopLevel ? 'flex gap-2' : 'ml-4 mt-2 flex flex-col gap-2'} role={isTopLevel ? 'tablist' : undefined}>
        {nodes.map((node) => {
          const hasChildren = !!node.children?.length
          const isOpen = !!openMap[node.id]
          const isActive = activeId === node.id
          const baseTabClasses = isTopLevel
            ? `px-3 py-2 border-b-2 ${isActive ? 'border-blue-400 text-blue-300' : 'border-transparent text-neutral-300 hover:text-white hover:border-neutral-600'}`
            : 'px-2 py-1 rounded hover:bg-neutral-800 text-left text-neutral-300'

          return (
            <li key={node.id} className="relative">
              <div className="flex items-center gap-2">
                {node.href ? (
                  <a
                    href={node.href}
                    className={baseTabClasses}
                    role={isTopLevel ? 'tab' : undefined}
                    aria-selected={isTopLevel ? isActive : undefined}
                    onClick={() => {
                      if (!hasChildren) setActiveId(node.id)
                    }}
                  >
                    {node.label}
                  </a>
                ) : (
                  <button
                    type="button"
                    className={baseTabClasses + ' font-medium'}
                    onClick={() => {
                      if (hasChildren) {
                        toggle(node.id)
                      } else {
                        setActiveId(node.id)
                      }
                    }}
                    role={isTopLevel ? 'tab' : undefined}
                    aria-selected={isTopLevel ? isActive : undefined}
                    aria-expanded={hasChildren ? isOpen : undefined}
                    aria-controls={hasChildren ? `submenu-${node.id}` : undefined}
                  >
                    {node.label}
                  </button>
                )}
                {hasChildren && (
                  <button
                    type="button"
                    className="text-sm text-gray-600 hover:text-gray-800"
                    onClick={() => toggle(node.id)}
                    aria-label={isOpen ? 'Collapse submenu' : 'Expand submenu'}
                  >
                    {isOpen ? '−' : '+'}
                  </button>
                )}
              </div>
              {hasChildren && isOpen && (
                <div id={`submenu-${node.id}`} className={isTopLevel ? 'absolute left-0 mt-2 bg-white border rounded shadow p-3 z-10' : ''}>
                  {renderItems(node.children!, level + 1)}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-center">
        <nav className="flex">
          {renderItems(items)}
        </nav>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-4 flex justify-center">
        <div className="w-full flex justify-center">
          {activeId === 'trigger' && <TriggerPointContent />}
          {activeId === 'setup' && <SetupContent />}
          {activeId === 'agent' && <AgentContent />}
        </div>
      </div>
    </div>
  )
}


