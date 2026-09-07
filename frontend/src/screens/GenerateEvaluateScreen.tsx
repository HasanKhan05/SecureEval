import type { RunProgress, RunReport } from '../contracts/api-v1'

type Props = {
  customPrompt: string
  onPromptChange: (value: string) => void
  onStart: () => void
  progress: RunProgress | null
  report: RunReport | null
  error: string | null
  terminalMessage: string | null
  busy: boolean
  onCancel: () => void
  onReset: () => void
  onNext: () => void
}

const PIPELINE = [
  ['Generate', 'LLM writes Python'],
  ['Validate', 'Check Python syntax'],
  ['Scan', 'Bandit + Semgrep'],
  ['Repair', 'Optional AI fix'],
  ['Compare', 'Before vs. after'],
] as const

function pipelineState(progress: RunProgress | null, index: number): 'waiting' | 'active' | 'complete' {
  if (!progress) return index === 0 ? 'active' : 'waiting'
  if (progress.stage === 'awaiting_strategy') return index < 3 ? 'complete' : 'waiting'
  if (progress.stage === 'baseline_scanning') return index < 2 ? 'complete' : index === 2 ? 'active' : 'waiting'
  if (progress.stage === 'baseline_testing') return index === 0 ? 'complete' : index === 1 ? 'active' : 'waiting'
  return index === 0 ? 'active' : 'waiting'
}

function smokeLabel(report: RunReport) {
  if (report.baseline_tests.status !== 'completed') return 'Unavailable'
  return report.baseline_tests.failed === 0 ? 'Passed' : 'Failed'
}

export function GenerateEvaluateScreen({ customPrompt, onPromptChange, onStart, progress, report, error, terminalMessage, busy, onCancel, onReset, onNext }: Props) {
  const trimmedLength = customPrompt.trim().length
  const valid = trimmedLength >= 20 && customPrompt.length <= 4_000
  const ready = progress?.stage === 'awaiting_strategy'
  const terminal = progress?.status === 'failed' || progress?.status === 'cancelled'
  const started = busy || progress !== null
  const message = error || terminalMessage

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-7 sm:px-6 lg:px-[72px] lg:py-[34px]">
      <section>
        <span className="rounded-full bg-[#171B21] px-3 py-1.5 font-mono text-[10px] font-semibold tracking-wide text-[#44D17A]">EXPLORATORY</span>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[32px]">Generate code with AI, then inspect its security</h1>
        <p className="mt-2 text-sm leading-6 text-[#B8BEC7]">You write a normal-language request. A live LLM generates Python, then SecureEval checks the result before any repair.</p>
      </section>

      <section className="mt-4 rounded-[14px] border border-[#2A3038] bg-[#12151A] px-[18px] py-3.5">
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#44D17A]" /><h2 className="text-xs font-semibold text-white">What this page is for</h2></div>
        <p className="mt-1.5 text-xs leading-5 text-[#B8BEC7]">Use this as an interactive AI-security demo. Generated code and findings are exploratory and are never mixed into official benchmark results.</p>
      </section>

      <section className="mt-3 flex flex-col gap-4 rounded-[14px] border border-[#2A3038] bg-[#12151A] p-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1"><label htmlFor="custom-prompt" className="text-sm font-semibold text-white">1. Describe the Python code you want</label><textarea id="custom-prompt" disabled={started} value={customPrompt} onChange={event => onPromptChange(event.target.value.slice(0, 4_000))} placeholder="Write a Python API endpoint that safely handles user input..." rows={3} className="mt-2 w-full resize-none rounded-[10px] border border-[#2A3038] bg-[#0B0D10] px-4 py-3 text-sm leading-5 text-[#C9CDD3] outline-none placeholder:text-[#59616D] disabled:opacity-60" /><div className="mt-1 flex justify-between font-mono text-[9px] text-[#69717D]"><span>Normal-language request</span><span>{customPrompt.length.toLocaleString()} / 4,000</span></div></div>
        {!progress && <button type="button" disabled={!valid || busy} onClick={onStart} className="h-11 shrink-0 rounded-[10px] bg-[#FF7A1A] px-6 text-sm font-semibold text-[#0B0D10] hover:bg-[#F06B0E] disabled:cursor-not-allowed disabled:bg-[#2A3038] disabled:text-[#737B87]">{busy ? 'Starting…' : 'Generate & Scan'}</button>}
      </section>
      {customPrompt.length > 0 && trimmedLength < 20 && !started && <p role="alert" className="mt-2 text-xs text-amber-300">Add a little more detail — the prompt must contain at least 20 characters.</p>}
      {message && <div role="alert" className="mt-3 rounded-[10px] border border-red-500/30 bg-red-500/10 p-4"><h2 className="text-sm font-semibold text-red-200">{progress?.status === 'cancelled' ? 'Run cancelled' : 'Generation error'}</h2><p className="mt-1 break-words text-xs leading-5 text-red-200/80">{message}</p>{!busy && <button type="button" onClick={onReset} className="mt-3 rounded border border-red-400/30 px-3 py-2 text-xs text-red-200">Edit prompt and try again</button>}</div>}

      <section data-testid="generation-pipeline" className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-[#2A3038] bg-[#12151A] p-2.5 sm:grid-cols-5">
        {PIPELINE.map(([title, description], index) => {
          const state = pipelineState(progress, index)
          return <div key={title} data-pipeline-stage={title} className={`flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-2 ${state === 'active' ? 'border-[#FF7A1A] bg-[#171B21]' : 'border-[#2A3038] bg-[#171B21]'}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[10px] ${state === 'active' ? 'bg-[#FF7A1A] text-[#0B0D10]' : state === 'complete' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-[#12151A] text-[#7F8792]'}`}>{state === 'complete' ? '✓' : index + 1}</span><span className="min-w-0"><span className="block text-[11px] font-semibold text-white">{title}</span><span className="block truncate text-[9px] text-[#7F8792]">{description}</span></span></div>
        })}
      </section>

      <section data-testid="generated-workspace" className="mt-3 grid min-h-[330px] gap-4 lg:grid-cols-[minmax(0,760px)_minmax(0,1fr)]">
        <article className="overflow-hidden rounded-[14px] border border-[#2A3038] bg-[#12151A] p-4">
          <h2 className="text-sm font-semibold text-white">2. Generated code</h2><p className="mt-1 text-[11px] text-[#9199A6]">This panel shows only actual code returned by the live backend model.</p>
          <div className="mt-3 h-[255px] overflow-auto rounded-[10px] border border-[#2A3038] bg-[#0B0D10] p-4">
            {report?.baseline_source ? <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-[#C9CDD3]">{report.baseline_source}</pre> : <div className="flex h-full flex-col items-center justify-center text-center"><p className="text-sm font-semibold text-white">{ready ? 'Baseline Evaluation Ready' : terminal ? 'No generated evidence available' : progress ? 'Generating and evaluating' : 'Waiting for generated code'}</p><p className="mt-2 max-w-sm text-xs leading-5 text-[#7F8792]">{ready ? 'Generated source is retained by the backend and will appear in the persisted results after repair selection.' : terminal ? 'The real run ended without generated source.' : 'No code is shown until the live model and backend complete.'}</p></div>}
          </div>
        </article>

        <article className="rounded-[14px] border border-[#2A3038] bg-[#12151A] p-4">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">3. Security findings</h2><p className="mt-1 text-[11px] leading-4 text-[#9199A6]">Bandit and Semgrep warnings from the generated source.</p></div>{progress && <span className="rounded border border-[#343B45] px-2 py-1 font-mono text-[9px] uppercase text-[#9199A6]">{progress.status}</span>}</div>
          <div className="mt-3 max-h-[218px] space-y-2 overflow-auto rounded-[10px] border border-[#2A3038] bg-[#171B21] p-3">
            {report ? report.baseline_findings.length > 0 ? report.baseline_findings.map(finding => <div key={finding.finding_id} className="rounded-lg border border-[#343B45] bg-[#0B0D10] p-3"><p className="font-mono text-[9px] text-[#FF9A52]">{finding.scanner} · {finding.rule_id}</p><p className="mt-1 text-xs leading-5 text-[#C9CDD3]">{finding.message}</p></div>) : <p className="text-xs leading-5 text-[#B8BEC7]">No findings were returned by the completed configured scanners.</p> : <div className="py-8 text-center"><p className="text-sm font-semibold text-white">{ready ? 'Scanner evidence retained' : 'Waiting for generated code'}</p><p className="mt-2 text-xs leading-5 text-[#7F8792]">No findings are shown until real scanner evidence is available.</p></div>}
          </div>
          {report && <div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg border border-[#2A3038] bg-[#0B0D10] p-2"><p className="font-mono text-[9px] text-[#7F8792]">VALIDATE</p><p className={`mt-1 text-xs font-semibold ${report.baseline_syntax?.valid ? 'text-emerald-300' : 'text-red-300'}`}>{report.baseline_syntax?.valid ? 'Passed' : 'Failed'}</p></div><div className="rounded-lg border border-[#2A3038] bg-[#0B0D10] p-2"><p className="font-mono text-[9px] text-[#7F8792]">SMOKE CHECK</p><p className="mt-1 text-xs font-semibold text-white">{smokeLabel(report)}</p></div><div className="rounded-lg border border-[#2A3038] bg-[#0B0D10] p-2"><p className="font-mono text-[9px] text-[#7F8792]">FINDINGS</p><p className="mt-1 text-xs font-semibold text-[#FF9A52]">{report.baseline_findings.length}</p></div></div>}
          <p className="mt-3 text-[10px] leading-4 text-[#44D17A]">If generation fails, SecureEval shows the real error rather than substituting fake code.</p>
        </article>
      </section>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] leading-5 text-[#9199A6]">Generate & Scan stays here while the backend works. Repair & Compare opens the strategy flow only after baseline evidence is ready.</p><div className="flex shrink-0 gap-2">{busy && progress?.status === 'running' && !ready && <button type="button" onClick={onCancel} className="rounded-lg border border-[#3A414B] px-4 py-2.5 text-xs text-[#D4D7DC]">Cancel</button>}{ready && <button type="button" onClick={onNext} className="rounded-[10px] bg-[#FF7A1A] px-6 py-3 text-sm font-semibold text-[#0B0D10]">Repair & Compare →</button>}</div></div>
      <p className="mt-2 text-[10px] leading-4 text-[#69717D]">Scanner findings are evidence from configured rules, not proof of exploitability.</p>
    </div>
  )
}