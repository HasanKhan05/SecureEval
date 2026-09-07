import type { ReactNode } from 'react'
import type { Finding, LlmUsage, RunReport, StrategyResult, TestExecution } from '../contracts/api-v1'
import { STRATEGY_META } from '../taxonomy'

const UPLOAD_TESTS_UNAVAILABLE = 'Functional tests unavailable — uploaded code was not executed.'

function strategyName(id: StrategyResult['strategy_id'] | null) {
  return id ? STRATEGY_META[id].title : 'Unavailable'
}

function executionSource(usage: LlmUsage | null | undefined) {
  if (!usage) return 'Unavailable'
  if (usage.source === 'local_fallback') return 'Local Fallback — No LLM Used'
  return usage.model ? `LLM — ${usage.model}` : 'LLM'
}

function scannerStatus(status: RunReport['baseline_scan_status']) {
  return status === 'completed' ? 'Completed' : `Unavailable (${status})`
}

function syntaxStatus(syntax: RunReport['baseline_syntax']) {
  if (!syntax) return 'Syntax unavailable'
  return syntax.valid ? 'Syntax valid' : 'Syntax invalid'
}

function testCounts(tests: TestExecution, label = 'Tests') {
  if (tests.status === 'unavailable') return 'Not available'
  if (tests.status !== 'completed') return 'Test execution failed'
  const total = tests.passed + tests.failed
  if (total === 0 && /\b(error|failed to|traceback|no module named)\b/i.test(tests.output)) return 'Test execution failed'
  if (total === 0 && tests.skipped === 0) return 'Not available'
  return `${label}: ${tests.passed} passed / ${tests.failed} failed / ${tests.skipped} skipped`
}

function compactTestCount(tests: TestExecution) {
  if (tests.status === 'unavailable') return 'Not available'
  if (tests.status !== 'completed') return 'Test execution failed'
  const total = tests.passed + tests.failed
  if (total === 0 && /\b(error|failed to|traceback|no module named)\b/i.test(tests.output)) return 'Test execution failed'
  if (total === 0) return tests.skipped > 0 ? `0 passed · ${tests.skipped} skipped` : 'Not available'
  return `${tests.passed} / ${total} passed`
}

function ResultLayout({ children, testId }: { children: ReactNode; testId: string }) {
  return <div data-testid={testId} className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-7 sm:px-6 lg:px-[72px] lg:py-8">{children}</div>
}

function ResultHeader({ label, eyebrow, title, description, report }: { label?: string; eyebrow: string; title: string; description: string; report: RunReport }) {
  return <header>
    <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-[#3A414B] bg-[#171B21] px-3 py-1 font-mono text-[9px] font-semibold tracking-wide text-[#FF9A52]">{eyebrow}</span>{label && <span className="font-mono text-[10px] text-[#7F8792]">{label}</span>}<span className="font-mono text-[10px] text-[#69717D]">{report.status} · {report.evaluation_kind.replace(/_/g, ' ')}</span></div>
    <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[34px]">{title}</h1>
    <p className="mt-2 max-w-4xl text-sm leading-6 text-[#B8BEC7]">{description}</p>
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] text-[#69717D]"><span>Run {report.run_id}</span><span>{new Date(report.created_at).toLocaleString()}</span></div>
  </header>
}

function Note({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mt-4 rounded-[14px] border border-[#2A3038] bg-[#12151A] px-4 py-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#FF7A1A]" /><h2 className="text-xs font-semibold text-white">{title}</h2></div><div className="mt-1.5 text-[11px] leading-5 text-[#AEB4BE]">{children}</div></section>
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'orange' | 'green' | 'blue' }) {
  const color = tone === 'orange' ? 'text-[#FF8A2F]' : tone === 'green' ? 'text-[#44D17A]' : tone === 'blue' ? 'text-[#5EA7FF]' : 'text-white'
  return <div className="min-w-0 rounded-xl border border-[#2A3038] bg-[#12151A] p-4"><p className="font-mono text-[9px] tracking-[0.12em] text-[#7F8792]">{label}</p><p className={`mt-2 break-words text-lg font-semibold leading-6 ${color}`}>{value}</p></div>
}

function CodePanel({ title, subtitle, code }: { title: string; subtitle?: string; code: string }) {
  return <article className="min-w-0 overflow-hidden rounded-xl border border-[#2A3038] bg-[#12151A]"><div className="border-b border-[#2A3038] px-4 py-3"><h2 className="text-xs font-semibold text-white">{title}</h2>{subtitle && <p className="mt-1 text-[10px] text-[#7F8792]">{subtitle}</p>}</div>{code ? <pre className="max-h-[270px] overflow-auto bg-[#0B0D10] p-4 font-mono text-[11px] leading-5 text-[#C9CDD3]"><code>{code}</code></pre> : <p className="bg-[#0B0D10] p-4 text-xs text-[#7F8792]">Source was not included in this report.</p>}</article>
}

function FindingRows({ findings, status }: { findings: Finding[]; status: RunReport['baseline_scan_status'] }) {
  if (findings.length === 0) return <p className="rounded-lg border border-[#2A3038] bg-[#0B0D10] p-3 text-xs leading-5 text-[#9CA3AF]">{status === 'completed' ? 'No findings were reported by the completed scanners.' : 'Finding evidence is unavailable because scanning did not complete.'}</p>
  return <div className="space-y-2">{findings.map(finding => <article key={finding.finding_id} className="rounded-lg border border-[#303741] bg-[#0B0D10] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><b className="font-mono text-[10px] text-[#FF9A52]">{finding.scanner === 'bandit' ? 'Bandit' : 'Semgrep'} · {finding.rule_id}</b><span className="font-mono text-[9px] uppercase text-[#AEB4BE]">{finding.severity} · line {finding.line_start}</span></div><p className="mt-1 text-[11px] leading-5 text-[#B8BEC7]">{finding.message}</p></article>)}</div>
}

function FindingsPanel({ title, subtitle, findings, status }: { title: string; subtitle?: string; findings: Finding[]; status: RunReport['baseline_scan_status'] }) {
  return <section className="min-w-0 rounded-xl border border-[#2A3038] bg-[#12151A] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-xs font-semibold text-white">{title}</h2>{subtitle && <p className="mt-1 text-[10px] text-[#7F8792]">{subtitle}</p>}</div><span className="rounded border border-[#343B45] px-2 py-1 font-mono text-[9px] text-[#9199A6]">{scannerStatus(status)}</span></div><div className="mt-3 max-h-[260px] overflow-auto"><FindingRows findings={findings} status={status} /></div></section>
}

function StrategyTable({ report, mode }: { report: RunReport; mode: 'benchmark' | 'upload' | 'custom' }) {
  return <section className="mt-4 overflow-hidden rounded-xl border border-[#2A3038] bg-[#12151A]">
    <div className="flex flex-col gap-2 border-b border-[#2A3038] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-[9px] tracking-[0.12em] text-[#FF9A52]">REPAIR STRATEGY RESULTS</p><h2 className="mt-1 text-sm font-semibold text-white">Backend comparison and ranking</h2></div><div className="flex flex-wrap gap-2 font-mono text-[9px]"><span data-testid="best-overall-strategy" className="rounded border border-[#FF7A1A]/35 bg-[#FF7A1A]/10 px-2.5 py-1 text-[#FF9A52]">Best overall · {strategyName(report.best_overall)}</span><span className="rounded border border-emerald-500/25 bg-emerald-500/[0.07] px-2.5 py-1 text-emerald-300">Best efficiency · {strategyName(report.best_efficiency)}</span></div></div>
    <div className="hidden grid-cols-[minmax(0,1.5fr)_repeat(3,92px)_120px_90px_90px_150px] gap-2 border-b border-[#242A31] px-4 py-2 font-mono text-[8px] tracking-wide text-[#69717D] lg:grid"><span>STRATEGY</span><span>Security Score</span><span>Functionality Score</span><span>{mode === 'upload' ? 'Static-only score' : 'Overall Score'}</span><span>FINDINGS</span><span>TOKENS</span><span>LATENCY</span><span>EXECUTION SOURCE</span></div>
    <div className="divide-y divide-[#242A31]">{report.strategy_results.map(result => <article key={result.attempt_id} className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,92px)_120px_90px_90px_150px] lg:items-center lg:gap-2"><div><h3 className="text-xs font-semibold text-white">{STRATEGY_META[result.strategy_id].title}</h3><p className="mt-1 font-mono text-[8px] uppercase text-[#69717D]">{result.status}{report.best_overall === result.strategy_id ? ' · best overall' : ''}</p></div><div><span className="lg:hidden font-mono text-[8px] text-[#69717D]">Security Score · </span><b className="text-xs text-[#FF9A52]">{result.metrics.security_score.toFixed(1)}</b></div><div><span className="lg:hidden font-mono text-[8px] text-[#69717D]">Functionality Score · </span><b className="text-xs text-white">{result.metrics.functionality_score === null ? 'Unavailable' : result.metrics.functionality_score.toFixed(1)}</b></div><div><span className="lg:hidden font-mono text-[8px] text-[#69717D]">{mode === 'upload' ? 'Static-only score' : 'Overall Score'} · </span><b className="text-xs text-white">{result.metrics.overall_score.toFixed(1)}</b></div><div className="text-[11px] text-[#B8BEC7]">{result.metrics.findings_before} → {result.metrics.findings_after}</div><div className="text-[11px] text-[#B8BEC7]">{(result.llm_usage.input_tokens + result.llm_usage.output_tokens).toLocaleString()}</div><div className="text-[11px] text-[#B8BEC7]">{result.llm_usage.latency_ms.toLocaleString()} ms</div><div className="text-[10px] leading-4 text-[#B8BEC7]">{executionSource(result.llm_usage)}</div><details className="lg:col-span-8"><summary className="cursor-pointer font-mono text-[9px] text-[#7F8792]">More evidence</summary><div className="mt-2 grid gap-3 rounded-lg border border-[#2A3038] bg-[#0B0D10] p-3 sm:grid-cols-3"><p className="text-[11px] leading-5 text-[#B8BEC7]">{result.repair_summary}</p><p className="text-[11px] leading-5 text-[#B8BEC7]">Cost ${result.llm_usage.estimated_cost_usd.toFixed(4)}</p><p className="text-[11px] leading-5 text-[#B8BEC7]">{mode === 'upload' ? (result.repaired_tests.output || UPLOAD_TESTS_UNAVAILABLE) : mode === 'custom' ? testCounts(result.repaired_tests, 'Smoke check') : testCounts(result.repaired_tests)}</p></div></details></article>)}</div>
  </section>
}

function FinalExplanation({ report, warning, onRestart, title = 'What this result means' }: { report: RunReport; warning: string; onRestart: () => void; title?: string }) {
  return <section className="mt-4 rounded-xl border border-[#2A3038] bg-[#12151A] p-4"><h2 className="text-xs font-semibold text-white">{title}</h2><p className="mt-2 text-[11px] leading-5 text-[#B8BEC7]">{report.explanation}</p>{report.limitations.length > 0 && <p className="mt-2 text-[10px] leading-4 text-[#7F8792]">Limitations: {report.limitations.join(' · ')}</p>}<div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] font-semibold leading-5 text-[#FFB05F]">{warning}</p><button type="button" onClick={onRestart} className="shrink-0 rounded-lg border border-[#3A414B] bg-[#171B21] px-4 py-2.5 text-xs font-semibold text-white">Start new evaluation</button></div></section>
}

export function BenchmarkResultsScreen({ report, task, onRestart }: { report: RunReport; task: { id: string; title: string } | null; onRestart: () => void }) {
  const best = report.strategy_results.find(result => result.strategy_id === report.best_overall) ?? report.strategy_results[0]
  return <ResultLayout testId="benchmark-results">
    <ResultHeader label="Benchmark Results" eyebrow="Official Research" title="Results — what changed after the repair?" description="Read security findings and functional tests together. A good repair should reduce warnings without breaking expected behavior." report={report} />
    <Note title="How to read this page"><p>Scores, findings, tests, model provenance, and ranking below come directly from the persisted backend report for this run.</p></Note>
    <section className="mt-3 grid gap-3 sm:grid-cols-3"><Metric label="Security findings" value={best ? `${report.baseline_findings.length} → ${best.repaired_findings.length}` : 'Unavailable'} tone="green" /><Metric label="Functional tests" value={best ? `${compactTestCount(report.baseline_tests)} → ${compactTestCount(best.repaired_tests)}` : compactTestCount(report.baseline_tests)} tone="green" /><Metric label="Overall Score" value={best ? best.metrics.overall_score.toFixed(1) : 'Unavailable'} tone="orange" /></section>
    <section className="mt-3 flex flex-col gap-3 rounded-xl border border-[#2A3038] bg-[#12151A] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-[9px] text-[#44D17A]">COMPLETED ATTEMPT</p><p className="mt-1 text-sm font-semibold text-white">{task ? `${task.id} · ${task.title}` : 'Task identity unavailable'} · {best ? strategyName(best.strategy_id) : 'No completed strategy'}</p></div><p className="text-xs font-semibold text-[#FF9A52]">{executionSource(best?.llm_usage)}</p></section>
    <section data-testid="benchmark-before-after" className="mt-3 grid gap-3 lg:grid-cols-2"><CodePanel title="Before repair" subtitle="Original benchmark source" code={report.baseline_source} /><CodePanel title="After repair" subtitle="Best overall repaired source" code={best?.repaired_code ?? ''} /></section>
    <section className="mt-3 grid gap-3 lg:grid-cols-2"><FindingsPanel title="Findings before repair" findings={report.baseline_findings} status={report.baseline_scan_status} /><FindingsPanel title="Findings after repair" findings={best?.repaired_findings ?? []} status={best?.repaired_scan_status ?? 'unavailable'} /></section>
    <StrategyTable report={report} mode="benchmark" />
    <FinalExplanation report={report} warning="A clean scan does not prove the code is fully secure." onRestart={onRestart} />
  </ResultLayout>
}

export function AnalyzeCodeResultsScreen({ report, onRestart, onRepair }: { report: RunReport; onRestart: () => void; onRepair?: () => void }) {
  const best = report.strategy_results.find(result => result.strategy_id === report.best_overall) ?? report.strategy_results[0]
  const repaired = Boolean(best)
  return <ResultLayout testId="analyze-results">
    <div data-testid="upload-result-state" data-state={repaired ? 'post-repair' : 'initial-scan'}>
      <ResultHeader eyebrow="Exploratory" title="Analyze Code Results" description="Bandit and Semgrep inspect the source without running it." report={report} />
      <Note title="What this page is for"><p>This page shows actual static scanner evidence from the uploaded or pasted source. AI repair remains optional and exploratory.</p></Note>
      <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Findings found" value={scannerStatus(report.baseline_scan_status) === 'Completed' ? String(report.baseline_findings.length) : 'Unavailable'} tone="orange" /><Metric label="Execution" value="Static only" /><Metric label="Next step" value={repaired ? 'AI repair complete' : 'Optional AI repair'} tone="green" /><Metric label="Mode" value="Exploratory" tone="blue" /></section>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#7F8792]"><span>{syntaxStatus(report.baseline_syntax)}</span><span>{UPLOAD_TESTS_UNAVAILABLE}</span></div>
      {repaired ? <>
        <section data-testid="upload-before-after" className="mt-3 grid gap-3 lg:grid-cols-2"><CodePanel title="Before repair" subtitle="Original uploaded source" code={report.baseline_source} /><CodePanel title="After repair" subtitle="Best overall repaired source" code={best.repaired_code} /></section>
        <section className="mt-3 grid gap-3 lg:grid-cols-2"><FindingsPanel title="Findings before repair" findings={report.baseline_findings} status={report.baseline_scan_status} /><FindingsPanel title="Findings after repair" findings={best.repaired_findings} status={best.repaired_scan_status} /></section>
        <StrategyTable report={report} mode="upload" />
      </> : <section className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.9fr)]"><div className="space-y-3"><CodePanel title="Original uploaded code" code={report.baseline_source} /><FindingsPanel title="Security findings" findings={report.baseline_findings} status={report.baseline_scan_status} /></div><aside className="rounded-xl border border-[#2A3038] bg-[#12151A] p-4"><h2 className="text-sm font-semibold text-white">What can you do next?</h2><ol className="mt-3 list-decimal space-y-1 pl-4 text-xs leading-5 text-[#B8BEC7]"><li>Review the scanner warnings</li><li>Choose Repair with AI</li><li>Rescan and compare before vs. after</li></ol>{onRepair && <button type="button" onClick={onRepair} className="mt-5 rounded-lg bg-[#FF7A1A] px-5 py-3 text-xs font-semibold text-[#0B0D10]">Repair with AI</button>}</aside></section>}
      <FinalExplanation report={report} warning="Static-analysis evidence is useful, but it is not a security guarantee." onRestart={onRestart} />
    </div>
  </ResultLayout>
}

export function GenerateEvaluateResultsScreen({ report, onRestart }: { report: RunReport; onRestart: () => void }) {
  const best = report.strategy_results.find(result => result.strategy_id === report.best_overall) ?? report.strategy_results[0]
  return <ResultLayout testId="generate-results">
    <ResultHeader eyebrow="Exploratory" title="Generate & Evaluate Results" description="Compare the generated code with the AI-assisted repair, scanner evidence, and smoke-check status from this run." report={report} />
    <Note title="How you got here"><p>Generate & Scan collected the baseline evidence. After Repair & Compare, this page shows only persisted before-and-after backend results.</p></Note>
    <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Original findings" value={report.baseline_scan_status === 'completed' ? String(report.baseline_findings.length) : 'Unavailable'} tone="orange" /><Metric label="After repair" value={best?.repaired_scan_status === 'completed' ? String(best.repaired_findings.length) : 'Unavailable'} tone="green" /><Metric label="Smoke check" value={testCounts(report.baseline_tests, 'Smoke check')} /><Metric label="Classification" value="Exploratory" tone="blue" /></section>
    <section className="mt-3 flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-[#2A3038] bg-[#12151A] px-4 py-3 text-[10px] text-[#AEB4BE]"><span>Generation: <b className="text-white">{executionSource(report.generation_usage)}</b></span>{report.generation_usage && <><span>Tokens: <b className="text-white">{(report.generation_usage.input_tokens + report.generation_usage.output_tokens).toLocaleString()}</b></span><span>Cost: <b className="text-white">${report.generation_usage.estimated_cost_usd.toFixed(4)}</b></span><span>Latency: <b className="text-white">{report.generation_usage.latency_ms.toLocaleString()} ms</b></span></>}</section>
    <section data-testid="custom-before-after" className="mt-3 grid gap-3 lg:grid-cols-2"><CodePanel title="Before repair" subtitle="Exact code returned by the live model" code={report.baseline_source} /><CodePanel title="After repair" subtitle="Exact repaired code returned by the repair step" code={best?.repaired_code ?? ''} /></section>
    <section className="mt-3 grid gap-3 lg:grid-cols-2"><FindingsPanel title="Generated-code findings" subtitle="Bandit and Semgrep baseline evidence" findings={report.baseline_findings} status={report.baseline_scan_status} /><FindingsPanel title="Repaired-code findings" subtitle="Bandit and Semgrep after repair" findings={best?.repaired_findings ?? []} status={best?.repaired_scan_status ?? 'unavailable'} /></section>
    <StrategyTable report={report} mode="custom" />
    <FinalExplanation title="What the comparison means" report={report} warning="Fewer configured SAST findings are useful evidence, not proof that the program is fully secure." onRestart={onRestart} />
  </ResultLayout>
}
