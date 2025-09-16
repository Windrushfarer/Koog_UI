import { useState } from 'react'
import Input from '../../../ui/Input'

export default function TriggerGitHubForm() {
  const [filters, setFilters] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // eslint-disable-next-line no-console
    console.log('GitHub create trigger', { filters })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-neutral-900/95 border p-5 backdrop-blur-xl">
      <div>
        <Input
          placeholder="Enter repository"
          value={filters}
          onChange={(e) => setFilters(e.target.value)}
        />
      </div>
    </form>
  )
}


