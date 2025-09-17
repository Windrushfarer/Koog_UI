export type Provider = {
  id: string
  name: string
  url: string
}

export type ProviderVersion = {
  id: string
  name: string
}

export const PROVIDERS: Array<Provider> = [
  { id: 'openai', name: 'OpenAI', url: 'https://platform.openai.com/' },
  { id: 'anthropic', name: 'Anthropic', url: 'https://console.anthropic.com/' },
  { id: 'google', name: 'Google AI Studio', url: 'https://aistudio.google.com/' },
  { id: 'openrouter', name: 'OpenRouter', url: 'https://openrouter.ai/' },
  { id: 'azure', name: 'Azure OpenAI', url: 'https://portal.azure.com/' },
  { id: 'mistral', name: 'Mistral', url: 'https://console.mistral.ai/' },
]

export const PROVIDER_VERSIONS: Record<Provider['id'], Array<ProviderVersion>> = {
  openai: [
    { id: 'gpt-4o', name: 'gpt-4o' },
    { id: 'gpt-4o-mini', name: 'gpt-4o-mini' },
    { id: 'o3-mini', name: 'o3-mini' },
    { id: 'gpt-4.1', name: 'gpt-4.1' },
    { id: 'gpt-4.1-mini', name: 'gpt-4.1-mini' },
    { id: 'gpt-5', name: 'gpt-5' },
  ],
  anthropic: [
    { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3.5-haiku', name: 'Claude 3.5 Haiku' },
    { id: 'claude-3-opus', name: 'Claude 3 Opus' },
  ],
  google: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (exp)' },
  ],
  openrouter: [
    { id: 'meta-llama-3.1-70b-instruct', name: 'Llama 3.1 70B Instruct' },
    { id: 'qwen2.5-72b-instruct', name: 'Qwen2.5 72B Instruct' },
  ],
  azure: [
    { id: 'gpt-4o-azure', name: 'gpt-4o (Azure)' },
    { id: 'gpt-4o-mini-azure', name: 'gpt-4o-mini (Azure)' },
  ],
  mistral: [
    { id: 'mistral-large', name: 'Mistral Large' },
    { id: 'mistral-small', name: 'Mistral Small' },
    { id: 'codestral-22b', name: 'Codestral 22B' },
  ],
}


