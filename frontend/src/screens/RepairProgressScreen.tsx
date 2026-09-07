import type { RunProgress, RunReport, StrategyId } from '../contracts/api-v1'
import { STRATEGY_META } from '../taxonomy'

const STAGES: RunProgress['stage'][] = [
  'repairing',
  'repaired_testing',
  'repaired_scanning',
  'reviewing',
  'reporting',
  'completed',
]

const LABELS: Record<RunProgress['stage'], string> = {
  queued: 'Preparing the local run',
  baseline_testing: 'Checking the baseline',
  baseline_scanning: 'Scanning the baseline',
  awaiting_strategy: 'Waiting for repair selection',
  repairing: 'Generating repair candidates',
  repaired_testing: 'Checking repaired candidates',
  repaired_scanning: 'Scanning repaired candidates',
  reviewing: 'Reviewing repair evidence',
  reporting: 'Saving the final report',
  completed: 'Results ready',
  failed: 'Repair failed',
  cancelled: 'Repair cancelled',
}

function provenance(report: RunReport | null, strategyId: StrategyId) {
  const usage = report?.strategy_results.find(result => result.strategy_id === strategyId)?.llm_usage
  if (!usage) return null
  return usage.source === 'local_fallback'
    ? 'Local Fallback — No LLM Used'
    : usage.model ? `LLM — ${usage.model}` : 'LLM'
}

export function RepairProgressScreen({
  mode,
  progress,
  report,
  strategies,
  error,
  terminalMessage,
  onDone,
  onCancel,
  onBack,
}: {
  mode: 'benchmark' | 'custom' | 'upload'
  progress: RunProgress | null
  report: RunReport | null
  strategies: StrategyId[]
  error: string | null
  terminalMessage: string | null
  onDone: () => void
  onCancel: () => void
  onBack: () => void
}) {
  const terminal = progress?.status === 'failed' || progress?.status === 'cancelled'
  const activeIndex = progress ? STAGES.indexOf(progress.stage) : -1
  const eyebrow = mode === 'benchmark' ? 'Official Benchmark' : mode === 'upload' ? 'Exploratory upload analysis' : 'Real AI repair comparison'
  const description = mode === 'upload'
    ? 'Repairs are syntax-checked and inspected by Bandit and Semgrep. Uploaded and repaired code is never executed.'
    : mode === 'custom'
      ? 'The backend is generating and evaluating each selected repair with the configured model and real local evidence.'
      : 'The backend is running the selected strategies through the controlled benchmark evaluation.'

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#FF5A00]">{eyebrow}</div>
        <h1 className="font-display text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">Repair &amp; Compare</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#9CA3AF]">{description}</p>
      </div>

      {(error || terminalMessage) && (
        <div role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error || terminalMessage}
        </div>
      )}

      <section className="rounded-2xl border border-white/[0.08] bg-[#1C1C24] p-5 shadow-2xl shadow-black/20 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-5">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">Live backend state</div>
            <div className="mt-1 font-display text-lg font-bold uppercase text-white">{progress ? LABELS[progress.stage] : 'Connecting to the evaluator'}</div>
          </div>
          <span className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider ${report ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : terminal ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-[#FF5A00]/30 bg-[#FF5A00]/10 text-[#FF8A4C]'}`}>
            {report ? 'Report ready' : progress?.status ?? 'Connecting'}
          </span>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {strategies.map(strategyId => {
            const result = report?.strategy_results.find(item => item.strategy_id === strategyId)
            const running = progress?.current_strategy === strategyId
            const source = provenance(report, strategyId)
            return (
              <article key={strategyId} className={`rounded-xl border p-5 ${running ? 'border-[#FF5A00]/60 bg-[#FF5A00]/[0.06]' : 'border-white/[0.08] bg-[#0F0F13]/70'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-sm font-black uppercase text-white">{STRATEGY_META[strategyId].title}</div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[#6B7280]">
                      {result ? 'Persisted result' : running ? 'Running now' : 'Queued'}
                    </div>
                  </div>
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${result ? 'bg-emerald-400' : running ? 'animate-pulse bg-[#FF5A00]' : 'bg-[#3F3F4A]'}`} />
                </div>
                {source && <div className="mt-4 text-xs font-medium text-[#D1D5DB]">{source}</div>}
                {result && (
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-4 text-xs">
                    <span className="text-[#6B7280]">Findings</span>
                    <b className="text-right text-white">{result.metrics.findings_before} → {result.metrics.findings_after}</b>
                    <span className="text-[#6B7280]">{mode === 'upload' ? 'Static-only score' : 'Overall'}</span>
                    <b className="text-right text-[#FF8A4C]">{result.metrics.overall_score.toFixed(1)}</b>
                    {mode === 'upload' && <><span className="text-[#6B7280]">Syntax</span><b className="text-right text-white">{result.repaired_syntax?.valid ? 'Syntax valid' : 'Syntax unavailable'}</b></>}
                  </div>
                )}
              </article>
            )
          })}
        </div>

        <div className="mt-7 flex flex-wrap justify-between gap-3 border-t border-white/[0.08] pt-5">
          <button onClick={onBack} className="rounded-lg border border-white/[0.12] px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-[#D1D5DB] transition hover:bg-white/[0.05]">Back</button>
          <div className="flex gap-3">
            {!report && !terminal && <button onClick={onCancel} className="rounded-lg border border-red-500/30 px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-red-300 transition hover:bg-red-500/10">Cancel</button>}
            <button disabled={!report} onClick={onDone} className="rounded-lg bg-[#FF5A00] px-5 py-2.5 font-display text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#FF6B1A] disabled:cursor-not-allowed disabled:opacity-35">View Final Results</button>
          </div>
        </div>
      </section>

      {!report && !terminal && activeIndex >= 0 && (
        <div className="mt-5 font-mono text-[10px] uppercase tracking-widest text-[#6B7280]">
          Step {activeIndex + 1} of {STAGES.length} · {progress ? LABELS[progress.stage] : 'Waiting'}
        </div>
      )}
    </div>
  )
}