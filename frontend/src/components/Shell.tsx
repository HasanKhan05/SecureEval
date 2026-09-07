import type { ReactNode } from 'react'

export type ShellSection = 'overview' | 'benchmark' | 'analyze' | 'generate'

const NAV_ITEMS: Array<{ id: ShellSection; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'benchmark', label: 'Benchmark Lab' },
  { id: 'analyze', label: 'Analyze Code' },
  { id: 'generate', label: 'Generate & Evaluate' },
]

export function Shell({
  children,
  active = 'overview',
  onNavigate,
}: {
  children: ReactNode
  active?: ShellSection
  onNavigate?: (section: ShellSection) => void
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0B0D10] font-sans text-[#F5F5F4] selection:bg-[#FF7A1A]/30 selection:text-white">
      <header className="sticky top-0 z-50 h-[72px] border-b border-[#2A3038] bg-[#12151A]/95 backdrop-blur-md">
        <div className="mx-auto flex h-full w-full max-w-[1440px] items-center gap-5 px-4 sm:px-6 lg:px-9">
          <button type="button" onClick={() => onNavigate?.('overview')} className="flex shrink-0 items-center gap-3 text-left">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-[#FF7A1A] font-mono text-[11px] font-bold text-white">SE</span>
            <span className="text-[20px] font-bold tracking-[-0.02em] text-white">SecureEval</span>
          </button>
          <span className="hidden shrink-0 rounded border border-[#3A414B] px-2 py-1 font-mono text-[9px] tracking-[0.16em] text-[#AEB4BE] sm:inline-flex">PYTHON SECURITY</span>

          <nav aria-label="Primary navigation" className="ml-auto hidden h-full items-center gap-7 lg:flex">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate?.(item.id)}
                className={`relative h-full text-[13px] font-medium transition-colors ${active === item.id ? 'text-white' : 'text-[#949BA6] hover:text-white'}`}
              >
                {item.label}
                {active === item.id && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#FF7A1A]" />}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 rounded-full border border-[#2A3038] bg-[#0B0D10] px-3 py-1.5 lg:ml-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#36B37E]" />
            <span className="font-mono text-[10px] tracking-wide text-[#AEB4BE]">Local</span>
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}