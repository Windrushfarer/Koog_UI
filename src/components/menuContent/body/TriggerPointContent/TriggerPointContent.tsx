import { useForm } from '../../../../context/FormContext'
import SlackTrigger from './Triggers/SlackTrigger'
import YouTrackTrigger from './Triggers/YouTrackTrigger'
import GitHubTrigger from './Triggers/GitHubTrigger'
import GoogleCalendarTrigger from './Triggers/GoogleCalendarTrigger'
import TelegramTrigger from './Triggers/TelegramTrigger'

type TriggerType = 'youtrack' | 'github' | 'slack' | 'google-calendar' | 'telegram' | null

export default function TriggerPointContent() {
  const { state, dispatch } = useForm()
  const { selectedTrigger: activeTrigger, value: triggerValue } = state.trigger

  const handleTriggerToggle = (triggerType: TriggerType) => {
    if (activeTrigger === triggerType) {
      dispatch({ type: 'SET_TRIGGER', payload: { selectedTrigger: null, value: '' } })
    } else {
      dispatch({ type: 'SET_TRIGGER', payload: { selectedTrigger: triggerType, value: '' } })
    }
  }

  const handleValueChange = (value: string) => {
    dispatch({ type: 'SET_TRIGGER', payload: { selectedTrigger: activeTrigger, value } })
  }

  return (
    <section className='h-screen'>
      <h2 className="text-xl font-semibold mb-2">Trigger</h2>
      <p className="text-gray-600 mb-4">Choose a source to trigger your workflow.</p>

      <div className="flex flex-col gap-4">
        <YouTrackTrigger
          isOpen={activeTrigger === 'youtrack'}
          onToggle={() => handleTriggerToggle('youtrack')}
          value={activeTrigger === 'youtrack' ? triggerValue : ''}
          onValueChange={handleValueChange}
        />
        <GitHubTrigger
          isOpen={activeTrigger === 'github'}
          onToggle={() => handleTriggerToggle('github')}
          value={activeTrigger === 'github' ? triggerValue : ''}
          onValueChange={handleValueChange}
        />
        <SlackTrigger
          isOpen={activeTrigger === 'slack'}
          onToggle={() => handleTriggerToggle('slack')}
          value={activeTrigger === 'slack' ? triggerValue : ''}
          onValueChange={handleValueChange}
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


