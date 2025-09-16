import { useState } from 'react'
import { PROVIDERS, PROVIDER_VERSIONS, type Provider } from './SetupContent.consts'

export default function SetupContent() {
  const [filters, setFilters] = useState('')
  const providers: Provider[] = PROVIDERS
  const providerVersions = PROVIDER_VERSIONS
  const [selectedProviderId, setSelectedProviderId] = useState<string>(providers[0].id)
  const [selectedVersionId, setSelectedVersionId] = useState<string>(providerVersions[providers[0].id][0].id)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    // Placeholder submit action
    // eslint-disable-next-line no-console
    console.log('Create with filters:', filters)
  }

  return (
    <section>
      <h2 className="text-xl font-semibold mb-2 text-neutral-100">Setup</h2>
      <p className="text-neutral-300 mb-4">Provide required settings, credentials, and parameters.</p>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2 text-neutral-100">LLM Provider</h3>
        <div className="flex flex-wrap gap-2">
          {providers.map((p) => {
            const isActive = p.id === selectedProviderId
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedProviderId(p.id)
                  const firstVersion = providerVersions[p.id]?.[0]?.id
                  if (firstVersion) setSelectedVersionId(firstVersion)
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
          <label htmlFor="modelVersion" className="block text-sm font-medium text-neutral-300 mb-1">
            Model version
          </label>
          <select
            id="modelVersion"
            className="block w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            value={selectedVersionId}
            onChange={(e) => setSelectedVersionId(e.target.value)}
          >
            {providerVersions[selectedProviderId]?.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <p className="mt-2 text-sm text-neutral-400">Selected: {selectedProviderId} / {selectedVersionId}</p>
        </div>
      </div>
    </section>
  )
}


