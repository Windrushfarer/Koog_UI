import TriggerGitHubForm from '../TriggerGitHubForm'

interface GitHubTriggerProps {
  isOpen: boolean
  onToggle: () => void
  value: string
  onValueChange: (value: string) => void
}

export default function GitHubTrigger({
  isOpen,
  onToggle,
  value,
  onValueChange,
}: GitHubTriggerProps) {
  return (
    <div className="w-[600px] mx-auto rounded-2xl p-[1px] bg-gradient-to-r from-zinc-500/30 via-zinc-400/10 to-slate-500/30">
      <button
        type="button"
        aria-label="GitHub trigger"
        className="cursor-pointer group w-full rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-800 hover:from-neutral-900 hover:to-neutral-800 shadow-md hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-slate-400/30 transition"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-center gap-5 p-4">
          <div className="relative">
            <span className="absolute -inset-3 -z-10 rounded-2xl bg-zinc-200/30 blur-xl opacity-0 group-hover:opacity-100 transition" />
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-b from-neutral-900 to-neutral-800 shadow-md">
              <img
                src="/GitHub-logo.png"
                alt="GitHub logo"
                className="h-10 w-10 object-contain rounded-[20%]"
              />
            </div>
          </div>
          <div className="flex-1 text-left">
            <div className="text-lg sm:text-xl font-semibold text-neutral-100 tracking-tight">
              GitHub
            </div>
            <div className="text-sm text-neutral-300 mt-0.5">
              Trigger on new issues, PRs, or commits
            </div>
          </div>
          <span
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-neutral-900 to-neutral-800 border border-neutral-700 text-neutral-400 transition ${isOpen ? 'text-slate-300 border-slate-400/40' : 'group-hover:text-slate-300 group-hover:border-slate-400/40'}`}
          >
            <svg
              className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-90' : 'group-hover:translate-x-0.5'}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </div>
      </button>
      {isOpen && (
        <div className="mt-3 rounded-2xl bg-gradient-to-b from-white to-gray-50 shadow-md">
          <TriggerGitHubForm value={value} onValueChange={onValueChange} />
        </div>
      )}
    </div>
  )
}
