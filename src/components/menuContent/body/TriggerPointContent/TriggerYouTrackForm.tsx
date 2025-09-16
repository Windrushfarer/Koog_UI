import { useState } from 'react'
import Input from '../../../ui/Input'

export default function TriggerYouTrackForm() {
  const [project, setProject] = useState('')
  const [query, setQuery] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // eslint-disable-next-line no-console
    console.log('YouTrack create trigger', { project, query })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Filters</label>
        <Input
          placeholder="Enter filters"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        />
      </div>
    </form>
  )
}


