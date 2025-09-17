import { useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import TriggerPointContent from '../body/TriggerPointContent/TriggerPointContent'
import SetupContent from '../body/SetupContent/SetupContent'
import AgentContent from '../body/AgentContent/AgentContent'
import OutputContent from '../body/OutputContent/OutputContent'
import { useForm } from '@/context/FormContext.tsx'

type NavigationItem = {
  id: string
  label: string
  href?: string
  children?: Array<NavigationItem>
}

const defaultNavigation: Array<NavigationItem> = [
  { id: 'trigger', label: 'Trigger' },
  { id: 'setup', label: 'Setup' },
  { id: 'agent', label: 'Agent' },
  { id: 'output', label: 'Output' },
]

type MultiNavigationMenuProps = {
  items?: Array<NavigationItem>
  onNextStep?: () => void
  activeId?: string
  onActiveIdChange?: (id: string) => void
}

export default function MultiNavigationMenu({
  items = defaultNavigation,
  onNextStep: _onNextStep,
  activeId: propActiveId,
  onActiveIdChange
}: MultiNavigationMenuProps) {
  const { canProceedToNext } = useForm()
  const navigate = useNavigate()
  const search = useSearch({ from: '/' })
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({})

  const routerActiveId = search.tab || 'trigger'
  const activeId = propActiveId ?? routerActiveId

  const setActiveId = onActiveIdChange ?? ((id: string) => {
    void navigate({ to: '/', search: { tab: id } })
  })

  const canNavigateTo = (targetId: string) => {
    const currentIndex = items.findIndex(item => item.id === activeId)
    const targetIndex = items.findIndex(item => item.id === targetId)

    if (targetIndex <= currentIndex) return true

    for (let i = currentIndex; i < targetIndex; i++) {
      if (!canProceedToNext(items[i].id)) {
        return false
      }
    }
    return true
  }
  function toggle(id: string) {
    setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function renderItems(nodes: Array<NavigationItem>, level: number = 0) {
    const isTopLevel = level === 0
    return (
      <ul className={isTopLevel ? 'flex gap-2' : 'ml-4 mt-2 flex flex-col gap-2'} role={isTopLevel ? 'tablist' : undefined}>
        {nodes.map((node) => {
          const hasChildren = !!node.children?.length
          const isOpen = openMap[node.id]
          const isActive = activeId === node.id
          const canNavigate = canNavigateTo(node.id)
          const baseTabClasses = isTopLevel
            ? `px-3 py-2 border-b-2 ${
                isActive
                  ? 'border-blue-400 text-blue-300'
                  : canNavigate
                    ? 'border-transparent text-neutral-300 hover:text-white hover:border-neutral-600 cursor-pointer'
                    : 'border-transparent text-neutral-500 cursor-not-allowed'
              }`
            : `px-2 py-1 rounded text-left ${
                canNavigate
                  ? 'hover:bg-neutral-800 text-neutral-300 cursor-pointer'
                  : 'text-neutral-500 cursor-not-allowed'
              }`

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
                      if (!hasChildren && canNavigate) setActiveId(node.id)
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
                      } else if (canNavigate) {
                        setActiveId(node.id)
                      }
                    }}
                    disabled={!canNavigate && !hasChildren}
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
    <div className="w-full h-full">
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
          {activeId === 'output' && <OutputContent />}
        </div>
      </div>
    </div>
  )
}


