import type { FormState } from '@/context/FormContext'
import { generateCodeFromGraph } from '@/codeGenerator'

export enum LLMProvider {
  OpenAI = 'OpenAI',
  Anthropic = 'Anthropic',
  Google = 'Google',
}

export enum ModelID {
  GPT5 = 'GPT5',
  GPT5Mini = 'GPT5Mini',
  GPT5Nano = 'GPT5Nano',
  GPT4_1 = 'GPT4_1',
  GPT4o = 'GPT4o',
  O1 = 'O1',
  O3 = 'O3',
  O3Mini = 'O3Mini',
  O4Mini = 'O4Mini',
  GPT4oMini = 'GPT4oMini',
  GPT4_1Mini = 'GPT4_1Mini',
  GPT4_1Nano = 'GPT4_1Nano',
  Sonnet_4 = 'Sonnet_4',
  Sonnet_3_7 = 'Sonnet_3_7',
  Opus_4_1 = 'Opus_4_1',
  Opus_4 = 'Opus_4',
  Opus_3 = 'Opus_3',
  Haiku_3_5 = 'Haiku_3_5',
  Haiku_3 = 'Haiku_3',
  Gemini2_5Pro = 'Gemini2_5Pro',
  Gemini2_5Flash = 'Gemini2_5Flash',
  Gemini2_0Flash = 'Gemini2_0Flash',
  Gemini2_5FlashLite = 'Gemini2_5FlashLite',
  Gemini2_0FlashLite = 'Gemini2_0FlashLite',
}

export enum ToolSet {
  GOOGLE_MAPS = 'GOOGLE_MAPS',
  WEB_SEARCH = 'WEB_SEARCH',
  WEATHER = 'WEATHER',
}

export type TriggerSetup =
  | { type: 'YouTrackIssueTrigger'; issueFilter: string }
  | { type: 'YouTrackArticleTrigger'; articleSearchRequest: string }
  | { type: 'YouTrackProjectTrigger'; projectSearchRequest: string }
  | { type: 'GitHubPRTrigger'; repositoryId: string }
  | { type: 'GitHubDiscussionTrigger'; repositoryId: string }
  | { type: 'GitHubIssueTrigger'; repositoryId: string }
  | { type: 'SlackTrigger'; channelId: string }

export type OutputSetup =
  | { type: 'YouTrackIssueOutput'; subsystem: string; project: string }
  | { type: 'YouTrackArticleOutput'; subsystem: string; project: string }
  | { type: 'YouTrackProjectOutput'; subsystem: string; project: string }
  | { type: 'GitHubPROutput'; repositoryId: string }
  | { type: 'GitHubDiscussionOutput'; repositoryId: string }
  | { type: 'GitHubIssueOutput'; repositoryId: string }
  | { type: 'SlackOutput'; channelId: string }

export type ModelConfig = {
  provider: LLMProvider
  model: ModelID
}

export type AgentConfig = {
  systemPrompt: string
  model: ModelConfig
  tools: Array<ToolSet>
}

export type CreateNewAgentAutomationRequest = {
  trigger: TriggerSetup
  agentConfig: AgentConfig
  strategyCode: string
  output: OutputSetup
}

const PROVIDER_MAPPING: Record<string, LLMProvider> = {
  openai: LLMProvider.OpenAI,
  anthropic: LLMProvider.Anthropic,
  google: LLMProvider.Google,
}

const MODEL_MAPPING: Record<string, ModelID> = {
  GPT5Mini: ModelID.GPT5Mini,
  GPT5Nano: ModelID.GPT5Nano,
  GPT5: ModelID.GPT5,
  GPT4_1: ModelID.GPT4_1,
  GPT4o: ModelID.GPT4o,
  O1: ModelID.O1,
  O3: ModelID.O3,
  O3Mini: ModelID.O3Mini,
  O4Mini: ModelID.O4Mini,
  GPT4oMini: ModelID.GPT4oMini,
  GPT4_1Mini: ModelID.GPT4_1Mini,
  GPT4_1Nano: ModelID.GPT4_1Nano,
  Sonnet_4: ModelID.Sonnet_4,
  Sonnet_3_7: ModelID.Sonnet_3_7,
  Opus_4_1: ModelID.Opus_4_1,
  Opus_4: ModelID.Opus_4,
  Opus_3: ModelID.Opus_3,
  Haiku_3_5: ModelID.Haiku_3_5,
  Haiku_3: ModelID.Haiku_3,
  Gemini2_5Pro: ModelID.Gemini2_5Pro,
  Gemini2_5Flash: ModelID.Gemini2_5Flash,
  Gemini2_0Flash: ModelID.Gemini2_0Flash,
  Gemini2_5FlashLite: ModelID.Gemini2_5FlashLite,
  Gemini2_0FlashLite: ModelID.Gemini2_0FlashLite,
}

const TOOL_MAPPING: Record<string, ToolSet> = {
  weather: ToolSet.WEATHER,
  map: ToolSet.GOOGLE_MAPS,
  'web-search': ToolSet.WEB_SEARCH,
}

function mapProvider(frontendProviderId: string): LLMProvider {
  if (!(frontendProviderId in PROVIDER_MAPPING)) {
    throw new Error(`Unsupported provider: ${frontendProviderId}`)
  }
  return PROVIDER_MAPPING[frontendProviderId]
}

function mapModel(frontendModelId: string): ModelID {
  if (!(frontendModelId in MODEL_MAPPING)) {
    throw new Error(`Unsupported model: ${frontendModelId}`)
  }
  return MODEL_MAPPING[frontendModelId]
}

function mapTools(formState: FormState): Array<ToolSet> {
  const enabledTools = formState.tools.available
    .filter((tool) => formState.tools.enabledMap[tool.id])
    .map((tool) => tool.id)

  return enabledTools
    .map((toolId) => TOOL_MAPPING[toolId])
    .filter((tool): tool is ToolSet => Boolean(tool))
}

function mapTrigger(formState: FormState): TriggerSetup {
  const { selectedTrigger, value } = formState.trigger

  switch (selectedTrigger) {
    case 'youtrack':
      return { type: 'YouTrackIssueTrigger', issueFilter: value }
    case 'github':
      return { type: 'GitHubIssueTrigger', repositoryId: value }
    case 'slack':
      return { type: 'SlackTrigger', channelId: value }
    case 'google-calendar':
      throw new Error('Calendar trigger not implemented')
    case 'telegram':
      throw new Error('Telegram trigger not implemented')
    default:
      throw new Error(`Unsupported trigger type: ${selectedTrigger}`)
  }
}

function mapOutput(formState: FormState): OutputSetup {
  const { destination, slackChannel } = formState.output

  switch (destination) {
    case 'slack':
      return { type: 'SlackOutput', channelId: slackChannel }
    case 'telegram':
      throw new Error('Telegram output not implemented')
    default:
      throw new Error(`Unsupported output destination: ${destination}`)
  }
}

function getStrategyCode(formState: FormState): string {
  if (formState.agent.mode === 'custom') {
    return generateCodeFromGraph(formState.agent.state.snapshot)
  }
  return 'default strategy code placeholder'
}

export async function sendAgentConfigToBackend(
  formState: FormState,
  apiUrl: string = 'http://0.0.0.0:8080/api',
): Promise<string> {
  try {
    const provider = mapProvider(formState.setup.selectedProviderId)
    const model = mapModel(formState.setup.selectedLLMId)
    const tools = mapTools(formState)
    const trigger = mapTrigger(formState)
    const output = mapOutput(formState)
    const strategyCode = getStrategyCode(formState)

    const request: CreateNewAgentAutomationRequest = {
      trigger,
      agentConfig: {
        systemPrompt: formState.setup.systemPrompt,
        model: {
          provider,
          model,
        },
        tools,
      },
      strategyCode,
      output,
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.text()
  } catch (error) {
    console.error('Error sending agent config to backend:', error)
    throw error
  }
}
