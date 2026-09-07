import type { BenchmarkTask } from '../App'
import type { RunProgress, RunReport } from '../contracts/api-v1'

export function BaselineAnalysisScreen({
  progress,
  report,
  task,
  onChooseRepair,
}: {
  progress: RunProgress | null
  report: RunReport | null
  task: BenchmarkTask | null
  onChooseRepair: () => void
}) {
  const ready = progress?.stage === 'awaiting_strategy'
  const source = report?.baseline_source ?? progress?.baseline_source ?? null
  const findings = report?.baseline_findings ?? progress?.baseline_findings ?? null
  const tests = report?.baseline_tests ?? progress?.baseline_tests ?? null
  const scanStatus = report?.baseline_scan_status ?? progress?.baseline_scan_status ?? null
  const banditCount = findings?.filter(finding => finding.scanner === 'bandit').length ?? 0
  const semgrepCount = findings?.filter(finding => finding.scanner === 'semgrep').length ?? 0

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-8 sm:px-6 lg:px-[72px] lg:py-10">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-[#FF7A1A]/35 bg-[#FF7A1A]/10 px-3 py-1 font-mono text-[9px] tracking-wide text-[#FF9A52]">Official Research</span>
        <span className="font-mono text-[10px] text-[#737B87]">Step 2 of 4</span>
      </div>
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[36px]">Understand the original security problem</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[#9CA3AF]">Baseline means the original benchmark code before any repair. These are the scanner and test results the repair strategies will receive.</p></div>
        {ready && <button type="button" onClick={onChooseRepair} className="shrink-0 rounded-lg bg-[#FF7A1A] px-5 py-3 text-xs font-semibold text-white hover:bg-[#F06B0E]">Choose Repair Approach <span aria-hidden="true">→</span></button>}
      </div>

      {!ready && (
        <section className="mt-6 rounded-xl border border-[#2A3038] bg-[#12151A] p-5">
          <div className="flex items-center justify-between gap-4 text-xs text-[#9CA3AF]"><span>{progress?.stage?.replace(/_/g, ' ') ?? 'Preparing baseline analysis'}</span><span className="font-mono text-[#FF9A52]">IN PROGRESS</span></div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#252B33]"><div className="h-full w-1/2 animate-pulse rounded-full bg-[#FF7A1A]" /></div>
        </section>
      )}

      {ready && (!source || !findings || !tests) && <div role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Baseline processing finished, but its persisted evidence is unavailable. No placeholder data is shown.</div>}

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-[#2A3038] bg-[#12151A] p-4"><p className="font-mono text-[9px] tracking-[0.14em] text-[#7F8792]">SECURITY FINDINGS</p><p className="mt-3 text-2xl font-semibold text-white">{findings ? findings.length : '—'}</p><p className="mt-1 text-xs text-[#858D98]">Bandit {banditCount} · Semgrep {semgrepCount}</p></article>
        <article className="rounded-xl border border-[#2A3038] bg-[#12151A] p-4"><p className="font-mono text-[9px] tracking-[0.14em] text-[#7F8792]">FUNCTIONAL TESTS</p><p className="mt-3 text-2xl font-semibold text-white">{tests ? `${tests.passed} / ${tests.passed + tests.failed}` : '—'}</p><p className="mt-1 text-xs text-[#858D98]">{tests ? `${tests.passed} tests passed · ${tests.status}` : 'Waiting for evidence'}</p></article>
        <article className="rounded-xl border border-[#2A3038] bg-[#12151A] p-4"><p className="font-mono text-[9px] tracking-[0.14em] text-[#7F8792]">TASK</p><p className="mt-3 text-lg font-semibold text-white">{task?.id ?? '—'}</p><p className="mt-1 truncate text-xs text-[#858D98]">{task?.title ?? 'Task identity unavailable'}</p></article>
      </section>

      <section className="mt-4 grid min-h-0 gap-4 lg:grid-cols-[minmax(0,720px)_minmax(0,1fr)]">
        <article className="overflow-hidden rounded-xl border border-[#2A3038] bg-[#12151A]">
          <div className="flex items-center justify-between border-b border-[#2A3038] px-4 py-3"><h2 className="text-sm font-medium text-white">Original code</h2><span className="font-mono text-[9px] text-[#7F8792]">BACKEND SOURCE · PYTHON</span></div>
          <div className="max-h-[390px] overflow-auto bg-[#0D1014] p-4">
            {source ? <pre data-testid="baseline-source" className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-[#C9CDD3]">{source}</pre> : <p className="py-14 text-center text-xs text-[#737B87]">{ready ? 'No source evidence returned.' : 'Analyzing the original source…'}</p>}
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-[#2A3038] bg-[#12151A]">
          <div className="flex items-center justify-between border-b border-[#2A3038] px-4 py-3"><h2 className="text-sm font-medium text-white">Scanner findings</h2><span className="font-mono text-[9px] text-[#7F8792]">{scanStatus ?? 'PENDING'}</span></div>
          <div className="max-h-[390px] space-y-3 overflow-auto p-4">
            <div className="grid grid-cols-2 gap-2"><div className="rounded-lg border border-[#303741] bg-[#0D1014] p-3"><p className="text-xs font-medium text-white">Bandit</p><p className="mt-1 font-mono text-[10px] text-[#858D98]">{banditCount} finding{banditCount === 1 ? '' : 's'}</p></div><div className="rounded-lg border border-[#303741] bg-[#0D1014] p-3"><p className="text-xs font-medium text-white">Semgrep</p><p className="mt-1 font-mono text-[10px] text-[#858D98]">{semgrepCount} finding{semgrepCount === 1 ? '' : 's'}</p></div></div>
            {findings?.length === 0 && <p className="rounded-lg border border-[#303741] bg-[#0D1014] p-4 text-xs leading-5 text-[#9CA3AF]">No findings were returned by the configured scanners.</p>}
            {findings?.map(finding => <div key={finding.finding_id} className="rounded-lg border border-[#303741] bg-[#0D1014] p-4"><div className="flex flex-wrap items-center gap-2"><span className="rounded bg-[#FF7A1A]/10 px-2 py-1 font-mono text-[9px] text-[#FF9A52]">{finding.scanner}</span><span className="font-mono text-[9px] uppercase text-[#9CA3AF]">{finding.severity} · line {finding.line_start}</span></div><p className="mt-2 text-xs font-medium text-[#E3E5E8]">{finding.rule_id}</p><p className="mt-1 text-xs leading-5 text-[#858D98]">{finding.message}</p></div>)}
            {!findings && <p className="py-10 text-center text-xs text-[#737B87]">{ready ? 'No scanner evidence returned.' : 'Bandit and Semgrep are inspecting the baseline…'}</p>}
          </div>
        </article>
      </section>

      <p className="mt-4 text-[11px] leading-5 text-[#737B87]">Scanner findings identify configured patterns; tests check known behavior. Neither is proof that the program is fully secure.</p>
    </div>
  )
}