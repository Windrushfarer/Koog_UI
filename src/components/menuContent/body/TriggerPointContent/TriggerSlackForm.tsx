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
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl p-[1px] bg-gradient-to-r from-[#B191FF]/30 via-transparent to-[#B191FF]/30 shadow-[0_0_24px_#B191FF]/30">
      <div className="rounded-2xl bg-neutral-900/95 border border-[#B191FF]/30 p-5 backdrop-blur-xl shadow-[0_0_12px_#B191FF]/30 hover:shadow-[0_0_18px_#B191FF]/40 focus-within:shadow-[0_0_24px_#B191FF]/50 transition">
        <Input
          placeholder="Enter channel"
          value={filters}
          onChange={(e) => setFilters(e.target.value)}
        />
      </div>
    </form>
  )
}


