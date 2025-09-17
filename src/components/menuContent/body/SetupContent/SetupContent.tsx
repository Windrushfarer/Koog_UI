import { useEffect } from 'react'
import { PROVIDERS, PROVIDER_VERSIONS } from './SetupContent.consts'
import Tools from './Tools'
import type { Provider } from './SetupContent.consts'
import { useForm } from '@/context/FormContext.tsx'

export default function SetupContent() {
  const { state, dispatch } = useForm()
  const { selectedProviderId, selectedVersionId, systemPrompt } = state.setup
  const providers: Array<Provider> = PROVIDERS
  const providerVersions = PROVIDER_VERSIONS
  const selectedProviderVersions = selectedProviderId
    ? (providerVersions[selectedProviderId] ?? [])
    : []

  useEffect(() => {
    if (!selectedProviderId && providers.length > 0) {
      const firstProvider = providers[0]
      const versions = providerVersions[firstProvider.id]
      if (versions.length > 0) {
        const firstVersion = versions[0]
        dispatch({
          type: 'SET_SETUP',
          payload: {
            selectedProviderId: firstProvider.id,
            selectedVersionId: firstVersion.id,
          },
        })
      }
    }
  }, [selectedProviderId, providers, providerVersions, dispatch])

  return (
    <section>
      <h2 className="text-xl font-semibold mb-2 text-neutral-100">Setup</h2>
      <p className="text-neutral-300 mb-4">
        Provide required settings, credentials, and parameters.
      </p>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2 text-neutral-100">
          LLM Provider
        </h3>
        <div className="flex flex-wrap gap-2">
          {providers.map((p) => {
            const isActive = p.id === selectedProviderId
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  const versions = providerVersions[p.id]
                  if (versions.length > 0) {
                    const firstVersion = versions[0].id
                    dispatch({
                      type: 'SET_SETUP',
                      payload: {
                        selectedProviderId: p.id,
                        selectedVersionId: firstVersion,
                      },
                    })
                  }
                }}
                className={`px-3 py-1.5 rounded-full border text-sm transition ${
                  isActive
                    ? 'border-blue-400 bg-blue-500/10 text-blue-300'
                    : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700/50'
                }`}
                aria-pressed={isActive}
              >
                {p.name}
              </button>
            )
          })}
        </div>

        <div className="mt-6 max-w-xl">
          <label
            htmlFor="modelVersion"
            className="block text-sm font-medium text-neutral-300 mb-1"
          >
            Model version
          </label>
          <select
            id="modelVersion"
            className="block w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            value={selectedVersionId}
            onChange={(e) => {
              dispatch({
                type: 'SET_SETUP',
                payload: {
                  selectedProviderId,
                  selectedVersionId: e.target.value,
                },
              })
            }}
          >
            {selectedProviderVersions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-sm text-neutral-400">
            Selected: {selectedProviderId} / {selectedVersionId}
          </p>
        </div>

        <div className="mt-6 max-w-xl">
          <label
            htmlFor="taskPrompt"
            className="text-lg font-semibold mb-2 text-neutral-100"
          >
            System prompt
          </label>
          <textarea
            id="taskPrompt"
            placeholder=""
            className="block w-full min-h-[120px] rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-y"
            value={systemPrompt}
            onChange={(e) => dispatch({ type: 'SET_SYSTEM_PROMPT', payload: { systemPrompt: e.target.value } })}
          />
          <p className="mt-2 text-sm text-neutral-400">
            {systemPrompt ? `${systemPrompt.length} characters` : 'Describe the task for the agent.'}
          </p>
        </div>
      </div>
      <div className="mt-8">
        <Tools />
      </div>
    </section>
  )
}
