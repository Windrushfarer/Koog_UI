import { useState } from 'react'
import Input from '../../../ui/Input'

export default function TriggerSlackForm() {
  const [filters, setFilters] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // eslint-disable-next-line no-console
    console.log('Slack create trigger', { filters })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Filters</label>
        <Input
          placeholder="Enter filters"
          value={filters}
          onChange={(e) => setFilters(e.target.value)}
        />
      </div>
    </form>
  )
}


