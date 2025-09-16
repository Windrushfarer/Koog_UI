export default function TelegramTrigger() {
  return (
    <div className="w-[600px] mx-auto rounded-2xl p-[1px] bg-gradient-to-r from-cyan-200/60 via-cyan-50 to-teal-200/60">
      <button
        type="button"
        aria-label="Telegram trigger"
        className="group w-full rounded-2xl bg-gradient-to-b from-white to-gray-50 hover:from-white hover:to-gray-50 shadow-md hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-slate-300 transition"
      >
        <div className="flex items-center justify-center gap-5 p-4">
          <div className="relative">
            <span className="absolute -inset-3 -z-10 rounded-2xl bg-cyan-200/30 blur-xl opacity-0 group-hover:opacity-100 transition" />
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-b from-white to-gray-50 shadow-md">
              <img src="/TG-logo.webp" alt="Telegram logo" className="h-10 w-10 object-contain" />
            </div>
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <div className="text-lg sm:text-xl font-semibold text-gray-900 tracking-tight">Telegram</div>
              <span className="hidden sm:inline-flex text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">To be implemented</span>
            </div>
            <div className="text-sm text-gray-500 mt-0.5">Trigger on new messages and channel updates</div>
          </div>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-white to-gray-50 border border-gray-200 text-gray-400 transition group-hover:text-cyan-600 group-hover:border-cyan-200">
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


