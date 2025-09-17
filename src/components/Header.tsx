export default function Header() {
  return (
    <header className="w-full bg-neutral-900/60 backdrop-blur border-b border-neutral-800">
      <div className="max-w-2xl mx-auto px-4 py-6 flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-100">
          What would you <span className="text-[#B191FF]">Koog</span> NEXT?
        </h1>
        <img
          src="/koog-logo-dark.png"
          alt="Koog logo"
          className="h-24 w-10 sm:h-20 sm:w-20 object-contain drop-shadow rounded-full border-black border-[10px] mr-10 shadow-[0_0_5px_1px_#B191FF] "
        />
      </div>
    </header>
  )
}
