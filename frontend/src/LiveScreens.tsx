import { useEffect, useMemo } from 'react'

import type { RunProgress, RunReport, ScanCategoryId, StrategyId } from './contracts/api-v1'
import { SCAN_CATEGORIES, STRATEGY_META } from './taxonomy'

const STAGE_LABELS: Record<RunProgress['stage'], string> = {
  queued: 'Preparing isolated workspace',
  baseline_testing: 'Running baseline functional tests',
  baseline_scanning: 'Scanning with Bandit and Semgrep',
  awaiting_strategy: 'Real baseline analysis complete',
  repairing: 'Generating deterministic repairs',
  repaired_testing: 'Testing repaired candidates',
  repaired_scanning: 'Rescanning repaired candidates',
  reviewing: 'Reviewing repair evidence',
  reporting: 'Calculating scores and saving results',
  completed: 'Analysis complete',
  failed: 'Analysis failed',
  cancelled: 'Analysis cancelled',
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">{children}</main>
}

function Header({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-8">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#1B3A6B]">{eyebrow}</div>
      <h1 className="font-display text-3xl font-black uppercase tracking-tight text-[#111118] sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>
    </div>
  )
}

function ErrorPanel({ message }: { message: string }) {
  return <div role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{message}</div>
}

function ProgressBar({ progress }: { progress: RunProgress | null }) {
  const stages: RunProgress['stage'][] = ['baseline_testing', 'baseline_scanning', 'awaiting_strategy', 'repairing', 'repaired_testing', 'repaired_scanning', 'reviewing', 'reporting', 'completed']
  const index = progress ? Math.max(0, stages.indexOf(progress.stage)) : 0
  const percent = progress?.stage === 'cancelled' || progress?.stage === 'failed' ? 100 : Math.round(((index + 1) / stages.length) * 100)
  return (
    <div>
      <div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-wider text-slate-500">
        <span>{progress ? STAGE_LABELS[progress.stage] : 'Connecting to local evaluator'}</span><span>{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-[#1B3A6B] transition-all duration-500" style={{ width: `${percent}%` }} /></div>
    </div>
  )
}

export function LiveAnalysisScreen({ progress, scans, error, onDone, onBack, onCancel }: { progress: RunProgress | null; scans: ScanCategoryId[]; error: string | null; onDone: () => void; onBack: () => void; onCancel: () => void }) {
  const ready = progress?.stage === 'awaiting_strategy'
  const terminal = progress?.status === 'failed' || progress?.status === 'cancelled'
  return (
    <Shell>
      <Header eyebrow="Live local evaluation · T-01" title="Security Analysis" description="SecureEval is running the generated program through real local functional tests, Bandit, and Semgrep. Results are evidence from this sample run, not a security guarantee." />
      {error && <ErrorPanel message={error} />}
      <div className="rounded-xl border border-black/[0.08] bg-white p-5 shadow-sm sm:p-7">
        <ProgressBar progress={progress} />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {scans.map(id => {
            const category = SCAN_CATEGORIES.find(item => item.id === id)
            return <div key={id} className="rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="text-lg">{category?.icon}</div><div className="mt-1 font-display text-sm font-black uppercase">{category?.title ?? id}</div><div className="mt-1 text-xs text-slate-500">Selected for this run</div></div>
          })}
        </div>
        {ready && <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4"><div className="font-display font-black uppercase text-emerald-900">Baseline evidence saved</div><p className="mt-1 text-xs text-emerald-800">Functional test and scanner evidence is saved. Choose repair strategies to continue.</p></div>}
        {terminal && <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{progress?.stage === 'cancelled' ? 'This local run was cancelled. You can return and start another.' : 'The evaluator could not finish this run. Review the error above and retry.'}</div>}
        <div className="mt-7 flex flex-wrap justify-between gap-3">
          <button onClick={onBack} className="rounded border border-slate-300 bg-white px-4 py-2.5 font-display text-xs font-bold uppercase tracking-widest text-slate-700">Back</button>
          <div className="flex gap-3">
            {!ready && !terminal && <button onClick={onCancel} className="rounded border border-rose-200 bg-rose-50 px-4 py-2.5 font-display text-xs font-bold uppercase tracking-widest text-rose-700">Cancel</button>}
            <button disabled={!ready} onClick={onDone} className="rounded bg-[#1B3A6B] px-5 py-2.5 font-display text-xs font-bold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-40">Select Repair Strategy</button>
          </div>
        </div>
      </div>
    </Shell>
  )
}

export function LiveComparisonScreen({ progress, report, strategies, error, onDone, onCancel }: { progress: RunProgress | null; report: RunReport | null; strategies: StrategyId[]; error: string | null; onDone: () => void; onCancel: () => void }) {
  useEffect(() => { if (report) document.title = 'SecureEval · Results ready' }, [report])
  return (
    <Shell>
      <Header eyebrow="Live repair evaluation" title="Strategy Comparison" description="Each selected strategy is repaired, functionally tested, rescanned, and scored by deterministic application logic." />
      {error && <ErrorPanel message={error} />}
      <div className="rounded-xl border border-black/[0.08] bg-white p-5 shadow-sm sm:p-7">
        <ProgressBar progress={progress} />
        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {strategies.map(id => {
            const result = report?.strategy_results.find(item => item.strategy_id === id)
            return (
              <div key={id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="font-display font-black uppercase text-[#111118]">{STRATEGY_META[id].title}</div>
                <div className="mt-1 font-mono text-[10px] uppercase text-slate-400">{result ? 'Persisted result' : progress?.current_strategy === id ? 'Running now' : 'Queued'}</div>
                {result && <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><span>Tests</span><b className="text-right">{result.repaired_tests.passed} passed</b><span>Findings</span><b className="text-right">{result.metrics.findings_before} → {result.metrics.findings_after}</b><span>Overall</span><b className="text-right text-[#1B3A6B]">{result.metrics.overall_score.toFixed(1)}</b><span>Latency</span><b className="text-right">{(result.llm_usage.latency_ms / 1000).toFixed(2)}s</b></div>}
              </div>
            )
          })}
        </div>
        <div className="mt-7 flex justify-end gap-3">
          {!report && progress?.status !== 'failed' && progress?.status !== 'cancelled' && <button onClick={onCancel} className="rounded border border-rose-200 bg-rose-50 px-4 py-2.5 font-display text-xs font-bold uppercase tracking-widest text-rose-700">Cancel</button>}
          <button disabled={!report} onClick={onDone} className="rounded bg-[#1B3A6B] px-5 py-2.5 font-display text-xs font-bold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-40">View Final Results</button>
        </div>
      </div>
    </Shell>
  )
}

function Metric({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return <div data-testid={testId} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="font-mono text-[9px] uppercase tracking-widest text-slate-400">{label}</div><div className="mt-1 font-display text-xl font-black text-[#111118]">{value}</div></div>
}

export function LiveResultsScreen({ report, onRestart }: { report: RunReport; onRestart: () => void }) {
  const overall = useMemo(() => report.strategy_results.find(item => item.strategy_id === report.best_overall), [report])
  const efficient = useMemo(() => report.strategy_results.find(item => item.strategy_id === report.best_efficiency), [report])
  return (
    <Shell>
      <Header eyebrow="Persisted local report · Sample run" title="Evaluation Results" description="This dashboard reflects real tools and deterministic scoring for the local T-01 sample. It does not certify that code is secure." />
      <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Baseline tests" value={`${report.baseline_tests.passed} passed`} />
        <Metric label="Baseline findings" value={String(report.baseline_findings.length)} />
        <Metric label="Best overall" value={overall ? STRATEGY_META[overall.strategy_id].title : 'N/A'} testId="best-overall-strategy" />
        <Metric label="Best efficiency" value={efficient ? STRATEGY_META[efficient.strategy_id].title : 'N/A'} />
      </div>

      <section className="mb-7 rounded-xl border border-black/[0.08] bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-display text-xl font-black uppercase">Baseline security evidence</h2>
        <div className="mt-4 space-y-3">
          {report.baseline_findings.map(finding => <div key={finding.finding_id} className="rounded-lg border border-rose-100 bg-rose-50/60 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><b className="font-mono text-xs text-rose-900">{finding.scanner === 'bandit' ? 'Bandit' : 'Semgrep'} · {finding.rule_id}</b><span className="rounded bg-rose-100 px-2 py-1 font-mono text-[9px] uppercase text-rose-700">{finding.severity}</span></div><p className="mt-2 text-xs leading-relaxed text-slate-600">{finding.message}</p><div className="mt-2 font-mono text-[10px] text-slate-400">{finding.filename}:{finding.line_start}</div></div>)}
        </div>
      </section>

      <section className="mb-7 overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 sm:p-7"><h2 className="font-display text-xl font-black uppercase">Repair strategy results</h2></div>
        <div className="overflow-x-auto"><table className="min-w-[850px] w-full text-left text-xs"><thead className="bg-slate-50 font-mono text-[9px] uppercase tracking-wider text-slate-400"><tr><th className="p-4">Strategy</th><th className="p-4">Tests</th><th className="p-4">Findings</th><th className="p-4">Tokens</th><th className="p-4">Cost</th><th className="p-4">Latency</th><th className="p-4">Overall</th><th className="p-4">Efficiency</th></tr></thead><tbody>{report.strategy_results.map(result => <tr key={result.attempt_id} className="border-t border-slate-100"><td className="p-4 font-bold">{STRATEGY_META[result.strategy_id].title}</td><td className="p-4">{result.repaired_tests.passed} passed / {result.repaired_tests.failed} failed</td><td className="p-4">{result.metrics.findings_before} → {result.metrics.findings_after}</td><td className="p-4">{(result.llm_usage.input_tokens + result.llm_usage.output_tokens).toLocaleString()}</td><td className="p-4">${result.llm_usage.estimated_cost_usd.toFixed(4)}</td><td className="p-4">{(result.llm_usage.latency_ms / 1000).toFixed(2)}s</td><td className="p-4 font-bold text-[#1B3A6B]">{result.metrics.overall_score.toFixed(1)}</td><td className="p-4">{result.metrics.efficiency_score.toFixed(2)}</td></tr>)}</tbody></table></div>
      </section>

      <section className="rounded-xl border border-[#1B3A6B]/20 bg-[#1B3A6B]/5 p-5 sm:p-7">
        <div className="font-mono text-[9px] uppercase tracking-widest text-[#1B3A6B]">Persisted result · {report.explanation_source}</div>
        <h2 className="mt-2 font-display text-xl font-black uppercase">Why this result won</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">{report.explanation}</p>
        {report.limitations.length > 0 && <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-slate-600">{report.limitations.map(item => <li key={item}>{item}</li>)}</ul>}
        <button onClick={onRestart} className="mt-6 rounded bg-[#1B3A6B] px-5 py-2.5 font-display text-xs font-bold uppercase tracking-widest text-white">Start New Evaluation</button>
      </section>
    </Shell>
  )
}
