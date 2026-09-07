const MODES = [
  {
    number: '01',
    label: 'Official Research',
    title: 'Benchmark Lab',
    description: 'Compare repair strategies on five controlled Python tasks with known behavior and repeatable evidence.',
    action: 'Open Benchmark Lab',
    accent: true,
  },
  {
    number: '02',
    label: 'Exploratory',
    title: 'Analyze Your Code',
    description: 'Paste or upload Python source for Bandit and Semgrep inspection. Your uploaded code is never executed.',
    action: 'Analyze Code',
    accent: false,
  },
  {
    number: '03',
    label: 'Exploratory',
    title: 'Generate & Evaluate',
    description: 'Ask the configured AI model for Python code, then inspect and compare its real local evaluation evidence.',
    action: 'Generate Code',
    accent: false,
  },
] as const

const PROCESS = ['Code', 'Scan', 'Repair', 'Test', 'Compare']

export function OverviewScreen({
  onBenchmark,
  onCustom,
  onUpload,
}: {
  onBenchmark: () => void
  onCustom: () => void
  onUpload: () => void
}) {
  const actions = [onBenchmark, onUpload, onCustom]

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-8 sm:px-6 lg:px-[72px] lg:py-10">
      <section className="max-w-4xl">
        <p className="font-mono text-[10px] tracking-[0.2em] text-[#FF7A1A]">SECUREEVAL • SIMPLE SECURITY EVALUATION</p>
        <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-[42px]">Choose what you want to evaluate</h1>
        <p className="mt-4 max-w-3xl text-[15px] leading-7 text-[#AEB4BE]">SecureEval checks Python code for security warnings, can ask AI to repair them, and then compares what changed.</p>
        <p className="mt-3 text-xs text-[#737B87]">Research project by Muhammad Hasan Dad Khan · FAST-NUCES</p>
      </section>

      <section className="mt-8 rounded-xl border border-[#2A3038] bg-[#12151A] px-5 py-4 sm:flex sm:items-center sm:gap-5">
        <span className="mb-2 inline-flex rounded bg-[#FF7A1A]/10 px-2 py-1 font-mono text-[10px] text-[#FF9A52] sm:mb-0">What this does</span>
        <p className="text-sm leading-6 text-[#C7CBD1]">Choose a controlled benchmark, inspect your own source without executing it, or generate Python code through the configured backend model.</p>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {MODES.map((mode, index) => (
          <button
            key={mode.title}
            type="button"
            aria-label={mode.action}
            onClick={actions[index]}
            className="group min-h-[238px] rounded-xl border border-[#2A3038] bg-[#12151A] p-6 text-left transition hover:-translate-y-0.5 hover:border-[#4B535F] hover:bg-[#15191F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A1A]"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="font-mono text-xs text-[#69717D]">{mode.number}</span>
              <span className={`rounded-full border px-2.5 py-1 font-mono text-[9px] tracking-wide ${mode.accent ? 'border-[#FF7A1A]/35 bg-[#FF7A1A]/10 text-[#FF9A52]' : 'border-[#36404B] text-[#929AA5]'}`}>{mode.label}</span>
            </div>
            <h2 className="mt-8 text-xl font-semibold tracking-[-0.02em] text-white">{mode.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[#949BA6]">{mode.description}</p>
            <span className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-[#F2F2F0] group-hover:text-[#FF9A52]">{mode.action} <span aria-hidden="true">→</span></span>
          </button>
        ))}
      </section>

      <section className="mt-6 rounded-xl border border-[#2A3038] bg-[#12151A] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.16em] text-[#7F8792]">SIMPLE PROCESS</p>
            <h2 className="mt-1 text-base font-semibold text-white">From source to comparable evidence</h2>
          </div>
          <span className="hidden text-xs text-[#737B87] sm:block">Five clear steps</span>
        </div>
        <div className="mt-5 grid grid-cols-5 gap-1 sm:gap-3">
          {PROCESS.map((step, index) => (
            <div key={step} className="flex min-w-0 items-center gap-1 sm:gap-3">
              <div className="flex min-w-0 flex-1 flex-col items-center rounded-lg border border-[#2A3038] bg-[#0B0D10] px-1 py-3 text-center sm:px-3">
                <span className="font-mono text-[9px] text-[#FF7A1A]">0{index + 1}</span>
                <span className="mt-1 text-[10px] font-medium text-[#D8DADF] sm:text-xs">{step}</span>
              </div>
              {index < PROCESS.length - 1 && <span className="hidden text-[#505762] sm:block">→</span>}
            </div>
          ))}
        </div>
      </section>

      <aside className="mt-5 border-l-2 border-[#FF7A1A] pl-4 text-xs leading-5 text-[#858D98]">Research boundary: scanner findings and passing tests are evidence, not a guarantee that code is fully secure.</aside>
    </div>
  )
}