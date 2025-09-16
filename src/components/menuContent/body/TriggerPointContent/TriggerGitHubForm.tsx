import Input from '../../../ui/Input'

interface TriggerGitHubFormProps {
  value: string
  onValueChange: (value: string) => void
}

export default function TriggerGitHubForm({ value, onValueChange }: TriggerGitHubFormProps) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // eslint-disable-next-line no-console
    console.log('GitHub create trigger', { filters: value })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-neutral-900/95 border p-5 backdrop-blur-xl">
      <div>
        <Input
          placeholder="Enter repository"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        />
      </div>
    </form>
  )
}


