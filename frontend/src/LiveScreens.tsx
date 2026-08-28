import { useEffect, useMemo } from 'react'

import type { RunProgress, RunReport, ScanCategoryId, StrategyId } from './contracts/api-v1'
import { SCAN_CATEGORIES, STRATEGY_META } from './taxonomy'

export const UPLOAD_EVIDENCE_COPY = {
  eyebrow: 'Exploratory upload analysis',
  syntaxValid: 'Syntax valid',
  functionalTestsUnavailable: 'Functional tests unavailable — uploaded code was not executed.',
  staticOnlyScore: 'Static-only score',
} as const

const BENCHMARK_EVIDENCE_COPY = {
  eyebrow: 'Live controlled benchmark',
} as const

export function getLiveEvidenceCopy(evaluationKind: 'upload_static'): typeof UPLOAD_EVIDENCE_COPY
export function getLiveEvidenceCopy(evaluationKind: 'benchmark_full'): typeof BENCHMARK_EVIDENCE_COPY
export function getLiveEvidenceCopy(evaluationKind: RunReport['evaluation_kind']) {
  return evaluationKind === 'upload_static' ? UPLOAD_EVIDENCE_COPY : BENCHMARK_EVIDENCE_COPY
}

type StaticScoreEvidenceInput = {
  baselineSyntax: Pick<NonNullable<RunReport['baseline_syntax']>, 'valid'> | null
  baselineScanStatus: RunReport['baseline_scan_status']
  strategyStatus: RunReport['strategy_results'][number]['status']
  repairedSyntax: Pick<NonNullable<RunReport['strategy_results'][number]['repaired_syntax']>, 'valid'> | null
  repairedScanStatus: RunReport['strategy_results'][number]['repaired_scan_status']
  scoreBasis: RunReport['strategy_results'][number]['metrics']['score_basis']
}

type StaticScoreEvidenceResult<Input extends StaticScoreEvidenceInput> =
  Input['baselineSyntax'] extends { readonly valid: true }
    ? Input['baselineScanStatus'] extends 'completed'
      ? Input['strategyStatus'] extends 'completed'
        ? Input['repairedSyntax'] extends { readonly valid: true }
          ? Input['repairedScanStatus'] extends 'completed'
            ? Input['scoreBasis'] extends 'static_only' ? true : false
            : false
          : false
        : false
      : false
    : false

export function hasStaticScoreEvidence<const Input extends StaticScoreEvidenceInput>(input: Input): StaticScoreEvidenceResult<Input> {
  return Boolean(
    input.baselineSyntax?.valid
    && input.baselineScanStatus === 'completed'
    && input.strategyStatus === 'completed'
    && input.repairedSyntax?.valid
    && input.repairedScanStatus === 'completed'
    && input.scoreBasis === 'static_only',
  ) as StaticScoreEvidenceResult<Input>
}

function hasReportStaticScoreEvidence(report: RunReport, result: RunReport['strategy_results'][number]) {
  return hasStaticScoreEvidence({
    baselineSyntax: report.baseline_syntax,
    baselineScanStatus: report.baseline_scan_status,
    strategyStatus: result.status,
    repairedSyntax: result.repaired_syntax,
    repairedScanStatus: result.repaired_scan_status,
    scoreBasis: result.metrics.score_basis,
  })
}

const STAGE_LABELS: Record<RunProgress['stage'], string> = {
  queued: 'Preparing isolated workspace',
  baseline_testing: 'Running baseline checks',
  baseline_scanning: 'Scanning with Bandit and Semgrep',
  awaiting_strategy: 'Real baseline analysis complete',
  repairing: 'Generating repair candidates',
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

function ProgressBar({ progress, staticOnly = false }: { progress: RunProgress | null; staticOnly?: boolean }) {
  const stages: RunProgress['stage'][] = ['baseline_testing', 'baseline_scanning', 'awaiting_strategy', 'repairing', 'repaired_testing', 'repaired_scanning', 'reviewing', 'reporting', 'completed']
  const index = progress ? Math.max(0, stages.indexOf(progress.stage)) : 0
  const percent = progress?.stage === 'cancelled' || progress?.stage === 'failed' ? 100 : Math.round(((index + 1) / stages.length) * 100)
  return (
    <div>
      <div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-wider text-slate-500">
        <span>{progress ? staticOnly && progress.stage === 'baseline_testing' ? 'Validating uploaded syntax' : staticOnly && progress.stage === 'repaired_testing' ? UPLOAD_EVIDENCE_COPY.functionalTestsUnavailable : STAGE_LABELS[progress.stage] : 'Connecting to local evaluator'}</span><span>{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-[#1B3A6B] transition-all duration-500" style={{ width: `${percent}%` }} /></div>
    </div>
  )
}

export function LiveAnalysisScreen({ mode, progress, scans, error, terminalMessage, onDone, onBack, onCancel }: { mode: 'benchmark' | 'custom' | 'upload'; progress: RunProgress | null; scans: ScanCategoryId[]; error: string | null; terminalMessage: string | null; onDone: () => void; onBack: () => void; onCancel: () => void }) {
  const ready = progress?.stage === 'awaiting_strategy'
  const terminal = progress?.status === 'failed' || progress?.status === 'cancelled'
  const staticOnly = mode === 'upload'
  const custom = mode === 'custom'
  return (
    <Shell>
      <Header eyebrow={staticOnly ? UPLOAD_EVIDENCE_COPY.eyebrow : custom ? 'Real AI custom analysis' : BENCHMARK_EVIDENCE_COPY.eyebrow} title="Security Analysis" description={staticOnly ? 'SecureEval sends uploaded code only to the local backend for syntax validation and static analysis. It is never executed, and static analysis is not a security guarantee.' : custom ? 'The configured AI provider generates Python under a strict code-only contract. SecureEval syntax-checks and scans it, then performs only a restricted Docker smoke check—not trusted functional testing.' : 'SecureEval is running the controlled benchmark through real local functional tests, Bandit, and Semgrep. Results are evidence from this sample run, not a security guarantee.'} />
      {error && <ErrorPanel message={error} />}
      <div className="rounded-xl border border-black/[0.08] bg-white p-5 shadow-sm sm:p-7">
        <ProgressBar progress={progress} staticOnly={staticOnly} />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {scans.map(id => {
            const category = SCAN_CATEGORIES.find(item => item.id === id)
            return <div key={id} className="rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="text-lg">{category?.icon}</div><div className="mt-1 font-display text-sm font-black uppercase">{category?.title ?? id}</div><div className="mt-1 text-xs text-slate-500">Selected for this run</div></div>
          })}
        </div>
        {ready && <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4"><div className="font-display font-black uppercase text-emerald-900">Baseline evidence saved</div><p className="mt-1 text-xs text-emerald-800">{staticOnly ? `${UPLOAD_EVIDENCE_COPY.functionalTestsUnavailable} Syntax and scanner evidence are saved; choose repair strategies to continue.` : custom ? 'Generated code, syntax, scanner, and isolated smoke evidence are saved. Choose repair strategies to continue.' : 'Functional test and scanner evidence is saved. Choose repair strategies to continue.'}</p></div>}
        {terminal && <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{progress?.status === 'cancelled' ? 'This local run was cancelled. You can return and start another.' : terminalMessage ?? 'The evaluator could not finish this run. Return to scan configuration and retry.'}</div>}
        <div className="mt-7 flex flex-wrap justify-between gap-3">
          <button onClick={onBack} className="rounded border border-slate-300 bg-white px-4 py-2.5 font-display text-xs font-bold uppercase tracking-widest text-slate-700">Back</button>
          <div className="flex gap-3">
            {progress && !ready && !terminal && <button onClick={onCancel} className="rounded border border-rose-200 bg-rose-50 px-4 py-2.5 font-display text-xs font-bold uppercase tracking-widest text-rose-700">Cancel</button>}
            <button disabled={!ready} onClick={onDone} className="rounded bg-[#1B3A6B] px-5 py-2.5 font-display text-xs font-bold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-40">Select Repair Strategy</button>
          </div>
        </div>
      </div>
    </Shell>
  )
}

export function LiveComparisonScreen({ mode, progress, report, strategies, error, terminalMessage, onDone, onCancel, onBack }: { mode: 'benchmark' | 'custom' | 'upload'; progress: RunProgress | null; report: RunReport | null; strategies: StrategyId[]; error: string | null; terminalMessage: string | null; onDone: () => void; onCancel: () => void; onBack: () => void }) {
  useEffect(() => { if (report) document.title = 'SecureEval · Results ready' }, [report])
  const staticOnly = mode === 'upload' || (report?.mode === 'upload' && report.evaluation_kind === 'upload_static')
  const custom = mode === 'custom' || report?.evaluation_kind === 'custom_prompt_smoke'
  return (
    <Shell>
      <Header eyebrow={staticOnly ? UPLOAD_EVIDENCE_COPY.eyebrow : custom ? 'Real AI repair comparison' : 'Live repair evaluation'} title="Strategy Comparison" description={staticOnly ? 'Repairs are evaluated with syntax validation and static scanners only. Uploaded code and repaired candidates are never executed; static analysis is not a security guarantee.' : custom ? 'Each strategy uses the configured AI provider, syntax validation, restricted Docker smoke execution, real scanners, and deterministic application scoring.' : 'Each selected strategy is repaired, functionally tested, rescanned, and scored by deterministic application logic.'} />
      {error && <ErrorPanel message={error} />}
      <div className="rounded-xl border border-black/[0.08] bg-white p-5 shadow-sm sm:p-7">
        <ProgressBar progress={progress} staticOnly={staticOnly} />
        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {strategies.map(id => {
            const result = report?.strategy_results.find(item => item.strategy_id === id)
            const canShowStaticScore = !staticOnly || Boolean(report && result && hasReportStaticScoreEvidence(report, result))
            return (
              <div key={id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="font-display font-black uppercase text-[#111118]">{STRATEGY_META[id].title}</div>
                <div className="mt-1 font-mono text-[10px] uppercase text-slate-400">{result ? 'Persisted result' : progress?.current_strategy === id ? 'Running now' : 'Queued'}</div>
                {result && <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><span>{staticOnly ? 'Functional tests' : custom ? 'Smoke check' : 'Tests'}</span><b className="text-right">{staticOnly ? result.repaired_tests.status === 'unavailable' ? result.repaired_tests.output || `Unavailable (${result.repaired_tests.status})` : `Unavailable (${result.repaired_tests.status})` : result.repaired_tests.status === 'completed' ? `${result.repaired_tests.passed} passed` : `Unavailable (${result.repaired_tests.status})`}</b>{staticOnly && <><span>Syntax</span><b className="text-right">{result.repaired_syntax ? result.repaired_syntax.valid ? UPLOAD_EVIDENCE_COPY.syntaxValid : 'Syntax invalid' : 'Syntax unavailable'}</b></>}<span>Findings</span><b className="text-right">{result.status === 'completed' && result.repaired_scan_status === 'completed' ? `${result.metrics.findings_before} → ${result.metrics.findings_after}` : `Unavailable (${result.repaired_scan_status})`}</b><span>{staticOnly ? UPLOAD_EVIDENCE_COPY.staticOnlyScore : 'Overall'}</span><b className="text-right text-[#1B3A6B]">{canShowStaticScore && result.status === 'completed' && result.repaired_scan_status === 'completed' ? result.metrics.overall_score.toFixed(1) : 'Unavailable'}</b><span>Latency</span><b className="text-right">{(result.llm_usage.latency_ms / 1000).toFixed(2)}s</b></div>}
              </div>
            )
          })}
        </div>
        {(progress?.status === 'failed' || progress?.status === 'cancelled') && <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{progress.status === 'cancelled' ? 'This repair run was cancelled.' : terminalMessage ?? 'The repair pipeline failed.'}</div>}
        <div className="mt-7 flex justify-end gap-3">
          {(error || progress?.status === 'failed' || progress?.status === 'cancelled') && <button onClick={onBack} className="rounded border border-slate-300 bg-white px-4 py-2.5 font-display text-xs font-bold uppercase tracking-widest text-slate-700">Back to Scan Configuration</button>}
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

function syntaxLabel(syntax: RunReport['baseline_syntax']) {
  if (!syntax) return 'Syntax unavailable'
  return syntax.valid ? UPLOAD_EVIDENCE_COPY.syntaxValid : 'Syntax invalid'
}

function staticTestsLabel(output: string, status: string) {
  return status === 'unavailable' ? output || `Unavailable (${status})` : `Unavailable (${status})`
}

export function LiveResultsScreen({ report, onRestart }: { report: RunReport; onRestart: () => void }) {
  const staticOnly = report.mode === 'upload' && report.evaluation_kind === 'upload_static'
  const custom = report.mode === 'custom_prompt' && report.evaluation_kind === 'custom_prompt_smoke'
  const staticEvidenceComplete = !staticOnly || report.strategy_results.some(item => hasReportStaticScoreEvidence(report, item))
  const overall = useMemo(() => staticEvidenceComplete ? report.strategy_results.find(item => item.strategy_id === report.best_overall && (!staticOnly || hasReportStaticScoreEvidence(report, item))) : undefined, [report, staticEvidenceComplete, staticOnly])
  const efficient = useMemo(() => staticEvidenceComplete ? report.strategy_results.find(item => item.strategy_id === report.best_efficiency && (!staticOnly || hasReportStaticScoreEvidence(report, item))) : undefined, [report, staticEvidenceComplete, staticOnly])
  return (
    <Shell>
      <Header eyebrow={staticOnly ? UPLOAD_EVIDENCE_COPY.eyebrow : custom ? 'Persisted real AI analysis' : 'Persisted controlled benchmark'} title="Evaluation Results" description={staticOnly ? 'This exploratory upload report contains syntax and static-scanner evidence only. Uploaded code was not executed, and static analysis is not a security guarantee.' : custom ? 'This report contains real provider usage, syntax and scanner evidence, restricted smoke outcomes, and deterministic scoring. Smoke execution is not trusted functional testing or a security guarantee.' : 'This dashboard reflects real tests, scanners, repairs, and deterministic scoring for the selected controlled task. It does not certify that code is secure.'} />
      <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={staticOnly ? 'Baseline syntax' : custom ? 'Baseline smoke' : 'Baseline tests'} value={staticOnly ? syntaxLabel(report.baseline_syntax) : report.baseline_tests.status === 'completed' ? `${report.baseline_tests.passed} passed` : `Unavailable (${report.baseline_tests.status})`} />
        <Metric label={staticOnly ? 'Functional tests' : 'Baseline findings'} value={staticOnly ? staticTestsLabel(report.baseline_tests.output, report.baseline_tests.status) : report.baseline_scan_status === 'completed' ? String(report.baseline_findings.length) : `Unavailable (${report.baseline_scan_status})`} />
        <Metric label={staticOnly ? UPLOAD_EVIDENCE_COPY.staticOnlyScore : 'Best overall'} value={overall ? staticOnly ? overall.metrics.overall_score.toFixed(1) : STRATEGY_META[overall.strategy_id].title : staticOnly ? 'Unavailable' : 'N/A'} testId="best-overall-strategy" />
        <Metric label="Best efficiency" value={efficient ? STRATEGY_META[efficient.strategy_id].title : 'N/A'} />
      </div>

      <section className="mb-7 rounded-xl border border-black/[0.08] bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-display text-xl font-black uppercase">Baseline security evidence</h2>
        <div className="mt-4 space-y-3">
          {staticOnly && <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700"><div className="grid gap-2 sm:grid-cols-3"><span>Syntax: <b>{syntaxLabel(report.baseline_syntax)}</b></span><span>Functional tests: <b>{staticTestsLabel(report.baseline_tests.output, report.baseline_tests.status)}</b></span><span>Scanners: <b>{report.baseline_scan_status === 'completed' ? 'Completed' : `Unavailable (${report.baseline_scan_status})`}</b></span></div></div>}
          {report.baseline_findings.map(finding => <div key={finding.finding_id} className="rounded-lg border border-rose-100 bg-rose-50/60 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><b className="font-mono text-xs text-rose-900">{finding.scanner === 'bandit' ? 'Bandit' : 'Semgrep'} · {finding.rule_id}</b><span className="rounded bg-rose-100 px-2 py-1 font-mono text-[9px] uppercase text-rose-700">{finding.severity}</span></div><p className="mt-2 text-xs leading-relaxed text-slate-600">{finding.message}</p><div className="mt-2 font-mono text-[10px] text-slate-400">{finding.filename}:{finding.line_start}</div></div>)}
          {staticOnly && report.baseline_findings.length === 0 && <p className="text-xs text-slate-600">{report.baseline_scan_status === 'completed' ? 'No findings were reported by the completed scanners.' : 'Scanner evidence is unavailable; this does not imply the uploaded code is clean.'}</p>}
          {(staticOnly || custom) && <div><h3 className="mt-5 font-mono text-[10px] uppercase tracking-widest text-slate-400">{custom ? 'AI-generated source code' : 'Uploaded source code'}</h3><pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">{report.baseline_source || 'Source unavailable.'}</pre></div>}
        </div>
      </section>

      <section className="mb-7 overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 sm:p-7"><h2 className="font-display text-xl font-black uppercase">Repair strategy results</h2></div>
        <div className="overflow-x-auto"><table className="min-w-[850px] w-full text-left text-xs"><thead className="bg-slate-50 font-mono text-[9px] uppercase tracking-wider text-slate-400"><tr><th className="p-4">Strategy</th><th className="p-4">{staticOnly ? 'Functional tests' : custom ? 'Smoke check' : 'Tests'}</th>{staticOnly && <th className="p-4">Syntax</th>}<th className="p-4">Findings</th><th className="p-4">Tokens</th><th className="p-4">Cost</th><th className="p-4">Latency</th><th className="p-4">{staticOnly ? UPLOAD_EVIDENCE_COPY.staticOnlyScore : 'Overall'}</th><th className="p-4">Efficiency</th></tr></thead><tbody>{report.strategy_results.map(result => { const canShowStaticScore = !staticOnly || hasReportStaticScoreEvidence(report, result); return <tr key={result.attempt_id} className="border-t border-slate-100"><td className="p-4 font-bold">{STRATEGY_META[result.strategy_id].title}</td><td className="p-4">{staticOnly ? staticTestsLabel(result.repaired_tests.output, result.repaired_tests.status) : result.repaired_tests.status === 'completed' ? `${result.repaired_tests.passed} passed / ${result.repaired_tests.failed} failed` : `Unavailable (${result.repaired_tests.status})`}</td>{staticOnly && <td className="p-4">{syntaxLabel(result.repaired_syntax)}</td>}<td className="p-4">{result.status === 'completed' && result.repaired_scan_status === 'completed' ? `${result.metrics.findings_before} → ${result.metrics.findings_after}` : `Unavailable (${result.repaired_scan_status})`}</td><td className="p-4">{(result.llm_usage.input_tokens + result.llm_usage.output_tokens).toLocaleString()}</td><td className="p-4">${result.llm_usage.estimated_cost_usd.toFixed(4)}</td><td className="p-4">{(result.llm_usage.latency_ms / 1000).toFixed(2)}s</td><td className="p-4 font-bold text-[#1B3A6B]">{canShowStaticScore && result.status === 'completed' && result.repaired_scan_status === 'completed' ? result.metrics.overall_score.toFixed(1) : 'Unavailable'}</td><td className="p-4">{canShowStaticScore && result.status === 'completed' && result.repaired_scan_status === 'completed' ? result.metrics.efficiency_score.toFixed(2) : 'Unavailable'}</td></tr> })}</tbody></table></div>
      </section>

      <section className="rounded-xl border border-[#1B3A6B]/20 bg-[#1B3A6B]/5 p-5 sm:p-7">
        <div className="font-mono text-[9px] uppercase tracking-widest text-[#1B3A6B]">{staticOnly ? 'Persisted static-only result' : custom ? 'Persisted AI + smoke result' : 'Persisted result'} · {report.explanation_source}</div>
        <h2 className="mt-2 font-display text-xl font-black uppercase">{staticOnly ? staticEvidenceComplete ? 'How this static-only result ranked' : 'Static analysis notes' : 'Why this result won'}</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">{report.explanation}</p>
        {report.limitations.length > 0 && <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-slate-600">{report.limitations.map(item => <li key={item}>{item}</li>)}</ul>}
        {staticOnly && <p className="mt-4 text-xs font-medium text-slate-700">Static analysis is not a security guarantee.</p>}
        <button onClick={onRestart} className="mt-6 rounded bg-[#1B3A6B] px-5 py-2.5 font-display text-xs font-bold uppercase tracking-widest text-white">Start New Evaluation</button>
      </section>
    </Shell>
  )
}
