// forms are used inside split trigger components
import SlackTrigger from './TriggerPoins/SlackTrigger'
import YouTrackTrigger from './TriggerPoins/YouTrackTrigger'
import GitHubTrigger from './TriggerPoins/GitHubTrigger'
import GoogleCalendarTrigger from './TriggerPoins/GoogleCalendarTrigger'
import TelegramTrigger from './TriggerPoins/TelegramTrigger'

export default function TriggerPointContent() {
  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">Trigger</h2>
      <p className="text-gray-600 mb-4">Choose a source to trigger your workflow.</p>

      <div className="flex flex-col gap-4">
        <YouTrackTrigger />
        <GitHubTrigger />
        <SlackTrigger />
        <GoogleCalendarTrigger />
        <TelegramTrigger />
      </div>
    </section>
  )
}


