import { useState } from 'react'
import SlackTrigger from './Triggers/SlackTrigger'
import YouTrackTrigger from './Triggers/YouTrackTrigger'
import GitHubTrigger from './Triggers/GitHubTrigger'
import GoogleCalendarTrigger from './Triggers/GoogleCalendarTrigger'
import TelegramTrigger from './Triggers/TelegramTrigger'

type TriggerType = 'youtrack' | 'github' | 'slack' | 'google-calendar' | 'telegram' | null

export default function TriggerPointContent() {
  const [activeTrigger, setActiveTrigger] = useState<TriggerType>(null)
  const [triggerValue, setTriggerValue] = useState('')

  const handleTriggerToggle = (triggerType: TriggerType) => {
    if (activeTrigger === triggerType) {
      setActiveTrigger(null)
    } else {
      setActiveTrigger(triggerType)
      setTriggerValue('')
    }
  }

  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">Trigger</h2>
      <p className="text-gray-600 mb-4">Choose a source to trigger your workflow.</p>

      <div className="flex flex-col gap-4">
        <YouTrackTrigger
          isOpen={activeTrigger === 'youtrack'}
          onToggle={() => handleTriggerToggle('youtrack')}
          value={activeTrigger === 'youtrack' ? triggerValue : ''}
          onValueChange={setTriggerValue}
        />
        <GitHubTrigger
          isOpen={activeTrigger === 'github'}
          onToggle={() => handleTriggerToggle('github')}
          value={activeTrigger === 'github' ? triggerValue : ''}
          onValueChange={setTriggerValue}
        />
        <SlackTrigger
          isOpen={activeTrigger === 'slack'}
          onToggle={() => handleTriggerToggle('slack')}
          value={activeTrigger === 'slack' ? triggerValue : ''}
          onValueChange={setTriggerValue}
        />
        <GoogleCalendarTrigger
          isOpen={activeTrigger === 'google-calendar'}
          onToggle={() => handleTriggerToggle('google-calendar')}
        />
        <TelegramTrigger
          isOpen={activeTrigger === 'telegram'}
          onToggle={() => handleTriggerToggle('telegram')}
        />
      </div>
    </section>
  )
}


