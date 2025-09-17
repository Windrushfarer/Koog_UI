import { useEffect, useState } from 'react'
import SlackTrigger from '../TriggerPointContent/Triggers/SlackTrigger'
import TelegramTrigger from '../TriggerPointContent/Triggers/TelegramTrigger'
import TriggerTelegramForm from '../TriggerPointContent/TriggerTelegramForm'
import { useForm } from '@/context/FormContext'

type OutputOption = 'slack' | 'telegram' | null

export default function OutputContent() {
  const { state, dispatch } = useForm()
  const [selected, setSelected] = useState<OutputOption>(
    state.output.destination,
  )
  const [slackValue, setSlackValue] = useState(state.output.slackChannel)
  const [telegramValue, setTelegramValue] = useState(state.output.telegramChat)

  useEffect(() => {
    dispatch({
      type: 'SET_OUTPUT',
      payload: {
        destination: selected,
        slackChannel: slackValue,
        telegramChat: telegramValue,
      },
    })
  }, [selected, slackValue, telegramValue, dispatch])

  return (
    <section className="h-screen">
      <h2 className="text-xl font-semibold mb-2 text-neutral-100">Output</h2>
      <p className="text-neutral-300 mb-4">
        Choose a destination for the agent output.
      </p>

      <div className="flex flex-col gap-4 items-center">
        <div
          className={
            selected === 'slack' ? 'ring-2 ring-violet-400/50 rounded-2xl' : ''
          }
        >
          <SlackTrigger
            isOpen={selected === 'slack'}
            onToggle={() =>
              setSelected((prev) => (prev === 'slack' ? null : 'slack'))
            }
            value={slackValue}
            onValueChange={setSlackValue}
          />
        </div>
        <div
          className={
            selected === 'telegram' ? 'ring-2 ring-cyan-400/50 rounded-2xl' : ''
          }
        >
          <TelegramTrigger
            isOpen={selected === 'telegram'}
            onToggle={() =>
              setSelected((prev) => (prev === 'telegram' ? null : 'telegram'))
            }
          />
          {selected === 'telegram' && (
            <div className="mt-3 w-[600px]">
              <TriggerTelegramForm
                value={telegramValue}
                onValueChange={setTelegramValue}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
