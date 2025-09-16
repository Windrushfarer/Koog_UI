export default function TelegramTrigger() {
  return (
    <div className="w-[600px] mx-auto rounded-2xl p-[1px] bg-gradient-to-r from-cyan-500/30 via-cyan-400/10 to-teal-500/30">
      <button
        type="button"
        aria-label="Telegram trigger"
        className="group w-full rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-800 hover:from-neutral-900 hover:to-neutral-800 shadow-md hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-400/30 transition"
      >
        <div className="flex items-center justify-center gap-5 p-4">
          <div className="relative">
            <span className="absolute -inset-3 -z-10 rounded-2xl bg-cyan-400/30 blur-xl opacity-0 group-hover:opacity-100 transition" />
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-b from-neutral-900 to-neutral-800 shadow-md">
              <img src="/TG-logo.webp" alt="Telegram logo" className="h-10 w-10 object-contain" />
            </div>
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <div className="text-lg sm:text-xl font-semibold text-neutral-100 tracking-tight">Telegram</div>
              <span className="hidden sm:inline-flex text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-300 border border-yellow-500/30">To be implemented</span>
            </div>
            <div className="text-sm text-neutral-300 mt-0.5">Trigger on new messages and channel updates</div>
          </div>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-neutral-900 to-neutral-800 border border-neutral-700 text-neutral-400 transition group-hover:text-cyan-300 group-hover:border-cyan-400/40">
            <svg
              className="w-5 h-5 transition-transform group-hover:translate-x-0.5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </span>
        </div>
      </button>
    </div>
  )
}


