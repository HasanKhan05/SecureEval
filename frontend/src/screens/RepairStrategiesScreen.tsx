import { useState } from 'react'
import { STRATEGY_IDS, STRATEGY_META } from '../taxonomy'
import type { StrategyId } from '../contracts/api-v1'

const WHY_COMPARE: Record<StrategyId, string> = {
  vulnerability_specific_v1: 'Tests whether concise normalized issue facts are enough to guide a focused repair.',
  scanner_feedback_v1: 'Tests whether direct tool evidence helps the model resolve the exact reported patterns.',
  test_feedback_v1: 'Tests whether behavior evidence preserves functionality while the implementation changes.',
}

export function RepairStrategiesScreen({
  onRunRepairs,
  initialSelected = [...STRATEGY_IDS],
  mode = 'benchmark',
}: {
  onRunRepairs: (strategies: StrategyId[]) => void
  initialSelected?: StrategyId[]
  mode?: 'benchmark' | 'custom' | 'upload'
}) {
  const [selected, setSelected] = useState<StrategyId[]>(initialSelected)
  const official = mode === 'benchmark'

  const toggleStrategy = (id: StrategyId) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-8 sm:px-6 lg:px-[72px] lg:py-10">
      <div className="flex flex-wrap items-center gap-3"><span className={`rounded-full border px-3 py-1 font-mono text-[9px] tracking-wide ${official ? 'border-[#FF7A1A]/35 bg-[#FF7A1A]/10 text-[#FF9A52]' : 'border-[#3A414B] text-[#9CA3AF]'}`}>{official ? 'Official Research' : 'Exploratory'}</span><span className="font-mono text-[10px] text-[#737B87]">Step 3 of 4</span></div>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[36px]">Compare three ways to guide the AI repair</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#9CA3AF]">Each strategy uses the same original program but provides different evidence to the backend repair model. Select one or run all three for comparison.</p>

      <section className="mt-6 rounded-xl border border-[#2A3038] bg-[#12151A] px-5 py-4"><p className="text-sm leading-6 text-[#C4C8CE]"><span className="font-semibold text-white">What changes between strategies?</span> Only the repair context. Existing strategy IDs, execution, tests, scanning, and scoring remain unchanged.</p></section>

      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        {STRATEGY_IDS.map((id, index) => {
          const meta = STRATEGY_META[id]
          const isSelected = selected.includes(id)
          return (
            <button key={id} type="button" aria-pressed={isSelected} onClick={() => toggleStrategy(id)} className={`min-h-[270px] rounded-xl border p-5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A1A] ${isSelected ? 'border-[#FF7A1A]/65 bg-[#FF7A1A]/[0.06]' : 'border-[#2A3038] bg-[#12151A] hover:border-[#4A515C]'}`}>
              <div className="flex items-center justify-between gap-4"><span className="font-mono text-[10px] text-[#737B87]">0{index + 1}</span><span className={`grid h-5 w-5 place-items-center rounded border text-[10px] ${isSelected ? 'border-[#FF7A1A] bg-[#FF7A1A] text-white' : 'border-[#4A515C] text-transparent'}`}>✓</span></div>
              <h2 className="mt-5 text-lg font-semibold leading-6 text-white">{meta.title}</h2>
              <p className="mt-1 text-xs text-[#7F8792]">{meta.sub}</p>
              <div className="mt-5 border-t border-[#2A3038] pt-4"><p className="font-mono text-[9px] tracking-[0.12em] text-[#7F8792]">What the AI receives</p><p className="mt-2 text-xs leading-5 text-[#C2C6CC]">{meta.desc}</p></div>
              <div className="mt-4"><p className="font-mono text-[9px] tracking-[0.12em] text-[#7F8792]">Why compare it</p><p className="mt-2 text-xs leading-5 text-[#929AA5]">{WHY_COMPARE[id]}</p></div>
            </button>
          )
        })}
      </section>

      <section className="mt-5 flex flex-col gap-4 rounded-xl border border-[#2A3038] bg-[#12151A] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="font-mono text-[9px] tracking-[0.14em] text-[#FF9A52]">RECOMMENDED FOR COMPARISON</p><h2 className="mt-1 text-base font-semibold text-white">Run all three strategies</h2><p className="mt-1 text-xs leading-5 text-[#858D98]">This produces directly comparable backend results for the selected task and scan configuration.</p></div>
        <button type="button" disabled={selected.length === 0} onClick={() => onRunRepairs(selected)} className="shrink-0 rounded-lg bg-[#FF7A1A] px-5 py-3 text-xs font-semibold text-white transition hover:bg-[#F06B0E] disabled:cursor-not-allowed disabled:bg-[#2A3038] disabled:text-[#737B87]">{selected.length === STRATEGY_IDS.length ? 'Run All Repairs → Results' : `Run ${selected.length} Selected → Results`}</button>
      </section>

      <aside className="mt-5 border-l-2 border-[#FF7A1A] pl-4 text-[11px] leading-5 text-[#7F8792]">Research note: strategy comparison is meaningful only within the same task, scanner configuration, model configuration, and run.</aside>
    </div>
  )
}