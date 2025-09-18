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
  { id: 'google', name: 'Google', url: 'https://aistudio.google.com/' },
]

export const PROVIDER_LLMS: Record<Provider['id'], Array<ProviderVersion>> = {
  openai: [
    { id: 'GPT5Mini', name: 'GPT-5 Mini' },
    { id: 'GPT5Nano', name: 'GPT-5 Nano' },
    { id: 'GPT5', name: 'GPT-5' },
    { id: 'GPT4_1', name: 'GPT-4.1' },
    { id: 'GPT4o', name: 'GPT-4o' },
    { id: 'O1', name: 'o1' },
    { id: 'O3', name: 'o3' },
    { id: 'O3Mini', name: 'O3 Mini' },
    { id: 'O4Mini', name: 'O4 Mini' },
    { id: 'GPT4oMini', name: 'GPT-4o Mini' },
    { id: 'GPT4_1Mini', name: 'GPT-4.1 Mini' },
    { id: 'GPT4_1Nano', name: 'GPT-4.1 Nano' },
  ],
  anthropic: [
    { id: 'Sonnet_4', name: 'Sonnet 4' },
    { id: 'Sonnet_3_7', name: 'Sonnet 3.7' },
    { id: 'Opus_4_1', name: 'Opus 4.1' },
    { id: 'Opus_4', name: 'Opus 4' },
    { id: 'Opus_3', name: 'Opus 3' },
    { id: 'Haiku_3_5', name: 'Haiku 3.5' },
    { id: 'Haiku_3', name: 'Haiku 3' },
  ],
  google: [
    { id: 'Gemini2_5Pro', name: 'Gemini 2.5 Pro' },
    { id: 'Gemini2_5Flash', name: 'Gemini 2.5 Flash' },
    { id: 'Gemini2_0Flash', name: 'Gemini 2.0 Flash' },
    { id: 'Gemini2_5FlashLite', name: 'Gemini 2.5 Flash Lite' },
    { id: 'Gemini2_0FlashLite', name: 'Gemini 2.0 Flash Lite' },
  ],
}


