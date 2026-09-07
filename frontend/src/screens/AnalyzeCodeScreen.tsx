import { useState } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import type { UploadMeta } from '../App'

type InputMethod = 'paste' | 'upload'

const WORKFLOW = [
  ['1', 'Check the code', 'Verify it is valid Python before analysis.'],
  ['2', 'Scan for warnings', 'Run Bandit and Semgrep and explain each warning.'],
  ['3', 'Optional AI repair', 'Ask the backend model for a small security-focused change.'],
  ['4', 'Scan again', 'Compare scanner findings before and after repair.'],
] as const

export function AnalyzeCodeScreen({ onScan }: { onScan: (code: string, meta: UploadMeta) => void }) {
  const [method, setMethod] = useState<InputMethod>('paste')
  const [code, setCode] = useState('')
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const readPythonFile = (file: File | undefined) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.py')) {
      setError('Choose a Python file ending in .py, or paste code instead.')
      return
    }
    if (file.size > 100_000) {
      setError('Choose a Python file smaller than 100 KB.')
      return
    }
    const reader = new FileReader()
    reader.onerror = () => setError('The file could not be read. Try another file or paste the code instead.')
    reader.onload = event => {
      const value = typeof event.target?.result === 'string' ? event.target.result : ''
      if (!value.trim()) {
        setError('The selected file is empty.')
        return
      }
      setCode(value)
      setFileName(file.name)
      setError('')
    }
    reader.readAsText(file)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOver(false)
    readPythonFile(event.dataTransfer.files[0])
  }

  const onFile = (event: ChangeEvent<HTMLInputElement>) => readPythonFile(event.target.files?.[0])
  const valid = code.trim().length >= 20 && code.length <= 100_000

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-8 sm:px-6 lg:px-[72px] lg:py-[42px]">
      <section>
        <span className="rounded-full bg-[#171B21] px-3 py-1.5 font-mono text-[10px] font-semibold tracking-wide text-[#5EA7FF]">EXPLORATORY</span>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[34px]">Analyze your own Python code</h1>
        <p className="mt-2 text-sm leading-6 text-[#B8BEC7]">Paste code directly or upload a small Python file, then let SecureEval scan it for security warnings.</p>
      </section>

      <section className="mt-5 rounded-[14px] border border-[#2A3038] bg-[#12151A] px-[18px] py-4">
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#FF7A1A]" /><h2 className="text-xs font-semibold text-white">What this page is for</h2></div>
        <p className="mt-2 text-xs leading-5 text-[#B8BEC7]">This is a practical playground, not part of the official benchmark. It helps you inspect your own code, ask for an AI repair, and compare scanner findings before and after.</p>
      </section>

      <section data-testid="analyze-workspace" className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,780px)_minmax(0,1fr)] lg:gap-6">
        <div className="rounded-[14px] border border-[#2A3038] bg-[#12151A] p-[18px]">
          <h2 className="text-sm font-semibold text-white">1. Add your code</h2>
          <p className="mt-1 text-xs text-[#9199A6]">Choose one input method.</p>

          <div className="mt-3 flex gap-2 rounded-[10px] border border-[#2A3038] bg-[#0B0D10] p-1.5">
            {(['paste', 'upload'] as const).map(item => (
              <button key={item} type="button" onClick={() => setMethod(item)} className={`min-w-[130px] rounded-lg px-4 py-2 text-xs font-semibold transition ${method === item ? 'bg-[#FF7A1A] text-[#0B0D10]' : 'bg-[#171B21] text-white hover:bg-[#20252C]'}`}>{item === 'paste' ? 'Paste code' : 'Upload file'}</button>
            ))}
          </div>

          {method === 'paste' ? (
            <div className="mt-3 overflow-hidden rounded-[10px] border border-[#2A3038] bg-[#0B0D10]">
              <div className="flex items-center justify-between gap-3 border-b border-[#242A31] px-3 py-2"><label htmlFor="python-source" className="font-mono text-[9px] font-bold tracking-wide text-[#9199A6]">PASTE PYTHON HERE</label><span className={`font-mono text-[9px] ${code.length > 100_000 ? 'text-red-300' : 'text-[#69717D]'}`}>{code.length.toLocaleString()} / 100,000</span></div>
              <textarea id="python-source" value={code} onChange={event => { setCode(event.target.value); setFileName(''); setError(event.target.value.length > 100_000 ? 'Pasted code must be 100,000 characters or fewer.' : '') }} placeholder="# Paste your Python code here…" rows={14} className="min-h-[278px] w-full resize-none bg-transparent p-4 font-mono text-xs leading-5 text-[#C9CDD3] outline-none placeholder:text-[#4F5661]" />
            </div>
          ) : (
            <div onDragOver={event => { event.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={onDrop} className={`mt-3 flex min-h-[318px] flex-col items-center justify-center rounded-[10px] border border-dashed p-6 text-center ${dragOver ? 'border-[#FF7A1A] bg-[#FF7A1A]/5' : 'border-[#3A414B] bg-[#0B0D10]'}`}>
              <span className="font-mono text-2xl text-[#69717D]">.py</span>
              <p className="mt-3 text-sm font-medium text-white">{fileName || 'Drop a Python file here'}</p>
              <p className="mt-1 text-xs text-[#7F8792]">Small .py files up to 100 KB</p>
              <label className="mt-5 cursor-pointer rounded-lg border border-[#3A414B] bg-[#171B21] px-4 py-2 text-xs font-medium text-white hover:bg-[#20252C]">Browse files<input type="file" accept=".py" onChange={onFile} className="hidden" /></label>
              {fileName && <button type="button" onClick={() => { setCode(''); setFileName(''); setError('') }} className="mt-3 text-[10px] text-[#9199A6] hover:text-red-300">Remove file</button>}
            </div>
          )}
          <p className="mt-3 text-[11px] leading-5 text-[#7F8792]">Upload mode accepts small Python files. Uploaded code is inspected statically and is not executed on the host.</p>
        </div>

        <aside className="rounded-[14px] border border-[#2A3038] bg-[#12151A] p-[18px]">
          <h2 className="text-sm font-semibold text-white">2. What SecureEval does next</h2>
          <p className="mt-1 text-xs text-[#9199A6]">Plain-language workflow</p>
          <div className="mt-3 space-y-2">
            {WORKFLOW.map(([number, title, description]) => <div key={number} className="flex min-h-[72px] items-center gap-3 rounded-[10px] border border-[#2A3038] bg-[#171B21] p-3"><span className="grid h-7 min-w-10 place-items-center rounded-full bg-[#FF7A1A] font-mono text-[10px] font-semibold text-[#0B0D10]">{number}</span><div><h3 className="text-xs font-semibold text-white">{title}</h3><p className="mt-1 text-[11px] leading-4 text-[#B8BEC7]">{description}</p></div></div>)}
          </div>
          <p className="mt-3 text-[11px] font-semibold leading-5 text-[#5EA7FF]">Exploratory results are never mixed into official benchmark averages.</p>
        </aside>
      </section>

      {error && <p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}
      {code.length > 0 && code.trim().length < 20 && <p role="alert" className="mt-3 text-xs text-amber-300">Paste at least 20 characters of Python code to continue.</p>}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-4xl text-xs leading-5 text-[#9199A6]">Next: Scan This Code opens Code Analysis Results, where you can review findings and optionally repair with AI.</p>
        <button type="button" disabled={!valid} onClick={() => onScan(code, { fileName: fileName || 'pasted_code.py', expectedBehavior: '', dependencies: '', testFileName: '', hasTests: false })} className="shrink-0 rounded-[10px] bg-[#FF7A1A] px-5 py-3 text-sm font-semibold text-[#0B0D10] transition hover:bg-[#F06B0E] disabled:cursor-not-allowed disabled:bg-[#2A3038] disabled:text-[#737B87]">Scan this code → Results</button>
      </div>
    </div>
  )
}