import { useState } from 'react'
import { BENCHMARK_TASKS } from '../App'
import type { BenchmarkTask } from '../App'

const STEPS = [
  ['1', 'Choose a task', 'Select one controlled vulnerable program.'],
  ['2', 'Analyze baseline', 'Run its trusted tests and configured scanners.'],
  ['3', 'Compare repairs', 'Apply the same evidence rules to each strategy.'],
]

export function BenchmarkTaskSetupScreen({ onStartBaseline }: { onStartBaseline: (task: BenchmarkTask) => void }) {
  const [selectedTask, setSelectedTask] = useState<BenchmarkTask>(BENCHMARK_TASKS[0])

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-8 sm:px-6 lg:px-[72px] lg:py-10">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-[#FF7A1A]/35 bg-[#FF7A1A]/10 px-3 py-1 font-mono text-[9px] tracking-wide text-[#FF9A52]">Official Research</span>
        <span className="font-mono text-[10px] text-[#737B87]">Step 1 of 4</span>
      </div>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[36px]">Benchmark Lab — choose a known vulnerable task</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#9CA3AF]">Each task has a controlled source program and trusted functional tests. Select one task to begin a repeatable comparison.</p>

      <section className="mt-6 rounded-xl border border-[#2A3038] bg-[#12151A] px-5 py-4">
        <p className="text-sm leading-6 text-[#C4C8CE]"><span className="font-semibold text-white">Why use a benchmark?</span> Known inputs and expected behavior let SecureEval compare repair strategies on the same evidence instead of judging unrelated programs.</p>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-[#2A3038] bg-[#12151A] p-5">
          <p className="font-mono text-[10px] tracking-[0.16em] text-[#7F8792]">RESEARCH STEPS</p>
          <div className="mt-5 space-y-5">
            {STEPS.map(([number, title, description]) => (
              <div key={number} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#3A414B] font-mono text-[10px] text-[#FF9A52]">{number}</span>
                <div><h2 className="text-sm font-medium text-white">{title}</h2><p className="mt-1 text-xs leading-5 text-[#858D98]">{description}</p></div>
              </div>
            ))}
          </div>
          <p className="mt-6 border-t border-[#2A3038] pt-4 text-[11px] leading-5 text-[#737B87]">Official results remain tied to the selected task, corpus version, configuration, and run ID.</p>
        </aside>

        <section className="overflow-hidden rounded-xl border border-[#2A3038] bg-[#12151A]">
          <div className="border-b border-[#2A3038] px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div><h2 className="text-base font-semibold text-white">Select a benchmark task</h2><p className="mt-1 text-xs text-[#7F8792]">Five predefined Python security cases</p></div>
              <span className="font-mono text-[10px] text-[#7F8792]">{BENCHMARK_TASKS.length} TASKS</span>
            </div>
          </div>

          <div className="divide-y divide-[#242A31]">
            {BENCHMARK_TASKS.map(task => {
              const selected = selectedTask.id === task.id
              return (
                <button key={task.id} type="button" onClick={() => setSelectedTask(task)} className={`grid w-full gap-3 px-5 py-3.5 text-left transition sm:grid-cols-[64px_minmax(0,1fr)_120px_82px] sm:items-center ${selected ? 'bg-[#FF7A1A]/[0.07]' : 'hover:bg-white/[0.025]'}`}>
                  <span className={`font-mono text-xs ${selected ? 'text-[#FF9A52]' : 'text-[#717986]'}`}>{task.id}</span>
                  <span><span className="block text-sm font-medium text-[#ECEDEC]">{task.title}</span><span className="mt-1 block truncate text-xs text-[#7F8792]">{task.description}</span></span>
                  <span className="text-xs capitalize text-[#9CA3AF]">{task.domain.replace('-', ' ')}</span>
                  <span className="flex items-center justify-between gap-3"><span className="rounded border border-[#343B45] px-2 py-1 font-mono text-[9px] uppercase text-[#89919C]">{task.complexity}</span><span className={`h-4 w-4 rounded-full border ${selected ? 'border-[#FF7A1A] bg-[#FF7A1A] shadow-[inset_0_0_0_4px_#12151A]' : 'border-[#4A515C]'}`} /></span>
                </button>
              )
            })}
          </div>

          <div className="border-t border-[#2A3038] bg-[#0F1216] p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] text-[#FF9A52]">SELECTED · {selectedTask.id}</span>
                  <span className="text-xs capitalize text-[#737B87]">{selectedTask.domain.replace('-', ' ')} · {selectedTask.complexity} complexity</span>
                </div>
                <h3 className="mt-2 text-lg font-semibold text-white">{selectedTask.title}</h3>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-[#969DA7]">{selectedTask.expectedBehavior}</p>
                <p className="mt-3 text-[11px] text-[#737B87]">Source is not previewed here. The controlled task source is loaded by the backend when baseline analysis starts.</p>
              </div>
              <button type="button" onClick={() => onStartBaseline(selectedTask)} className="rounded-lg bg-[#FF7A1A] px-5 py-3 text-xs font-semibold text-white transition hover:bg-[#F06B0E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB173]">Start Baseline Analysis <span aria-hidden="true">→</span></button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}