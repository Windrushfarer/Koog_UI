import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'

type LogEntry = {
  id: string
  timestamp: string
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
  details?: string
}

const MOCK_LOG_ENTRIES: Array<LogEntry> = [
  {
    id: '1',
    timestamp: '2025-01-18 14:32:15',
    type: 'info',
    message: '🚀 Agent "GitHub Issue Monitor" started successfully',
    details: 'Monitoring repository: anthropics/claude-code for new issues',
  },
  {
    id: '2',
    timestamp: '2025-01-18 14:32:16',
    type: 'info',
    message: '🔍 Initializing GitHub API connection',
    details: 'Using OAuth token for authentication',
  },
  {
    id: '3',
    timestamp: '2025-01-18 14:32:17',
    type: 'success',
    message: '✅ Connected to GitHub API successfully',
    details: 'Rate limit: 5000 requests remaining',
  },
  {
    id: '4',
    timestamp: '2025-01-18 14:32:18',
    type: 'info',
    message: '🔄 Starting webhook listener on port 3001',
  },
  {
    id: '5',
    timestamp: '2025-01-18 14:32:19',
    type: 'success',
    message: '🎯 Webhook endpoint active: /github/webhook',
  },
  {
    id: '6',
    timestamp: '2025-01-18 14:32:25',
    type: 'info',
    message: '📥 Received GitHub webhook event: issue.opened',
    details: 'Issue #847: "Feature request: Add dark mode toggle"',
  },
  {
    id: '7',
    timestamp: '2025-01-18 14:32:26',
    type: 'info',
    message: '🤖 Processing issue with GPT-4o',
    details: 'Analyzing issue content and generating response...',
  },
  {
    id: '8',
    timestamp: '2025-01-18 14:32:31',
    type: 'success',
    message: '💬 LLM response generated (2.1s)',
    details: 'Token usage: 1,247 input, 384 output',
  },
  {
    id: '9',
    timestamp: '2025-01-18 14:32:32',
    type: 'info',
    message: '📤 Posting comment to GitHub issue #847',
  },
  {
    id: '10',
    timestamp: '2025-01-18 14:32:33',
    type: 'success',
    message: '✅ Comment posted successfully',
    details: 'GitHub API response: 201 Created',
  },
  {
    id: '11',
    timestamp: '2025-01-18 14:33:15',
    type: 'info',
    message: '📥 Received GitHub webhook event: issue.commented',
    details: 'New comment on issue #847 by user @johndoe',
  },
  {
    id: '12',
    timestamp: '2025-01-18 14:33:16',
    type: 'info',
    message: '🤖 Processing follow-up comment with GPT-4o',
  },
  {
    id: '13',
    timestamp: '2025-01-18 14:33:19',
    type: 'success',
    message: '💬 Follow-up response generated (1.8s)',
    details: 'Token usage: 982 input, 267 output',
  },
  {
    id: '14',
    timestamp: '2025-01-18 14:33:20',
    type: 'success',
    message: '✅ Follow-up comment posted',
  },
  {
    id: '15',
    timestamp: '2025-01-18 14:35:42',
    type: 'warning',
    message: '⚠️  Rate limit approaching (1000 requests remaining)',
    details: 'Consider reducing polling frequency or implementing caching',
  },
]

export default function AgentLogsPage() {
  const [logs, setLogs] = useState<Array<LogEntry>>([])
  const [isStreaming, setIsStreaming] = useState(true)

  useEffect(() => {
    let currentIndex = 0
    const interval = setInterval(() => {
      if (currentIndex < MOCK_LOG_ENTRIES.length) {
        setLogs((prev) => [...prev, MOCK_LOG_ENTRIES[currentIndex]])
        currentIndex++
      } else {
        setIsStreaming(false)
        clearInterval(interval)
      }
    }, 800)

    return () => clearInterval(interval)
  }, [])

  const getLogTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-400 bg-green-950/30 border-green-800'
      case 'warning':
        return 'text-yellow-400 bg-yellow-950/30 border-yellow-800'
      case 'error':
        return 'text-red-400 bg-red-950/30 border-red-800'
      default:
        return 'text-blue-400 bg-blue-950/30 border-blue-800'
    }
  }

  const getLogTypeIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return '✅'
      case 'warning':
        return '⚠️'
      case 'error':
        return '❌'
      default:
        return 'ℹ️'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-100 mb-2">
              Agent Runtime Logs
            </h1>
            <p className="text-neutral-400">
              Real-time monitoring of your agent's activities
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`h-3 w-3 rounded-full ${
                  isStreaming
                    ? 'bg-green-500 animate-pulse'
                    : 'bg-neutral-500'
                }`}
              />
              <span className="text-sm text-neutral-400">
                {isStreaming ? 'Streaming' : 'Complete'}
              </span>
            </div>
            <Link
              to="/"
              search={{ tab: 'trigger' }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#B191FF] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
            >
              ← Back to Setup
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-700 bg-neutral-800/50 backdrop-blur-sm">
          <div className="border-b border-neutral-700 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-100">
                Live Activity Feed
              </h2>
              <div className="flex items-center gap-4 text-sm text-neutral-400">
                <span>Total Events: {logs.length}</span>
                <span>Success: {logs.filter((l) => l.type === 'success').length}</span>
                <span>Warnings: {logs.filter((l) => l.type === 'warning').length}</span>
              </div>
            </div>
          </div>

          <div className="max-h-[600px] overflow-y-auto p-4">
            <div className="space-y-3">
              {logs.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-3 text-neutral-400">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-400 border-b-transparent" />
                    <span>Initializing agent...</span>
                  </div>
                </div>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={log.id}
                    className={`group rounded-lg border p-4 transition-all duration-300 ${getLogTypeColor(
                      log.type,
                    )} ${
                      index === logs.length - 1 && isStreaming
                        ? 'animate-pulse scale-[1.02]'
                        : 'hover:scale-[1.01]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg">{getLogTypeIcon(log.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4 mb-1">
                          <p className="font-medium text-neutral-100 leading-tight">
                            {log.message}
                          </p>
                          <span className="shrink-0 text-xs font-mono text-neutral-500">
                            {log.timestamp}
                          </span>
                        </div>
                        {log.details && (
                          <p className="text-sm text-neutral-300 mt-1 opacity-80">
                            {log.details}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {isStreaming && logs.length > 0 && (
              <div className="mt-4 flex items-center gap-2 text-neutral-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-b-transparent" />
                <span className="text-sm">Processing more events...</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-4">
            <h3 className="font-semibold text-neutral-100 mb-2">Agent Status</h3>
            <p className="text-2xl font-bold text-green-400">🟢 Active</p>
            <p className="text-sm text-neutral-400 mt-1">
              Running for 3m 25s
            </p>
          </div>

          <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-4">
            <h3 className="font-semibold text-neutral-100 mb-2">Events Processed</h3>
            <p className="text-2xl font-bold text-[#B191FF]">{logs.length}</p>
            <p className="text-sm text-neutral-400 mt-1">
              {logs.filter((l) => l.type === 'success').length} successful
            </p>
          </div>

          <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-4">
            <h3 className="font-semibold text-neutral-100 mb-2">LLM Usage</h3>
            <p className="text-2xl font-bold text-blue-400">2,229</p>
            <p className="text-sm text-neutral-400 mt-1">
              tokens consumed
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}