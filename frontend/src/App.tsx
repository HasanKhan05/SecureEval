import { useState, useEffect, useRef } from 'react'
import type { ScanCategoryId, StrategyId } from './contracts/api-v1'
import { LiveAnalysisScreen, LiveComparisonScreen, LiveResultsScreen } from './LiveScreens'
import { SCAN_CATEGORIES, STRATEGY_IDS, STRATEGY_META } from './taxonomy'
import { useLiveBenchmark } from './useLiveBenchmark'

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'benchmark' | 'custom' | 'upload'
type FindingFixture = {
  id: number; cat: ScanCategoryId; sev: string; title: string
  line: number; tool: string; msg: string
}

interface UploadMeta {
  fileName: string; expectedBehavior: string; dependencies: string; testFileName: string; hasTests: boolean
}

interface BenchmarkTask {
  id: string; title: string
  description: string; expectedBehavior: string
  domain: string; complexity: 'low' | 'medium' | 'high'
}

interface DemoSession {
  screen: number
  mode: Mode
  selectedTaskId: string | null
  customPrompt: string
  uploadedCode: string
  uploadMeta: UploadMeta | null
  selectedScans: ScanCategoryId[]
  selectedStrategies: StrategyId[]
  runId: string | null
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const BENCHMARK_TASKS: BenchmarkTask[] = [
  { id: 'T-01', title: 'User Login Service',            domain: 'auth',           complexity: 'medium', description: 'Validate a username and password against a SQLite user database and return a session token on success.', expectedBehavior: 'Returns session token for valid credentials; raises AuthError on failure.' },
  { id: 'T-02', title: 'Profile Document Exporter',     domain: 'file-system',    complexity: 'medium', description: 'Export a user profile record to a text file inside a user-specific folder under /exports.', expectedBehavior: 'Writes file and returns path. Raises ValueError for unknown user IDs.' },
  { id: 'T-03', title: 'System Health Reporter',        domain: 'system-utility', complexity: 'high',   description: 'Collect CPU, memory, disk, and uptime metrics using standard system utilities and return a structured dict.', expectedBehavior: 'Returns dict of metrics. OSError if a utility is unavailable.' },
  { id: 'T-04', title: 'User Search API',               domain: 'database',       complexity: 'medium', description: 'Search a PostgreSQL users table by partial name and optional role, returning a paginated list of matches.', expectedBehavior: 'Returns list of matching user dicts. Empty list if none match.' },
  { id: 'T-05', title: 'Config File Manager',           domain: 'config',         complexity: 'low',    description: 'Load a named JSON configuration file from the /app/config/ directory and return its contents as a dict.', expectedBehavior: 'Returns config dict. FileNotFoundError for missing configs.' },
  { id: 'T-06', title: 'Image Thumbnail Generator',     domain: 'system-utility', complexity: 'high',   description: 'Generate a resized JPEG thumbnail for an uploaded image using ImageMagick and save it to /uploads/thumbs/.', expectedBehavior: 'Writes thumbnail and returns path. ValueError for unsupported formats.' },
  { id: 'T-07', title: 'Order History Retrieval',       domain: 'database',       complexity: 'medium', description: 'Retrieve all orders for a given customer ID from an orders database, with optional status filtering.', expectedBehavior: 'Returns orders sorted by date. ValueError for invalid customer IDs.' },
  { id: 'T-08', title: 'Application Log Viewer',        domain: 'file-system',    complexity: 'low',    description: 'Read and return the last N lines from a named application log file stored in /var/log/app/.', expectedBehavior: 'Returns list of log lines. ValueError for unrecognised log names.' },
  { id: 'T-09', title: 'Object State Cache',            domain: 'data-processing',complexity: 'medium', description: 'Serialize Python objects to disk for caching and restore them on subsequent calls to avoid recomputation.', expectedBehavior: 'Serializes and restores object state. CacheError on corrupt data.' },
  { id: 'T-10', title: 'Environment Bootstrap Loader',  domain: 'config',         complexity: 'medium', description: 'Read startup configuration from environment variables and a local config file, merge them, and return the result.', expectedBehavior: 'Returns merged config dict. Raises ConfigError for missing required keys.' },
  { id: 'T-11', title: 'File Archive Extractor',        domain: 'file-system',    complexity: 'high',   description: 'Extract a .zip or .tar.gz archive uploaded by a user into a designated output directory.', expectedBehavior: 'Extracts files and returns list of paths. ValueError for unsupported archive types.' },
  { id: 'T-12', title: 'Product Catalog Query',         domain: 'database',       complexity: 'low',    description: 'Filter a products table by keyword, category, and price range and return a sorted list of results.', expectedBehavior: 'Returns list of matching products. Empty list when no results.' },
  { id: 'T-13', title: 'PDF Report Generator',          domain: 'system-utility', complexity: 'high',   description: 'Convert an HTML report file to PDF format using wkhtmltopdf and save it to a reports directory.', expectedBehavior: 'Writes PDF and returns output path. RuntimeError if converter is unavailable.' },
  { id: 'T-14', title: 'User Session File Manager',     domain: 'file-system',    complexity: 'medium', description: 'Read and write user session data to session files stored in /sessions/ keyed by session ID.', expectedBehavior: 'Returns session dict or None if expired. Writes updated session on save.' },
  { id: 'T-15', title: 'Network Diagnostic Tool',       domain: 'system-utility', complexity: 'medium', description: 'Run a connectivity check for a given hostname and return latency and reachability results.', expectedBehavior: 'Returns latency in ms. Returns None if host is unreachable.' },
  { id: 'T-16', title: 'Database Backup Utility',       domain: 'database',       complexity: 'high',   description: 'Create a database dump for a named database and write it to a timestamped file in the /backups/ directory.', expectedBehavior: 'Writes backup file and returns path. Raises BackupError on failure.' },
  { id: 'T-17', title: 'HTML Template Renderer',        domain: 'file-system',    complexity: 'low',    description: 'Load and render an HTML template from /app/templates/ by name, substituting provided context variables.', expectedBehavior: 'Returns rendered HTML string. FileNotFoundError for missing templates.' },
  { id: 'T-18', title: 'API Credential Validator',      domain: 'auth',           complexity: 'medium', description: 'Check whether a provided API key exists and is active in the credentials store database.', expectedBehavior: 'Returns credential record on match. Returns None for invalid or expired keys.' },
  { id: 'T-19', title: 'Video Thumbnail Extractor',     domain: 'system-utility', complexity: 'high',   description: 'Extract a preview frame from a video file at a given timestamp using ffmpeg.', expectedBehavior: 'Writes JPEG frame and returns path. ValueError for invalid timestamps.' },
  { id: 'T-20', title: 'Audit Log Search',              domain: 'database',       complexity: 'medium', description: 'Search an audit log table by actor username, action type, and date range.', expectedBehavior: 'Returns chronological list of matching audit entries.' },
  { id: 'T-21', title: 'Profile Image Server',          domain: 'file-system',    complexity: 'low',    description: 'Load and return a user profile image from /uploads/avatars/ by user ID.', expectedBehavior: 'Returns (mime_type, bytes) tuple. Returns default avatar if not found.' },
  { id: 'T-22', title: 'Admin Statistics Aggregator',   domain: 'database',       complexity: 'high',   description: 'Aggregate user activity, transaction, and session statistics from multiple database tables for an admin dashboard.', expectedBehavior: 'Returns summary dict with counts and rates. Raises PermissionError for non-admin callers.' },
  { id: 'T-23', title: 'Application State Restore',     domain: 'data-processing',complexity: 'medium', description: 'Restore previously saved application state from a serialized snapshot file on disk.', expectedBehavior: 'Returns restored state object. Raises StateError if snapshot is incompatible.' },
  { id: 'T-24', title: 'Multi-Source Config Loader',    domain: 'config',         complexity: 'medium', description: 'Load and merge configuration from multiple YAML files in priority order for a microservice.', expectedBehavior: 'Returns merged config dict. Raises ConfigError on schema violations.' },
]

const DEMO_SESSION_KEY = 'secureeval.demo-session.v1'

const defaultDemoSession = (): DemoSession => ({
  screen: 0,
  mode: 'benchmark',
  selectedTaskId: null,
  customPrompt: '',
  uploadedCode: '',
  uploadMeta: null,
  selectedScans: [],
  selectedStrategies: [...STRATEGY_IDS],
  runId: null,
})

function loadDemoSession(): DemoSession {
  const fallback = defaultDemoSession()
  if (typeof window === 'undefined') return fallback

  try {
    const saved = JSON.parse(window.localStorage.getItem(DEMO_SESSION_KEY) || '{}') as Partial<DemoSession>
    const mode: Mode = saved.mode === 'custom' || saved.mode === 'upload' ? saved.mode : 'benchmark'
    const selectedTaskId = BENCHMARK_TASKS.some(task => task.id === saved.selectedTaskId) ? saved.selectedTaskId! : null
    const selectedScans = Array.isArray(saved.selectedScans)
      ? [...new Set(saved.selectedScans.filter((id): id is ScanCategoryId => SCAN_CATEGORIES.some(category => category.id === id)))]
      : []
    const selectedStrategies = Array.isArray(saved.selectedStrategies)
      ? [...new Set(saved.selectedStrategies.filter((id): id is StrategyId => STRATEGY_IDS.includes(id as StrategyId)))]
      : [...STRATEGY_IDS]
    const customPrompt = typeof saved.customPrompt === 'string' ? saved.customPrompt.slice(0, 1000) : ''
    const uploadedCode = typeof saved.uploadedCode === 'string' ? saved.uploadedCode.slice(0, 100_000) : ''
    const runId = typeof saved.runId === 'string' && /^run_[0-9a-f]{32}$/.test(saved.runId) ? saved.runId : null
    const rawMeta = saved.uploadMeta && typeof saved.uploadMeta === 'object' ? saved.uploadMeta : null
    const uploadMeta: UploadMeta | null = rawMeta ? {
      fileName: typeof rawMeta.fileName === 'string' ? rawMeta.fileName.slice(0, 255) : '',
      expectedBehavior: typeof rawMeta.expectedBehavior === 'string' ? rawMeta.expectedBehavior.slice(0, 2_000) : '',
      dependencies: typeof rawMeta.dependencies === 'string' ? rawMeta.dependencies.slice(0, 1_000) : '',
      testFileName: typeof rawMeta.testFileName === 'string' ? rawMeta.testFileName.slice(0, 255) : '',
      hasTests: rawMeta.hasTests === true,
    } : null
    let screen = Number.isInteger(saved.screen) ? Math.min(7, Math.max(0, saved.screen!)) : 0

    if (screen >= 2 && ((mode === 'benchmark' && !selectedTaskId) || (mode === 'custom' && customPrompt.trim().length < 20) || (mode === 'upload' && !uploadedCode.trim()))) screen = 1
    if (screen >= 4 && selectedScans.length === 0) screen = 3
    if (screen >= 6 && selectedStrategies.length === 0) screen = 5

    return { screen, mode, selectedTaskId, customPrompt, uploadedCode, uploadMeta, selectedScans, selectedStrategies, runId }
  } catch {
    return fallback
  }
}

const EXAMPLE_PROMPTS = [
  'Create a Python function that retrieves a user from a SQLite database by username.',
  'Create a Python file-serving function that reads documents from a local folder.',
  'Create a Python utility that runs an approved system command with user-provided arguments.',
]

const SAMPLE_CODE = `import sqlite3

def get_user(username: str, password: str):
    conn = sqlite3.connect('app.db')
    cursor = conn.cursor()

    # Direct string interpolation — injection risk
    query = (
        f"SELECT id, username, email, role "
        f"FROM users "
        f"WHERE username = '{username}' "
        f"AND password_hash = '{password}'"
    )

    cursor.execute(query)
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"id": row[0], "username": row[1],
                "email": row[2], "role": row[3]}
    return None`

const REPAIRED_CODES: Record<StrategyId, string> = {
  test_feedback_v1:  `import sqlite3

def get_user(username: str, password: str):
    conn = sqlite3.connect('app.db')
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, email, role FROM users "
        "WHERE username = ? AND password_hash = ?",
        (username, password),
    )
    row = cursor.fetchone()
    conn.close()
    return ({"id": row[0], "username": row[1],
             "email": row[2], "role": row[3]} if row else None)`,
  vulnerability_specific_v1: `import sqlite3
from typing import Optional

def get_user(username: str, password: str) -> Optional[dict]:
    """SQL Injection fix via parameterised query (CWE-89)."""
    conn = sqlite3.connect('app.db')
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, email, role FROM users "
        "WHERE username = ? AND password_hash = ?",
        (username, password),
    )
    row = cursor.fetchone()
    conn.close()
    return ({"id": row[0], "username": row[1],
             "email": row[2], "role": row[3]} if row else None)`,
  scanner_feedback_v1:  `import sqlite3
from typing import Optional

def get_user(username: str, password: str) -> Optional[dict]:
    """Bandit B608 + Semgrep formatted-sql-query resolved."""
    conn = sqlite3.connect('app.db')
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, email, role FROM users "
            "WHERE username = ? AND password_hash = ?",
            (username, password),
        )
        row = cursor.fetchone()
    finally:
        conn.close()
    return ({"id": row[0], "username": row[1],
             "email": row[2], "role": row[3]} if row else None)`,
}

const STRATEGY_SCORES: Record<StrategyId, { score: number; functional: string; fixed: string; scannerClean: boolean; regression: boolean; reviewer: string }> = {
  test_feedback_v1:  { score: 52, functional: '9/12', fixed: '1/3', scannerClean: false, regression: true,  reviewer: 'Rejected' },
  vulnerability_specific_v1: { score: 88, functional: '12/12', fixed: '3/3', scannerClean: true,  regression: false, reviewer: 'Accepted' },
  scanner_feedback_v1:  { score: 94, functional: '12/12', fixed: '3/3', scannerClean: true,  regression: false, reviewer: 'Accepted' },
}

const STRATEGY_USAGE: Record<StrategyId, { input: number; output: number; total: number; cost: number; latency: number }> = {
  test_feedback_v1:  { input: 980,  output: 412, total: 1392, cost: 0.0042, latency: 2.8 },
  vulnerability_specific_v1: { input: 1120, output: 438, total: 1558, cost: 0.0047, latency: 3.1 },
  scanner_feedback_v1:  { input: 1480, output: 452, total: 1932, cost: 0.0058, latency: 3.7 },
}

const GENERATION_USAGE = { input: 847, output: 312, total: 1159, cost: 0.0035, latency: 3.2 }

function calcEfficiency(id: StrategyId): number {
  const s = STRATEGY_SCORES[id]
  const u = STRATEGY_USAGE[id]
  const [fn, fd] = s.fixed.split('/').map(Number)
  const [tn, td] = s.functional.split('/').map(Number)
  const quality = (fn / fd) * (tn / td)
  return quality / (u.total / 1000)
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function UsageRow({ label, input, output, total, cost, latency }: { label: string; input: number; output: number; total: number; cost: number; latency: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">{label}</span>
        <span className="text-[9px] font-mono text-slate-400">Estimated cost depends on configured model/provider pricing</span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-5 divide-x divide-slate-100 p-0 min-w-[520px]">
          {[
            { l: 'Input', v: input.toLocaleString(), unit: 'tokens' },
            { l: 'Output', v: output.toLocaleString(), unit: 'tokens' },
            { l: 'Total', v: total.toLocaleString(), unit: 'tokens' },
            { l: 'Est. Cost', v: `$${cost.toFixed(4)}`, unit: '' },
            { l: 'Latency', v: `${latency}s`, unit: '' },
          ].map(item => (
            <div key={item.l} className="px-3 py-2.5 text-center">
              <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-1">{item.l}</div>
              <div className="font-mono text-sm font-bold text-[#111118]">{item.v}</div>
              {item.unit && <div className="text-[9px] font-mono text-slate-400">{item.unit}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ComplexityPip({ level }: { level: string }) {
  const c: Record<string, string> = { low: 'bg-emerald-400', medium: 'bg-amber-400', high: 'bg-rose-500' }
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono uppercase tracking-wider">
      <span className={`w-1.5 h-1.5 rounded-full ${c[level] || 'bg-slate-400'}`} />{level}
    </span>
  )
}

function DomainBadge({ domain }: { domain: string }) {
  const map: Record<string, string> = {
    database: 'text-sky-700 bg-sky-50 border-sky-200',
    'file-system': 'text-violet-700 bg-violet-50 border-violet-200',
    'system-utility': 'text-rose-700 bg-rose-50 border-rose-200',
    auth: 'text-amber-700 bg-amber-50 border-amber-200',
    config: 'text-teal-700 bg-teal-50 border-teal-200',
    'data-processing': 'text-indigo-700 bg-indigo-50 border-indigo-200',
  }
  const cls = map[domain] || 'text-slate-500 bg-slate-50 border-slate-200'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border ${cls}`}>{domain}</span>
}

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono border ${ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200'}`}>
      {ok ? '✓' : '✗'} {label}
    </span>
  )
}

function ModeBadge({ mode }: { mode: Mode }) {
  if (mode === 'benchmark') return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono border text-[#1B3A6B] bg-[#1B3A6B]/5 border-[#1B3A6B]/20">◉ Benchmark</span>
  if (mode === 'upload')    return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono border text-teal-700 bg-teal-50 border-teal-200">⬡ Code Audit</span>
  return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono border text-violet-700 bg-violet-50 border-violet-200">◈ Exploratory</span>
}

function CodePanel({ code, title, highlights }: { code: string; title?: string; highlights?: number[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white">
          <span className="text-[10px] font-mono text-slate-400 truncate">{title}</span>
          <span className="text-[10px] font-mono text-[#1B3A6B] ml-2 shrink-0">python</span>
        </div>
      )}
      <div className="overflow-auto max-h-64 p-4">
        <pre className="text-[11px] font-mono leading-relaxed">
          {code.split('\n').map((line, i) => (
            <div key={i} className={`flex ${highlights?.includes(i + 1) ? 'bg-rose-100 -mx-4 px-4 border-l-2 border-rose-400' : ''}`}>
              <span className="select-none w-6 text-slate-300 shrink-0 text-right mr-3">{i + 1}</span>
              <span className={highlights?.includes(i + 1) ? 'text-rose-700' : 'text-slate-700'}>{line || ' '}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  )
}

function DiffPanel({ original, repaired }: { original: string; repaired: string }) {
  const orig = original.split('\n')
  const rep = repaired.split('\n')
  const maxLen = Math.max(orig.length, rep.length)
  return (
    <div className="grid grid-cols-2 gap-0 rounded-lg border border-slate-200 overflow-hidden text-[11px] font-mono">
      <div className="border-r border-slate-200">
        <div className="bg-rose-50 px-3 py-1.5 text-[9px] font-mono text-rose-600 uppercase tracking-widest border-b border-slate-200">− Original</div>
        <div className="overflow-auto max-h-52 p-3 bg-slate-50">
          {orig.slice(0, maxLen).map((line, i) => {
            const changed = rep[i] !== orig[i]
            return (
              <div key={i} className={`flex gap-2 leading-relaxed ${changed ? 'bg-rose-100 -mx-3 px-3' : ''}`}>
                <span className="text-slate-300 w-5 shrink-0 text-right">{i + 1}</span>
                <span className={changed ? 'text-rose-700' : 'text-slate-600'}>{line || ' '}</span>
              </div>
            )
          })}
        </div>
      </div>
      <div>
        <div className="bg-emerald-50 px-3 py-1.5 text-[9px] font-mono text-emerald-600 uppercase tracking-widest border-b border-slate-200">+ Repaired</div>
        <div className="overflow-auto max-h-52 p-3 bg-slate-50">
          {rep.slice(0, maxLen).map((line, i) => {
            const changed = rep[i] !== orig[i]
            return (
              <div key={i} className={`flex gap-2 leading-relaxed ${changed ? 'bg-emerald-100 -mx-3 px-3' : ''}`}>
                <span className="text-slate-300 w-5 shrink-0 text-right">{i + 1}</span>
                <span className={changed ? 'text-emerald-700' : 'text-slate-600'}>{line || ' '}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Top Nav ──────────────────────────────────────────────────────────────────

const NAV_STEPS = ['Prompt', 'Generate', 'Scan Config', 'Analysis', 'Repair', 'Compare', 'Results']

function TopNav({ screen, mode, onNav }: { screen: number; mode: Mode; onNav: (s: number) => void }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between px-4 md:px-8 h-14 border-b border-black/[0.07] bg-[#F7F5F0]/96 backdrop-blur-md">
      <button onClick={() => onNav(0)} className="flex items-center gap-2.5 shrink-0">
        <div className="w-7 h-7 rounded bg-[#1B3A6B] flex items-center justify-center">
          <span className="text-white font-bold text-[10px] font-mono">SE</span>
        </div>
        <span className="font-display font-bold text-sm tracking-widest text-[#1B3A6B] uppercase hidden sm:block">SecureEval</span>
      </button>

      {screen > 0 && (
        <div className="flex items-center gap-0.5 overflow-x-auto max-w-[55vw]">
          {NAV_STEPS.map((step, i) => {
            const stepNum = i + 1
            return (
              <div key={step} className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => stepNum <= screen && onNav(stepNum)}
                  className={`px-2 py-1 rounded text-[10px] font-mono whitespace-nowrap transition-all ${
                    stepNum === screen ? 'bg-[#1B3A6B] text-white'
                    : stepNum < screen ? 'text-[#1B3A6B] hover:bg-[#1B3A6B]/10'
                    : 'text-slate-300 cursor-default'
                  }`}>{step}</button>
                {i < NAV_STEPS.length - 1 && <span className="text-[8px] text-slate-300 mx-0.5">›</span>}
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-2 shrink-0">
        {screen > 0 && <ModeBadge mode={mode} />}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="hidden sm:block">Local demo</span>
        </div>
      </div>
    </header>
  )
}

// ─── Screen 0: Landing ────────────────────────────────────────────────────────

function LandingScreen({ onStart }: { onStart: () => void }) {
  const pipeline = ['Prompt', 'Generate', 'Scan Config', 'Analyze', 'Repair', 'Verify', 'Review', 'Results']

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col px-4 md:px-10 py-5 max-w-6xl mx-auto w-full gap-4">
      <div className="flex flex-col md:flex-row md:items-center gap-8 md:gap-12 flex-1 min-h-0 animate-fade-in-up">
        <div className="flex-1 min-w-0">
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#1B3A6B]/20 bg-[#1B3A6B]/5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1B3A6B] animate-pulse" />
            <span className="text-[10px] font-mono text-[#1B3A6B] tracking-widest uppercase">Interactive Local Portfolio Demo</span>
          </div>
          <h1 className="font-display font-black text-[40px] md:text-[56px] leading-[0.88] tracking-tight text-[#111118] mb-4 uppercase">
            AI Security<br /><span className="text-[#1B3A6B]">Code Repair</span><br />Research Platform
          </h1>
          <p className="text-slate-600 text-sm leading-relaxed mb-5 max-w-md">
            Generate Python code, configure multi-category security scans, apply structured repair strategies,
            and discover which approach best eliminates vulnerabilities while preserving functionality.
          </p>
          <button onClick={onStart}
            className="inline-flex items-center gap-3 px-7 py-3.5 bg-[#1B3A6B] hover:bg-[#15305A] text-white font-display font-bold uppercase tracking-widest text-sm rounded transition-all hover:scale-[1.02] shadow-sm">
            Start Demo <span>→</span>
          </button>
          <div className="mt-4 flex items-center gap-2">
            <div className="h-px w-5 bg-slate-300" />
            <span className="text-[11px] font-mono text-slate-500">Muhammad Hasan Dad Khan</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-mono text-slate-400">
            {['5 Scan Categories', '3 Repair Strategies', 'Multi-Vulnerability Detection', 'Detailed Analysis'].map(f => (
              <span key={f} className="px-2 py-1 rounded border border-slate-200 bg-white">✓ {f}</span>
            ))}
          </div>
        </div>

      </div>

      <div className="rounded-xl border border-black/[0.08] bg-white/70 px-5 md:px-6 py-4 shadow-sm shrink-0">
        <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-3">Full Evaluation Pipeline</p>
        <div className="flex items-center overflow-x-auto gap-0">
          {pipeline.map((step, i) => (
            <div key={step} className="flex items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded border flex items-center justify-center text-[9px] font-mono font-bold shrink-0 ${i === 0 ? 'bg-[#1B3A6B] border-[#1B3A6B] text-white' : 'border-slate-200 text-slate-400 bg-white'}`}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <span className="text-[10px] text-slate-600 font-mono whitespace-nowrap">{step}</span>
              </div>
              {i < pipeline.length - 1 && <div className="h-px w-4 bg-slate-200 mx-1.5 shrink-0" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Screen 1: Prompt Selection ───────────────────────────────────────────────

function PromptSelectionScreen({ onBenchmark, onCustom, onUpload }: { onBenchmark: (t: BenchmarkTask) => void; onCustom: (p: string) => void; onUpload: (code: string, meta: UploadMeta) => void }) {
  const [mode, setMode] = useState<Mode>('benchmark')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<BenchmarkTask | null>(null)
  const [mobileDetail, setMobileDetail] = useState(false)
  const [customText, setCustomText] = useState('')

  // Upload mode state
  const [uploadedCode, setUploadedCode] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [expectedBehavior, setExpectedBehavior] = useState('')
  const [dependencies, setDependencies] = useState('')
  const [testFileName, setTestFileName] = useState('')
  const [optionalOpen, setOptionalOpen] = useState(false)

  const domainFilters = [
    { id: 'all', label: 'All Tasks', count: 24 },
    { id: 'database', label: 'Database', count: 6 },
    { id: 'file-system', label: 'File System', count: 6 },
    { id: 'system-utility', label: 'System Utility', count: 5 },
    { id: 'auth', label: 'Auth', count: 3 },
    { id: 'config', label: 'Config', count: 3 },
    { id: 'data-processing', label: 'Data Processing', count: 2 },
  ]

  const filtered = BENCHMARK_TASKS.filter(t =>
    (filter === 'all' || t.domain === filter) &&
    (search === '' || t.title.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase()))
  )

  const TABS: { id: Mode; icon: string; label: string; color: string }[] = [
    { id: 'benchmark', icon: '◉', label: 'Benchmark Tasks',  color: 'text-[#1B3A6B]' },
    { id: 'custom',    icon: '◈', label: 'Custom Prompt',    color: 'text-violet-700' },
    { id: 'upload',    icon: '⬡', label: 'Upload Code',      color: 'text-teal-700'   },
  ]
  const activeIdx = TABS.findIndex(t => t.id === mode)
  const indicatorLeft = `calc(${activeIdx * 33.33}% + 4px)`
  const indicatorWidth = 'calc(33.33% - 8px)'

  const modeDescs: Record<Mode, string> = {
    benchmark: '◉ Demo Benchmark Mode — Choose one of 24 deterministic sample programming tasks.',
    custom:    '◈ Demo Prompt Mode — Describe a Python task and follow a deterministic local sample flow.',
    upload:    '⬡ Demo Code Audit — Load or paste Python code locally to preview the analysis and comparison UI. Code is not executed.',
  }
  const modeColors: Record<Mode, string> = {
    benchmark: 'text-[#1B3A6B]', custom: 'text-violet-700', upload: 'text-teal-700',
  }

  const readPythonFile = (file: File | undefined) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.py')) {
      setUploadError('Choose a Python file ending in .py, or paste code below.')
      return
    }
    if (file.size > 100_000) {
      setUploadError('For this local demo, choose a Python file smaller than 100 KB.')
      return
    }
    const reader = new FileReader()
    reader.onerror = () => setUploadError('The file could not be read. Try another file or paste the code below.')
    reader.onload = ev => {
      const code = typeof ev.target?.result === 'string' ? ev.target.result : ''
      if (!code.trim()) {
        setUploadError('The selected file is empty.')
        return
      }
      setUploadedFileName(file.name)
      setUploadedCode(code)
      setUploadError('')
    }
    reader.readAsText(file)
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    readPythonFile(e.dataTransfer.files[0])
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => readPythonFile(e.target.files?.[0])

  const canStartUpload = uploadedCode.trim().length > 20

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Mode toggle header */}
      <div className="shrink-0 px-4 md:px-8 pt-5 pb-4 border-b border-black/[0.07] bg-white/60 backdrop-blur-sm">
        <div className="max-w-3xl">
          <h2 className="font-display font-black text-xl text-[#111118] uppercase tracking-tight mb-1">Experiment Setup</h2>
          <p className="text-[11px] text-slate-500 mb-4">Choose how to initiate this evaluation run.</p>
          <div className="relative inline-flex bg-slate-100 rounded-xl p-1 gap-0 w-full max-w-xl">
            <div className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm border border-black/[0.07] transition-all duration-300 ease-in-out pointer-events-none" style={{ left: indicatorLeft, width: indicatorWidth }} />
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setMode(tab.id)}
                className={`relative z-10 flex-1 py-2 rounded-lg text-[10px] font-mono tracking-wider transition-colors duration-200 whitespace-nowrap ${mode === tab.id ? `${tab.color} font-bold` : 'text-slate-400 hover:text-slate-600'}`}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
          <div className={`mt-3 text-[11px] leading-relaxed transition-all duration-200 ${modeColors[mode]}`}>
            {modeDescs[mode]}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {/* BENCHMARK MODE */}
        {mode === 'benchmark' && (
          <div className="absolute inset-0 flex animate-fade-in-up">
            <div className={`${mobileDetail ? 'hidden md:flex' : 'flex'} w-full md:w-[360px] shrink-0 border-r border-black/[0.07] flex-col bg-white/30`}>
              <div className="p-4 border-b border-black/[0.07] shrink-0">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search tasks by title or ID…"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-mono text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#1B3A6B]/40 mb-3" />
                <div className="flex flex-wrap gap-1.5">
                  {domainFilters.map(f => (
                    <button key={f.id} onClick={() => setFilter(f.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono transition-colors ${filter === f.id ? 'bg-[#1B3A6B] text-white' : 'bg-white text-slate-500 hover:text-slate-700 border border-slate-200'}`}>
                      {f.label} <span className={`text-[9px] ${filter === f.id ? 'text-white/60' : 'text-slate-400'}`}>{f.count}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {filtered.map(task => (
                  <button key={task.id} onClick={() => { setSelected(task); setMobileDetail(true) }}
                    className={`w-full text-left rounded-lg border p-3.5 transition-all ${selected?.id === task.id ? 'border-[#1B3A6B]/40 bg-[#1B3A6B]/5 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono text-[10px] text-slate-400">{task.id}</span>
                      <ComplexityPip level={task.complexity} />
                    </div>
                    <div className="font-display font-bold text-sm text-[#111118] mb-1.5 leading-tight">{task.title}</div>
                    <DomainBadge domain={task.domain} />
                  </button>
                ))}
                {filtered.length === 0 && <div className="text-center py-8 text-slate-400 font-mono text-xs">No tasks match "{search}"</div>}
              </div>
            </div>

            <div className={`${!mobileDetail && !selected ? 'hidden md:flex' : 'flex'} flex-1 flex-col overflow-hidden`}>
              {selected ? (
                <>
                  <div className="shrink-0 px-6 md:px-8 pt-5 pb-4 border-b border-black/[0.07] bg-[#F7F5F0]">
                    <button onClick={() => setMobileDetail(false)} className="md:hidden flex items-center gap-1.5 text-[11px] font-mono text-[#1B3A6B] mb-3">← Back</button>
                    <div className="flex items-center gap-2.5 mb-2">
                      <DomainBadge domain={selected.domain} />
                      <ComplexityPip level={selected.complexity} />
                      <span className="text-[10px] font-mono text-slate-400">{selected.id}</span>
                    </div>
                    <h3 className="font-display font-black text-2xl text-[#111118] uppercase tracking-tight">{selected.title}</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 md:px-8 py-4 space-y-3">
                    {[{ label: 'Task Description', value: selected.description }, { label: 'Expected Behavior', value: selected.expectedBehavior }].map(({ label, value }) => (
                      <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="text-[9px] font-mono text-[#1B3A6B] uppercase tracking-widest mb-1.5">{label}</div>
                        <p className="text-sm text-slate-700 leading-relaxed">{value}</p>
                      </div>
                    ))}
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <div className="text-[9px] font-mono text-amber-700 uppercase tracking-widest mb-1">Research Note</div>
                      <p className="text-xs text-amber-800 leading-relaxed">Security analysis results for this task are not shown until after the evaluation is complete. The generated code will be scanned based on the categories you select in the next step.</p>
                    </div>
                  </div>
                  <div className="shrink-0 px-6 md:px-8 py-4 border-t border-black/[0.07] bg-[#F7F5F0]">
                    <button onClick={() => onBenchmark(selected)}
                      className="w-full md:w-auto inline-flex items-center justify-center gap-3 px-8 py-3.5 bg-[#1B3A6B] hover:bg-[#15305A] text-white font-display font-bold uppercase tracking-widest text-sm rounded transition-all hover:scale-[1.02] shadow-sm">
                      Run Benchmark Task <span>→</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400">
                  <div className="text-center">
                    <div className="text-5xl mb-3 opacity-20 select-none">◫</div>
                    <p className="font-mono text-xs">Select a task to preview</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CUSTOM PROMPT MODE */}
        {mode === 'custom' && (
          <div className="absolute inset-0 overflow-y-auto animate-fade-in-up">
            <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-5">
              <div className="flex items-start gap-3 p-4 rounded-lg border border-violet-200 bg-violet-50">
                <span className="text-violet-500 mt-0.5 text-sm">◈</span>
                <div>
                  <div className="text-[10px] font-mono text-violet-700 uppercase tracking-widest mb-1">Exploratory Mode</div>
                  <p className="text-xs text-violet-800 leading-relaxed">Custom experiments use the same full pipeline — generate, scan, repair, review. Results are tracked separately and <strong>not included in controlled benchmark statistics</strong>, as arbitrary tasks may lack predefined functional tests or security ground truth.</p>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Your Python Programming Prompt</span>
                  <span className={`text-[10px] font-mono ${customText.length > 800 ? 'text-rose-500' : 'text-slate-400'}`}>{customText.length} / 1000</span>
                </div>
                <textarea value={customText} onChange={e => setCustomText(e.target.value.slice(0, 1000))}
                  placeholder="Describe the Python application, function, or utility for the demo generator…"
                  rows={6} className="w-full px-4 py-3 text-sm font-mono text-slate-700 placeholder-slate-400 bg-white focus:outline-none resize-none" />
                {customText && (
                  <div className="flex justify-end px-4 py-2 border-t border-slate-100">
                    <button onClick={() => setCustomText('')} className="text-[10px] font-mono text-slate-400 hover:text-rose-500 transition-colors">✕ Clear</button>
                  </div>
                )}
              </div>
              <div>
                <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-2">Example Prompts</div>
                <div className="space-y-2">
                  {EXAMPLE_PROMPTS.map((p, i) => (
                    <button key={i} onClick={() => setCustomText(p)}
                      className="w-full text-left p-3.5 rounded-lg border border-slate-200 bg-white hover:border-[#1B3A6B]/30 transition-all shadow-sm group">
                      <div className="flex items-start gap-2.5">
                        <span className="text-[10px] font-mono text-slate-400 mt-0.5 shrink-0">#{i + 1}</span>
                        <span className="text-xs text-slate-600 leading-relaxed group-hover:text-slate-800">{p}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <button disabled={customText.trim().length < 20} onClick={() => onCustom(customText.trim())}
                  className="w-full inline-flex items-center justify-center gap-3 px-8 py-3.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-25 disabled:cursor-not-allowed text-white font-display font-bold uppercase tracking-widest text-sm rounded transition-all hover:scale-[1.02] shadow-sm">
                  Generate From Custom Prompt <span>→</span>
                </button>
                {customText.length > 0 && customText.trim().length < 20 && <p role="alert" className="mt-2 text-[10px] font-mono text-rose-600">Add a little more detail — the prompt must contain at least 20 characters.</p>}
              </div>
            </div>
          </div>
        )}
        {/* UPLOAD MODE */}
        {mode === 'upload' && (
          <div className="absolute inset-0 overflow-y-auto animate-fade-in-up">
            <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-5">

              {/* Info banner */}
              <div className="flex items-start gap-3 p-4 rounded-lg border border-teal-200 bg-teal-50">
                <span className="text-teal-600 mt-0.5">⬡</span>
                <div>
                  <div className="text-[10px] font-mono text-teal-700 uppercase tracking-widest mb-1">Code Audit Mode — Exploratory</div>
                  <p className="text-xs text-teal-800 leading-relaxed">Upload or paste Python code to preview the complete analysis and repair workflow. Files stay in this browser and are <strong>not executed or sent to an external service</strong>.</p>
                </div>
              </div>

              {/* Drag-and-drop upload zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
                  dragOver ? 'border-teal-400 bg-teal-50' : uploadedFileName ? 'border-teal-300 bg-teal-50/50' : 'border-slate-300 bg-white hover:border-slate-400'
                }`}>
                {uploadedFileName ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center mb-1">
                      <span className="text-teal-700 text-xl font-mono">py</span>
                    </div>
                    <div className="font-mono text-sm font-bold text-[#111118]">{uploadedFileName}</div>
                    <div className="text-[10px] font-mono text-teal-700">{uploadedCode.split('\n').length} lines loaded</div>
                    <button onClick={() => { setUploadedFileName(''); setUploadedCode('') }}
                      className="text-[10px] font-mono text-slate-400 hover:text-rose-500 mt-1">✕ Remove</button>
                  </div>
                ) : (
                  <>
                    <div className="text-4xl mb-3 text-slate-300 select-none">⬡</div>
                    <div className="font-display font-black text-lg text-[#111118] uppercase tracking-tight mb-1">Upload Python Code</div>
                    <p className="text-xs text-slate-500 mb-4">Drag and drop a <span className="font-mono">.py</span> file here</p>
                    <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white text-[11px] font-mono text-slate-600 cursor-pointer transition-all hover:border-slate-300 hover:shadow-sm">
                      Browse Files
                      <input type="file" accept=".py" className="hidden" onChange={handleFileInput} />
                    </label>
                  </>
                )}
              </div>
              {uploadError && <p role="alert" className="-mt-3 text-[10px] font-mono text-rose-600">{uploadError}</p>}

              {/* Or paste code */}
              <div>
                <button onClick={() => setPasteOpen(o => !o)}
                  className="flex items-center gap-2 text-[11px] font-mono text-teal-700 hover:text-teal-900 transition-colors mb-2">
                  <span className={`text-[9px] transition-transform duration-200 ${pasteOpen ? 'rotate-90' : ''}`}>▶</span>
                  {pasteOpen ? 'Hide' : 'Or Paste Python Code'}
                </button>
                {pasteOpen && (
                  <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden animate-fade-in-up">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50">
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Paste Python Code</span>
                      <span className={`text-[10px] font-mono ${uploadedCode.length > 8000 ? 'text-rose-500' : 'text-slate-400'}`}>{uploadedCode.split('\n').length} lines</span>
                    </div>
                    <textarea value={uploadedCode} onChange={e => { setUploadedCode(e.target.value); setUploadedFileName(''); setUploadError('') }}
                      placeholder="# Paste your Python code here…"
                      rows={10} className="w-full px-4 py-3 text-[11px] font-mono text-slate-700 placeholder-slate-300 bg-white focus:outline-none resize-none" />
                  </div>
                )}
              </div>

              {/* Optional context */}
              <div>
                <button onClick={() => setOptionalOpen(o => !o)}
                  className="flex items-center gap-2 text-[11px] font-mono text-slate-500 hover:text-slate-700 transition-colors mb-2">
                  <span className={`text-[9px] transition-transform duration-200 ${optionalOpen ? 'rotate-90' : ''}`}>▶</span>
                  Optional Context <span className="text-[9px] text-slate-400">(expected behaviour · test file · dependencies)</span>
                </button>
                {optionalOpen && (
                  <div className="space-y-3 animate-fade-in-up">
                    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <div className="px-4 py-2 border-b border-slate-100 bg-slate-50">
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Expected Behaviour <span className="normal-case text-slate-300">(optional)</span></span>
                      </div>
                      <textarea value={expectedBehavior} onChange={e => setExpectedBehavior(e.target.value)}
                        placeholder="This script should search users in a SQLite database by username and role."
                        rows={3} className="w-full px-4 py-3 text-sm text-slate-700 placeholder-slate-400 bg-white focus:outline-none resize-none" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Test File <span className="normal-case text-slate-300">(optional)</span></span>
                          {testFileName && <span className="text-[10px] font-mono text-teal-700">{testFileName}</span>}
                        </div>
                        <label className="flex items-center gap-3 px-4 py-3 cursor-pointer group">
                          <div className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 group-hover:bg-white flex items-center justify-center shrink-0">
                            <span className="text-slate-400 text-sm">+</span>
                          </div>
                          <span className="text-xs text-slate-500 font-mono">{testFileName || 'Supports test_*.py'}</span>
                          <input type="file" accept=".py" className="hidden" onChange={e => setTestFileName(e.target.files?.[0]?.name ?? '')} />
                        </label>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50">
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Dependencies <span className="normal-case text-slate-300">(optional)</span></span>
                        </div>
                        <input value={dependencies} onChange={e => setDependencies(e.target.value)}
                          placeholder="flask, requests, pandas"
                          className="w-full px-4 py-3 text-sm font-mono text-slate-700 placeholder-slate-400 bg-white focus:outline-none" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pipeline quick info */}
              <div className="rounded-lg border border-slate-200 bg-white/70 px-5 py-4 shadow-sm">
                <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-2">Code Audit Pipeline</p>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-500">
                  {['Upload Code', 'Functional Analysis', 'Select Scans', 'Security Analysis', 'Select Repair', 'Repair', 'Verify', 'Review', 'Results'].map((s, i, arr) => (
                    <span key={s} className="flex items-center gap-1.5">
                      <span className="text-teal-700">{s}</span>
                      {i < arr.length - 1 && <span className="text-slate-300">→</span>}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <button disabled={!canStartUpload} onClick={() => onUpload(uploadedCode, { fileName: uploadedFileName, expectedBehavior, dependencies, testFileName, hasTests: !!testFileName })}
                  className="w-full inline-flex items-center justify-center gap-3 px-8 py-3.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-25 disabled:cursor-not-allowed text-white font-display font-bold uppercase tracking-widest text-sm rounded transition-all hover:scale-[1.02] shadow-sm">
                  Start Code Analysis <span>→</span>
                </button>
                {!canStartUpload && <p className="mt-2 text-[10px] font-mono text-slate-500">Load or paste at least 20 characters of Python code to continue.</p>}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Screen 2: Code Generation ────────────────────────────────────────────────

function CodeGenerationScreen({ mode, task, customPrompt, uploadedCode, uploadMeta, onDone }: { mode: Mode; task: BenchmarkTask | null; customPrompt: string; uploadedCode: string; uploadMeta: UploadMeta | null; onDone: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'generating' | 'done'>(() => mode === 'upload' ? 'done' : 'idle')
  const [dots, setDots] = useState('')

  useEffect(() => {
    if (phase !== 'generating') return
    const iv = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    const t = setTimeout(() => { clearInterval(iv); setPhase('done') }, 3400)
    return () => { clearInterval(iv); clearTimeout(t) }
  }, [phase])

  // Upload mode: show functional analysis context + uploaded code preview
  if (mode === 'upload') {
    const hasTests = !!uploadMeta?.testFileName
    const hasExpected = !!uploadMeta?.expectedBehavior
    const confidence = hasTests && hasExpected ? 'High' : hasTests || hasExpected ? 'Medium' : 'Limited'
    const confidenceColor = confidence === 'High' ? 'text-emerald-700' : confidence === 'Medium' ? 'text-amber-700' : 'text-slate-500'
    const displayCode = uploadedCode || SAMPLE_CODE

    return (
      <div className="min-h-[calc(100vh-56px)] px-4 md:px-10 py-8 max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-mono text-teal-700 uppercase tracking-widest">Code Audit Mode</span>
            <ModeBadge mode="upload" />
            {uploadMeta?.fileName && <span className="text-[9px] font-mono text-slate-400">{uploadMeta.fileName}</span>}
          </div>
          <div className="font-display font-black text-lg text-[#111118] uppercase tracking-tight mb-1">Existing Code Analysis</div>
          <p className="text-xs text-slate-600 leading-relaxed">Uploaded code is ready for security analysis. Code generation step skipped — proceeding directly to functional analysis and scan configuration.</p>
        </div>

        {/* Functional analysis context */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Functional Context</span>
            <span className={`text-[10px] font-mono font-bold ${confidenceColor}`}>Verification Confidence: {confidence}</span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-100 p-0">
            {[
              { l: 'Tests Provided', v: hasTests ? 'Yes' : 'No', ok: hasTests },
              { l: 'Expected Behaviour', v: hasExpected ? 'Yes' : 'No', ok: hasExpected },
              { l: 'Dependencies', v: uploadMeta?.dependencies || 'Not specified', ok: !!uploadMeta?.dependencies },
            ].map(item => (
              <div key={item.l} className="px-4 py-3 text-center">
                <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-1">{item.l}</div>
                <div className={`font-mono text-sm font-bold ${item.ok ? 'text-emerald-700' : 'text-slate-400'}`}>{item.v}</div>
              </div>
            ))}
          </div>
          {!hasTests && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-amber-50/60">
              <p className="text-[10px] font-mono text-amber-700">No test file provided — functional verification confidence is limited. Repair correctness assessment will rely on static analysis and reviewer evaluation.</p>
            </div>
          )}
        </div>

        {/* Uploaded code preview */}
        <div className="animate-fade-in-up space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
            <span className="text-teal-600">✓</span>
            <span className="font-mono text-sm text-teal-700">{uploadMeta?.fileName ? `${uploadMeta.fileName} loaded` : 'Code pasted successfully'}</span>
            <span className="ml-auto text-[10px] font-mono text-slate-400">{displayCode.split('\n').length} lines · no LLM generation</span>
          </div>
          <CodePanel code={displayCode} title={uploadMeta?.fileName || 'uploaded_code.py'} highlights={[9, 10, 11, 12, 13]} />
          <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
            <span className="text-amber-600 mt-0.5">⚠</span>
            <p className="text-xs text-slate-600 leading-relaxed">Deterministic sample findings are ready for this code preview. Configure the demo scan next; token, cost, and latency values are illustrative.</p>
          </div>
          <button onClick={onDone}
            className="inline-flex items-center gap-3 px-7 py-3.5 bg-teal-700 hover:bg-teal-800 text-white font-display font-bold uppercase tracking-widest text-sm rounded transition-all hover:scale-[1.02] shadow-sm">
            Configure Security Scan <span>→</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-56px)] px-4 md:px-10 py-8 max-w-4xl mx-auto space-y-5">
      {mode === 'benchmark' && task ? (
        <div className="rounded-lg border border-[#1B3A6B]/20 bg-[#1B3A6B]/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-mono text-[#1B3A6B] uppercase tracking-widest">Benchmark Task</span>
            <span className="text-[9px] font-mono text-slate-400">{task.id}</span>
            <DomainBadge domain={task.domain} />
          </div>
          <div className="font-display font-black text-lg text-[#111118] uppercase tracking-tight">{task.title}</div>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{task.description}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-mono text-violet-700 uppercase tracking-widest">Custom Prompt</span>
            <ModeBadge mode="custom" />
          </div>
          <p className="text-sm text-slate-700 font-mono leading-relaxed line-clamp-3">{customPrompt}</p>
        </div>
      )}

      {phase === 'idle' && (
        <div className="animate-fade-in-up rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-[#1B3A6B]/8 border border-[#1B3A6B]/15 flex items-center justify-center mx-auto mb-4">
            <span className="text-[#1B3A6B] text-xl">⚡</span>
          </div>
          <p className="text-slate-500 text-sm mb-1">Ready to generate code</p>
          <p className="text-slate-400 text-xs font-mono mb-7">Local deterministic demo · no API key</p>
          <button onClick={() => setPhase('generating')}
            className="inline-flex items-center gap-3 px-7 py-3.5 bg-[#1B3A6B] hover:bg-[#15305A] text-white font-display font-bold uppercase tracking-widest text-sm rounded transition-all hover:scale-[1.02] shadow-sm">
            Generate Code
          </button>
        </div>
      )}

      {phase === 'generating' && (
        <div className="animate-fade-in-up rounded-lg border border-[#1B3A6B]/20 bg-[#1B3A6B]/5 p-10 text-center">
          <div className="flex justify-center gap-2 mb-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2.5 h-2.5 rounded-full bg-[#1B3A6B]"
                style={{ animation: `bounce-stagger 1.2s ease-in-out ${i * 0.16}s infinite` }} />
            ))}
          </div>
          <p className="font-mono text-sm text-[#1B3A6B]">Generating sample code{dots}</p>
          <p className="text-slate-400 text-[11px] font-mono mt-1">Local deterministic demo · no API key</p>
        </div>
      )}

      {phase === 'done' && (
        <div className="animate-fade-in-up space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <span className="text-emerald-600">✓</span>
            <span className="font-mono text-sm text-emerald-700">Code generated successfully</span>
            <span className="ml-auto text-[10px] font-mono text-slate-400">{GENERATION_USAGE.latency}s · {GENERATION_USAGE.total.toLocaleString()} tokens</span>
          </div>
          <UsageRow label="Sample Usage — Code Generation" input={GENERATION_USAGE.input} output={GENERATION_USAGE.output} total={GENERATION_USAGE.total} cost={GENERATION_USAGE.cost} latency={GENERATION_USAGE.latency} />
          <CodePanel code={SAMPLE_CODE} title="generated_code.py · Demo Output" highlights={[9, 10, 11, 12, 13]} />
          <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
            <span className="text-amber-600 mt-0.5">⚠</span>
            <p className="text-xs text-slate-600 leading-relaxed">Preliminary static check suggests potential security issues on lines 9–13. Configure your security scan in the next step.</p>
          </div>
          <button onClick={onDone}
            className="inline-flex items-center gap-3 px-7 py-3.5 bg-[#1B3A6B] hover:bg-[#15305A] text-white font-display font-bold uppercase tracking-widest text-sm rounded transition-all hover:scale-[1.02] shadow-sm">
            Configure Security Scan <span>→</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Screen 3: Scan Selection ─────────────────────────────────────────────────

function ScanSelectionScreen({ onDone, initialSelected }: { onDone: (scans: ScanCategoryId[]) => void; initialSelected: ScanCategoryId[] }) {
  const [selected, setSelected] = useState<Set<ScanCategoryId>>(() => new Set(initialSelected))

  const toggle = (id: ScanCategoryId) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const selectAll = () => setSelected(new Set(SCAN_CATEGORIES.map(c => c.id)))

  return (
    <div className="min-h-[calc(100vh-56px)] px-4 md:px-10 py-8 max-w-5xl mx-auto">
      <h2 className="font-display font-black text-xl md:text-2xl text-[#111118] uppercase tracking-tight mb-1">Configure Security Scan</h2>
      <p className="text-sm text-slate-500 mb-2 max-w-xl leading-relaxed">Select which security categories to scan for. Multiple categories can be active simultaneously — generated code may contain more than one vulnerability type.</p>
      <p className="text-[11px] font-mono text-slate-400 mb-6">Demo analysis uses deterministic sample findings modelled after Bandit and Semgrep output.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {SCAN_CATEGORIES.map(cat => {
          const isSel = selected.has(cat.id)
          return (
            <button key={cat.id} onClick={() => toggle(cat.id)}
              className={`text-left rounded-lg border p-5 transition-all ${isSel ? 'border-[#1B3A6B]/40 bg-[#1B3A6B]/5 ring-1 ring-[#1B3A6B]/15 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}>
              <div className="flex items-start justify-between mb-3">
                <span className={`text-2xl select-none transition-colors ${isSel ? 'text-[#1B3A6B]' : 'text-slate-300'}`}>{cat.icon}</span>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSel ? 'border-[#1B3A6B] bg-[#1B3A6B]' : 'border-slate-300'}`}>
                  {isSel && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                </div>
              </div>
              <div className={`font-display font-black text-base uppercase tracking-tight mb-1 ${isSel ? 'text-[#1B3A6B]' : 'text-[#111118]'}`}>{cat.title}</div>
              <p className="text-xs text-slate-500 leading-relaxed">{cat.desc}</p>
            </button>
          )
        })}

        <button onClick={selectAll}
          className={`text-left rounded-lg border p-5 transition-all ${selected.size === 5 ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200 shadow-sm' : 'border-dashed border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white'}`}>
          <div className="text-2xl select-none mb-3 text-slate-400">⊕</div>
          <div className="font-display font-black text-base uppercase tracking-tight text-slate-700 mb-1">Scan All Categories</div>
          <p className="text-xs text-slate-500 leading-relaxed">Enable all five security categories for the most comprehensive analysis.</p>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-slate-200 bg-white shadow-sm mb-6">
        <div>
          <span className="font-display font-black text-lg text-[#111118]">{selected.size}</span>
          <span className="text-sm text-slate-500 font-mono ml-1">of 5 categories selected</span>
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {SCAN_CATEGORIES.filter(c => selected.has(c.id)).map(c => (
                <span key={c.id} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1B3A6B]/5 text-[#1B3A6B] border border-[#1B3A6B]/15">{c.title}</span>
              ))}
            </div>
          )}
        </div>
        <button disabled={selected.size === 0} onClick={() => onDone(Array.from(selected))}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-7 py-3.5 bg-[#1B3A6B] hover:bg-[#15305A] disabled:opacity-25 disabled:cursor-not-allowed text-white font-display font-bold uppercase tracking-widest text-sm rounded transition-all hover:scale-[1.02] shadow-sm shrink-0">
          Run Security Analysis <span>→</span>
        </button>
      </div>
    </div>
  )
}

// ─── Screen 4: Security Analysis ─────────────────────────────────────────────

function AnalysisScreen({ mode, task, scans, onDone, onBack }: { mode: Mode; task: BenchmarkTask | null; scans: ScanCategoryId[]; onDone: () => void; onBack: () => void }) {
  const [scanPhase, setScanPhase] = useState<Record<string, 'queued' | 'scanning' | 'done'>>({})
  const [activeFind, setActiveFind] = useState<number | null>(null)
  const [runState, setRunState] = useState<'running' | 'success' | 'failed' | 'cancelled'>('running')
  const [attempt, setAttempt] = useState(0)
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([])

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  useEffect(() => {
    clearTimers()
    const init: Record<string, 'queued' | 'scanning' | 'done'> = {}
    scans.forEach(s => { init[s] = 'queued' })
    setScanPhase(init)
    setActiveFind(null)
    setRunState('running')

    scans.forEach((s, i) => {
      timers.current.push(setTimeout(() => setScanPhase(p => ({ ...p, [s]: 'scanning' })), i * 600 + 300))
      timers.current.push(setTimeout(() => setScanPhase(p => ({ ...p, [s]: 'done' })), i * 600 + 1600))
    })
    timers.current.push(setTimeout(() => setRunState('success'), scans.length * 600 + 1750))
    return clearTimers
  }, [attempt, scans])

  const stopRun = (state: 'failed' | 'cancelled') => {
    clearTimers()
    setRunState(state)
  }

  const allDone = runState === 'success' && scans.length > 0 && scans.every(s => scanPhase[s] === 'done')

  const findings = ([
    { id: 0, cat: 'injection', sev: 'HIGH', title: 'Injection', line: 9, tool: 'Bandit B608', msg: 'String-formatted SQL query — use parameterized queries.' },
    { id: 1, cat: 'injection', sev: 'HIGH', title: 'Injection', line: 12, tool: 'Semgrep', msg: 'Detected formatted-sql-query pattern on lines 9–13.' },
    { id: 2, cat: 'secrets', sev: 'MEDIUM', title: 'Secrets Exposure', line: 1, tool: 'Bandit B105', msg: "Variable named 'password' assigned a string literal — possible hardcoded secret." },
  ] satisfies readonly FindingFixture[]).filter(f => scans.includes(f.cat))

  const catStatus: Record<string, 'detected' | 'clean'> = {}
  scans.forEach(s => { catStatus[s] = findings.some(f => f.cat === s) ? 'detected' : 'clean' })

  return (
    <div className="min-h-[calc(100vh-56px)] px-4 md:px-10 py-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-black text-xl md:text-2xl text-[#111118] uppercase tracking-tight">Security Analysis</h2>
        <ModeBadge mode={mode} />
      </div>

      {/* Animated scan progress */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-4">Scan Progress</div>
        <div className="space-y-3">
          {scans.map(s => {
            const cat = SCAN_CATEGORIES.find(c => c.id === s)!
            const phase = scanPhase[s] || 'queued'
            const result = phase === 'done' ? catStatus[s] : null
            return (
              <div key={s} className="flex items-center gap-3">
                <span className={`text-lg transition-colors ${phase === 'done' ? (result === 'detected' ? 'text-rose-500' : 'text-emerald-500') : phase === 'scanning' ? 'text-[#1B3A6B]' : 'text-slate-300'}`}>{cat.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-mono text-slate-700">{cat.title}</span>
                    <span className={`text-[10px] font-mono ${phase === 'done' ? (result === 'detected' ? 'text-rose-600' : 'text-emerald-600') : phase === 'scanning' ? 'text-[#1B3A6B]' : 'text-slate-400'}`}>
                      {phase === 'done' ? (result === 'detected' ? '● Detected' : '✓ No Finding') : phase === 'scanning' ? 'Scanning…' : '○ Queued'}
                    </span>
                  </div>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${phase === 'done' ? (result === 'detected' ? 'bg-rose-400 w-full' : 'bg-emerald-400 w-full') : phase === 'scanning' ? 'bg-[#1B3A6B] scan-beam' : 'w-0'}`} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {runState === 'running' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#1B3A6B]/15 bg-[#1B3A6B]/5 px-4 py-3">
          <p className="text-[10px] font-mono text-[#1B3A6B]">Deterministic local simulation · no uploaded code is executed</p>
          <div className="flex gap-2">
            <button onClick={() => stopRun('failed')} className="text-[10px] font-mono text-slate-500 hover:text-rose-600 transition-colors">Preview error state</button>
            <button onClick={() => stopRun('cancelled')} className="px-3 py-1.5 rounded border border-slate-200 bg-white text-[10px] font-mono text-slate-600 hover:border-slate-300">Cancel analysis</button>
          </div>
        </div>
      )}

      {(runState === 'failed' || runState === 'cancelled') && (
        <div role="alert" className={`animate-fade-in-up rounded-lg border p-5 shadow-sm ${runState === 'failed' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className={`font-display font-black text-lg uppercase tracking-tight ${runState === 'failed' ? 'text-rose-700' : 'text-amber-700'}`}>
            {runState === 'failed' ? 'Demo analysis interrupted' : 'Analysis cancelled'}
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {runState === 'failed' ? 'The local simulation stopped before results were produced. No code was executed or uploaded.' : 'This sample run was cancelled. Your selected categories are still available.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => setAttempt(value => value + 1)} className="px-4 py-2 rounded bg-[#1B3A6B] text-white text-[11px] font-mono hover:bg-[#15305A]">Retry analysis</button>
            <button onClick={onBack} className="px-4 py-2 rounded border border-slate-200 bg-white text-slate-600 text-[11px] font-mono hover:border-slate-300">Change categories</button>
          </div>
        </div>
      )}
      {allDone && (
        <div className="animate-fade-in-up space-y-5">
          {/* Findings summary */}
          <div className={`flex items-center gap-4 p-4 rounded-lg border shadow-sm ${findings.length > 0 ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <span className={`text-2xl font-display font-black ${findings.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{findings.length}</span>
            <div>
              <div className={`text-[10px] font-mono uppercase tracking-widest ${findings.length > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {findings.length > 0 ? `Finding${findings.length > 1 ? 's' : ''} Detected` : 'No Findings'}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {findings.length > 0 ? `${findings.filter(f => f.sev === 'HIGH').length} high · ${findings.filter(f => f.sev === 'MEDIUM').length} medium severity` : 'Code appears clean for selected scan categories.'}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {scans.map(s => {
                const cat = SCAN_CATEGORIES.find(c => c.id === s)!
                return <StatusChip key={s} ok={catStatus[s] === 'clean'} label={cat.title} />
              })}
            </div>
          </div>

          {/* Finding cards */}
          {findings.length > 0 && (
            <div>
              <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-2">Findings — click to highlight code</div>
              <div className="space-y-2">
                {findings.map(f => (
                  <button key={f.id} onClick={() => setActiveFind(activeFind === f.id ? null : f.id)}
                    className={`w-full text-left rounded-lg border overflow-hidden shadow-sm transition-all ${activeFind === f.id ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200 hover:border-rose-200'} bg-white`}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${f.sev === 'HIGH' ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-amber-700 bg-amber-50 border-amber-200'}`}>{f.sev}</span>
                      <span className="font-mono text-sm font-bold text-[#111118]">{f.title}</span>
                      <span className="text-[10px] font-mono text-slate-400 ml-auto">line {f.line} · {f.tool}</span>
                    </div>
                    {activeFind === f.id && (
                      <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
                        <p className="text-xs text-slate-600 leading-relaxed mb-2">{f.msg}</p>
                        <CodePanel code={SAMPLE_CODE} highlights={[f.line]} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}


          <div className="flex items-center gap-4 p-4 rounded-lg border border-amber-200 bg-amber-50 shadow-sm">
            <StatusChip ok={true} label="Functional" />
            <StatusChip ok={findings.length === 0} label="Security" />
            <p className="text-xs text-amber-800 font-mono leading-relaxed flex-1 ml-2">
              <strong>Functional code is not necessarily secure.</strong> {findings.length > 0 ? `${findings.length} issue${findings.length > 1 ? 's' : ''} found — proceed to repair.` : 'No issues detected for selected categories.'}
            </p>
          </div>

          <button onClick={onDone}
            className="inline-flex items-center gap-3 px-7 py-3.5 bg-[#1B3A6B] hover:bg-[#15305A] text-white font-display font-bold uppercase tracking-widest text-sm rounded transition-all hover:scale-[1.02] shadow-sm">
            Select Repair Strategy <span>→</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Screen 5: Repair Strategy ────────────────────────────────────────────────

function RepairStrategyScreen({ onSelect, initialSelected }: { onSelect: (strategies: StrategyId[]) => void; initialSelected: StrategyId[] }) {
  const [selected, setSelected] = useState<Set<StrategyId>>(() => new Set(initialSelected))
  const strategies = STRATEGY_IDS

  const toggle = (id: StrategyId) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAll = () => setSelected(new Set(strategies))

  return (
    <div className="min-h-[calc(100vh-56px)] px-4 md:px-10 py-8 max-w-5xl mx-auto">
      <h2 className="font-display font-black text-xl md:text-2xl text-[#111118] uppercase tracking-tight mb-1">Choose Repair Strategy</h2>
      <p className="text-sm text-slate-500 mb-6 max-w-xl leading-relaxed">Select one or more deterministic demo strategies. Each card shows the sample context used to produce its local comparison result.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7">
        {strategies.map(id => {
          const s = STRATEGY_META[id]
          const isSel = selected.has(id)
          return (
            <button key={id} onClick={() => toggle(id)}
              className={`text-left rounded-lg border p-5 transition-all ${isSel ? 'border-[#1B3A6B]/40 bg-[#1B3A6B]/5 ring-1 ring-[#1B3A6B]/15 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}>
              <div className="flex items-start justify-between mb-4">
                <span className={`text-xl select-none ${isSel ? 'text-[#1B3A6B]' : 'text-slate-300'}`}>{s.icon}</span>
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSel ? 'border-[#1B3A6B] bg-[#1B3A6B]' : 'border-slate-300'}`}>
                  {isSel && <span className="text-white text-[10px] font-bold">✓</span>}
                </div>
              </div>
              <div className="font-display font-black text-base text-[#111118] uppercase tracking-tight mb-0.5">{s.title}</div>
              <div className="text-[10px] font-mono text-[#1B3A6B] mb-3 uppercase tracking-wider">{s.sub}</div>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">{s.desc}</p>
              <div className="rounded border border-slate-200 bg-slate-50 p-3">
                <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-1">Sample repair context</div>
                <p className="text-[10px] font-mono text-slate-500 leading-relaxed">{s.prompt}</p>
              </div>
            </button>
          )
        })}

        <button onClick={selectAll}
          className={`text-left rounded-lg border p-5 transition-all ${selected.size === 3 ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200 shadow-sm' : 'border-dashed border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white'}`}>
          <div className="mb-4"><span className="text-xl select-none text-slate-400">⊕</span></div>
          <div className="font-display font-black text-base text-[#111118] uppercase tracking-tight mb-0.5">Run All Strategies</div>
          <div className="text-[10px] font-mono text-[#1B3A6B] mb-3 uppercase tracking-wider">Full benchmark comparison</div>
          <p className="text-xs text-slate-600 leading-relaxed">Run all three fixed repair strategies on the same vulnerable code. Produces the most complete side-by-side research comparison.</p>
        </button>
      </div>

      <button disabled={selected.size === 0} onClick={() => onSelect(Array.from(selected))}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-7 py-3.5 bg-[#1B3A6B] hover:bg-[#15305A] disabled:opacity-25 disabled:cursor-not-allowed text-white font-display font-bold uppercase tracking-widest text-sm rounded transition-all hover:scale-[1.02] shadow-sm">
        Run Security Repair {selected.size > 0 && `(${selected.size})`} <span>→</span>
      </button>
    </div>
  )
}

// ─── Screen 6: Repair Comparison ─────────────────────────────────────────────

type BranchStage = 'idle' | 'repairing' | 'testing' | 'rescanning' | 'reviewing' | 'done'

const BRANCH_STAGE_ORDER: BranchStage[] = ['repairing', 'testing', 'rescanning', 'reviewing', 'done']

const STAGE_LABELS: Record<BranchStage, string> = {
  idle: 'Queued', repairing: 'Repairing…', testing: 'Functional Test…',
  rescanning: 'Re-scanning…', reviewing: 'AI Review…', done: 'Complete',
}

const RESCAN_DATA: Record<StrategyId, Array<{ title: string; fixed: boolean }>> = {
  test_feedback_v1:  [
    { title: 'Injection',       fixed: true  },
    { title: 'Secrets Exposure',    fixed: false },
  ],
  vulnerability_specific_v1: [
    { title: 'Injection',       fixed: true  },
    { title: 'Secrets Exposure',    fixed: true  },
  ],
  scanner_feedback_v1:  [
    { title: 'Injection',       fixed: true  },
    { title: 'Secrets Exposure',    fixed: true  },
  ],
}

const REVIEWER_DATA: Record<StrategyId, { verdict: 'Accepted' | 'Accepted with concerns' | 'Rejected'; notes: string }> = {
  test_feedback_v1:  { verdict: 'Rejected',              notes: 'Functional regression detected (3/12 tests failed). One hardcoded secret finding remains unresolved. Repair introduced unintended changes to non-vulnerable code paths.' },
  vulnerability_specific_v1: { verdict: 'Accepted',              notes: 'All identified vulnerabilities appear addressed. Functionality preserved. Targeted changes limited to SQL query construction logic.' },
  scanner_feedback_v1:  { verdict: 'Accepted',              notes: 'All scanner-flagged issues resolved. Functionality preserved with no regression. Additional cleanup of connection handling is appropriate and safe.' },
}

function BranchCard({ id, stage }: { id: StrategyId; stage: BranchStage }) {
  const s = STRATEGY_META[id]
  const isDone = stage === 'done'
  const score = STRATEGY_SCORES[id].score
  const ok = STRATEGY_SCORES[id].scannerClean && !STRATEGY_SCORES[id].regression

  const stageIdx = BRANCH_STAGE_ORDER.indexOf(stage)

  return (
    <div className={`flex-1 min-w-[160px] rounded-lg border p-4 transition-all duration-500 ${isDone ? (ok ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60') : 'border-[#1B3A6B]/20 bg-[#1B3A6B]/5'}`}>
      <div className={`text-[10px] font-mono mb-1 font-bold ${isDone ? (ok ? 'text-emerald-700' : 'text-rose-700') : 'text-[#1B3A6B]'}`}>{s.title}</div>
      <div className="text-[9px] font-mono text-slate-400 mb-3">{s.sub}</div>
      <div className="space-y-1.5">
        {BRANCH_STAGE_ORDER.slice(0, 4).map((st, i) => {
          const active = stageIdx === i
          const complete = stageIdx > i
          return (
            <div key={st} className="flex items-center gap-2">
              <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-all duration-300 ${
                complete ? 'border-[#1B3A6B] bg-[#1B3A6B]' : active ? 'border-[#1B3A6B] bg-[#1B3A6B]/20' : 'border-slate-200 bg-white'
              }`}>
                {complete && <span className="text-white text-[8px] font-bold leading-none">✓</span>}
                {active && <span className="w-1.5 h-1.5 rounded-full bg-[#1B3A6B] animate-pulse block" />}
              </div>
              <span className={`text-[9px] font-mono ${complete ? 'text-[#1B3A6B]' : active ? 'text-[#1B3A6B] font-bold' : 'text-slate-300'}`}>
                {STAGE_LABELS[st]}
              </span>
            </div>
          )
        })}
      </div>
      {isDone && (
        <div className="mt-3 pt-3 border-t border-black/[0.07]">
          <div className={`font-display font-black text-2xl ${ok ? 'text-emerald-700' : 'text-rose-600'}`}>{score}</div>
          <div className="text-[9px] font-mono text-slate-400">/ 100</div>
        </div>
      )}
    </div>
  )
}

function ComparisonScreen({ mode, strategies, onDone }: { mode: Mode; strategies: StrategyId[]; onDone: () => void }) {
  const [branchStages, setBranchStages] = useState<Record<string, BranchStage>>(() => {
    const init: Record<string, BranchStage> = {}
    strategies.forEach(id => { init[id] = 'idle' })
    return init
  })
  const [activeTab, setActiveTab] = useState<StrategyId>(strategies[0] || 'test_feedback_v1')
  const [showDiff, setShowDiff] = useState(false)

  const allDone = strategies.every(id => branchStages[id] === 'done')

  useEffect(() => {
    const branchTimers: Array<ReturnType<typeof setTimeout>> = []
    strategies.forEach((id, i) => {
      const stagger = i * 300
      const advance = (stage: BranchStage, delay: number) => {
        branchTimers.push(setTimeout(() => setBranchStages(prev => ({ ...prev, [id]: stage })), stagger + delay))
      }
      advance('repairing', 200)
      advance('testing', 1100)
      advance('rescanning', 2100)
      advance('reviewing', 3000)
      advance('done', 3900)
    })
    return () => branchTimers.forEach(clearTimeout)
  }, [strategies])

  const res = STRATEGY_SCORES[activeTab]
  const reviewer = REVIEWER_DATA[activeTab]
  const rescan = RESCAN_DATA[activeTab]

  return (
    <div className="min-h-[calc(100vh-56px)] px-4 md:px-10 py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-black text-xl md:text-2xl text-[#111118] uppercase tracking-tight">Repair Comparison</h2>
        <ModeBadge mode={mode} />
      </div>

      {/* Branch diagram — always visible */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm mb-5">
        <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-4">Parallel Repair Branches</div>
        <div className="flex flex-col items-center gap-3">
          {/* Root */}
          <div className="px-5 py-2 rounded border border-[#1B3A6B]/30 bg-[#1B3A6B]/5 text-[11px] font-mono text-[#1B3A6B] shadow-sm">
            Original Vulnerable Code
          </div>
          <div className="w-full overflow-x-auto pb-1">
            <div className={strategies.length > 1 ? 'min-w-[520px]' : ''}>
              {/* Connector lines */}
              <div className="relative flex w-full justify-center" style={{ height: 24 }}>
                <div className="absolute top-0 left-1/2 w-px h-full bg-slate-300 -translate-x-1/2" />
                <div className="absolute top-1/2 left-[16%] right-[16%] h-px bg-slate-300" />
                {strategies.length > 1 && strategies.map((_, i) => {
                  const pct = strategies.length === 1 ? 50 : 16 + (i / (strategies.length - 1)) * 68
                  return <div key={i} className="absolute bottom-0 w-px h-1/2 bg-slate-300" style={{ left: `${pct}%` }} />
                })}
              </div>
              {/* Branch cards */}
              <div className="flex gap-3 w-full">
                {strategies.map(id => (
                  <BranchCard key={id} id={id} stage={branchStages[id] || 'idle'} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {!allDone && (
          <div className="mt-4 flex items-center gap-2 text-[11px] font-mono text-[#1B3A6B]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1B3A6B] animate-pulse" />
            Running {strategies.length} repair strateg{strategies.length > 1 ? 'ies' : 'y'} in parallel…
          </div>
        )}
      </div>

      {allDone && (
        <div className="animate-fade-in-up space-y-5">
          {/* Strategy tabs */}
          <div className="flex gap-0 border-b border-slate-200 overflow-x-auto">
            {strategies.map(id => {
              const sc = STRATEGY_SCORES[id]
              return (
                <button key={id} onClick={() => { setActiveTab(id); setShowDiff(false) }}
                  className={`px-4 py-2.5 text-[11px] font-mono whitespace-nowrap border-b-2 -mb-px transition-all ${activeTab === id ? 'text-[#1B3A6B] border-[#1B3A6B]' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
                  {STRATEGY_META[id].title}
                  <span className={`ml-1.5 text-[9px] px-1 py-0.5 rounded ${activeTab === id ? 'bg-[#1B3A6B] text-white' : 'bg-slate-100 text-slate-500'}`}>{sc.score}</span>
                </button>
              )
            })}
          </div>

          {/* Active strategy detail */}
          <div className="space-y-4">
            {/* Status chips */}
            <div className="flex flex-wrap gap-2">
              <StatusChip ok={true} label={`Functional ${res.functional}`} />
              <StatusChip ok={res.fixed === '3/3'} label={`Fixed ${res.fixed}`} />
              <StatusChip ok={res.scannerClean} label="Scanner Clean" />
              <StatusChip ok={!res.regression} label="No Regression" />
              <StatusChip ok={reviewer.verdict !== 'Rejected'} label={`Reviewer: ${reviewer.verdict}`} />
            </div>

            {/* Code panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[9px] font-mono text-rose-600 uppercase tracking-widest mb-2">Original · Vulnerable</div>
                <CodePanel code={SAMPLE_CODE} title="original.py" highlights={[9, 10, 11, 12, 13]} />
              </div>
              <div>
                <div className="text-[9px] font-mono text-emerald-600 uppercase tracking-widest mb-2">Repaired · {STRATEGY_META[activeTab].title}</div>
                <CodePanel code={REPAIRED_CODES[activeTab]} title={`repaired_${activeTab}.py`} />
              </div>
            </div>

            <button onClick={() => setShowDiff(d => !d)}
              className="text-[11px] font-mono text-[#1B3A6B] hover:underline flex items-center gap-1.5">
              {showDiff ? '▼' : '▶'} View Diff
            </button>
            {showDiff && <DiffPanel original={SAMPLE_CODE} repaired={REPAIRED_CODES[activeTab]} />}

            {/* Re-scan results */}
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Re-scan Results</span>
                <span className="ml-3 text-[9px] font-mono text-slate-400">Deterministic sample scanner output</span>
              </div>
              <div className="p-4 space-y-3">
                {rescan.map(item => (
                  <div key={item.title} className="flex items-center gap-4">
                    <span className="text-[11px] font-mono text-slate-600 w-40 shrink-0">{item.title}</span>
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-[10px] font-mono text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded shrink-0">Before ✗</span>
                      <div className="h-px flex-1 bg-slate-200 relative">
                        <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-center">
                          <span className="text-[8px] font-mono text-slate-400">→</span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded shrink-0 border ${item.fixed ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-600 bg-rose-50 border-rose-200'}`}>
                        {item.fixed ? 'After ✓ Fixed' : 'After ✗ Remaining'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Functional test before/after */}
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Functional Verification</span>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-2">Before Repair</div>
                  <div className="text-xl font-display font-black text-emerald-700">12 / 12</div>
                  <div className="text-[10px] font-mono text-slate-500">tests passed</div>
                </div>
                <div>
                  <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-2">After Repair</div>
                  <div className={`text-xl font-display font-black ${res.regression ? 'text-rose-600' : 'text-emerald-700'}`}>{res.functional}</div>
                  <div className="text-[10px] font-mono text-slate-500">tests passed</div>
                  {res.regression && <div className="text-[9px] font-mono text-rose-600 mt-1">⚠ Regression detected</div>}
                </div>
              </div>
            </div>

            {/* Reviewer verdict */}
            <div className={`rounded-lg border shadow-sm overflow-hidden ${
              reviewer.verdict === 'Accepted' ? 'border-emerald-200 bg-emerald-50'
              : reviewer.verdict === 'Rejected' ? 'border-rose-200 bg-rose-50'
              : 'border-amber-200 bg-amber-50'
            }`}>
              <div className="px-4 py-2.5 border-b border-black/[0.07] bg-black/[0.03]">
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Demo Result Reviewer</span>
              </div>
              <div className="p-4">
                <div className={`font-display font-black text-lg uppercase tracking-tight mb-2 ${
                  reviewer.verdict === 'Accepted' ? 'text-emerald-700'
                  : reviewer.verdict === 'Rejected' ? 'text-rose-700'
                  : 'text-amber-700'
                }`}>
                  {reviewer.verdict === 'Accepted' ? '✓ ' : reviewer.verdict === 'Rejected' ? '✗ ' : '⚠ '}{reviewer.verdict}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{reviewer.notes}</p>
                <p className="text-[10px] font-mono text-slate-400 mt-2">Reviewer result is an evaluation layer — not mathematical proof of security.</p>
              </div>
            </div>

            {/* LLM usage for this repair strategy */}
            <UsageRow
              label={`Sample Usage — ${STRATEGY_META[activeTab].title}`}
              input={STRATEGY_USAGE[activeTab].input}
              output={STRATEGY_USAGE[activeTab].output}
              total={STRATEGY_USAGE[activeTab].total}
              cost={STRATEGY_USAGE[activeTab].cost}
              latency={STRATEGY_USAGE[activeTab].latency}
            />
          </div>

          <button onClick={onDone}
            className="inline-flex items-center gap-3 px-7 py-3.5 bg-[#1B3A6B] hover:bg-[#15305A] text-white font-display font-bold uppercase tracking-widest text-sm rounded transition-all hover:scale-[1.02] shadow-sm">
            View Final Results <span>→</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Screen 7: Results ────────────────────────────────────────────────────────

function ResultsScreen({ mode, strategies, onRestart }: { mode: Mode; strategies: StrategyId[]; onRestart: () => void }) {
  const active = strategies.length > 0 ? strategies : [...STRATEGY_IDS]
  const winner: StrategyId = active.reduce((best, id) => STRATEGY_SCORES[id].score > STRATEGY_SCORES[best].score ? id : best, active[0])
  const winnerScore = STRATEGY_SCORES[winner].score

  // Efficiency winner: highest successful repairs per 1K tokens
  const efficiencyWinner: StrategyId = active.reduce((best, id) => calcEfficiency(id) > calcEfficiency(best) ? id : best, active[0])
  const effIsWinner = efficiencyWinner === winner

  // "Was it worth it?" — compare winner vs runner-up by tokens/repair outcome
  const sortedByScore = [...active].sort((a, b) => STRATEGY_SCORES[b].score - STRATEGY_SCORES[a].score)
  const runnerUp = sortedByScore.length > 1 ? sortedByScore[1] : null
  const tokenDiff = runnerUp ? Math.round(((STRATEGY_USAGE[winner].total - STRATEGY_USAGE[runnerUp].total) / STRATEGY_USAGE[runnerUp].total) * 100) : 0
  const scoreDiff = runnerUp ? STRATEGY_SCORES[winner].score - STRATEGY_SCORES[runnerUp].score : 0

  const tableRows = [
    { label: 'Functional Tests', key: 'functional' as const },
    { label: 'Issues Fixed',     key: 'fixed' as const },
    { label: 'Scanner Clean',    key: 'scannerClean' as const },
    { label: 'No Regression',    key: 'regression' as const, invert: true },
    { label: 'Reviewer',         key: 'reviewer' as const },
    { label: 'Overall Score',    key: 'score' as const },
  ]

  const whyCards = [
    { title: 'Security Effectiveness', icon: '◈', text: 'Scanner-feedback repair corrected all three detected security issues. Test-feedback repair left one input-validation finding unresolved and the Semgrep scanner still flagged the output.' },
    { title: 'Functional Preservation', icon: '◎', text: 'The repaired implementation continued to pass all 12 original functional tests. No regression was introduced, demonstrating that targeted changes do not sacrifice correctness.' },
    { title: 'Precision of Changes', icon: '⬡', text: 'The scanner report identified the affected lines and vulnerability categories, allowing the model to make surgical changes rather than rewriting unrelated implementation logic.' },
    { title: 'Regression Risk', icon: '◉', text: 'Test-feedback repair changed broader portions of the implementation and caused 3 tests to fail. Scanner-feedback repair made smaller, targeted modifications confined to the vulnerable code paths.' },
    { title: 'Independent Reviewer', icon: '◫', text: 'The independent reviewer accepted the scanner-feedback version without additional correction. The test-feedback repair version was rejected due to the functional regression and remaining findings.' },
    { title: 'Remaining Limitations', icon: '⊕', text: 'No automated result proves that the repaired implementation is completely secure. Static scanners and LLM review may still miss vulnerabilities not covered by the selected scan categories.' },
    { title: 'Resource Efficiency', icon: '◑', text: `${STRATEGY_META[winner].title} consumed ${STRATEGY_USAGE[winner].input.toLocaleString()} input tokens — more than simpler strategies because scanner findings were included in the prompt. The additional context directly contributed to a complete repair rate and zero functional regression, making the extra token usage justified.` },
  ]

  const strategyAnalysis: Record<StrategyId, { received: string; changed: string; fixed: string; missed: string; regression: string; reason: string }> = {
    test_feedback_v1: {
      received: 'Code plus failing public functional-test output. No normalized issue facts or scanner findings provided.',
      changed: 'Rewrote large portions of the function including unrelated input handling and connection logic.',
      fixed: '2 of 3 identified issues — Injection parameterized, but input validation check incomplete.',
      missed: 'One input-validation finding remained. Semgrep still flagged the output after repair.',
      regression: '3 of 12 functional tests failed after repair due to over-broad changes to non-vulnerable code paths.',
      reason: 'Public test feedback exposed the functional regression but did not provide normalized security context, so the repair still missed a finding.',
    },
    vulnerability_specific_v1: {
      received: 'Code plus selected normalized issue facts for Injection and Secrets Exposure.',
      changed: 'Replaced string-interpolated SQL with parameterized queries. Left unrelated code intact.',
      fixed: 'All 3 identified issues. Parameterized queries eliminated the Injection vector.',
      missed: 'None — all findings resolved.',
      regression: 'None — all 12 functional tests continued to pass.',
      reason: 'Selected normalized issue facts gave the LLM enough context to apply the correct fix without over-correcting unrelated code.',
    },
    scanner_feedback_v1: {
      received: 'Code plus compact normalized Bandit and Semgrep findings for the selected categories.',
      changed: 'Targeted only lines 9–13. Replaced f-string SQL construction with parameterized query. Added try/finally for connection cleanup.',
      fixed: 'All 3 identified issues. Bandit B608 and Semgrep formatted-sql-query both clear after repair.',
      missed: 'None — all findings resolved.',
      regression: 'None — all 12 functional tests continued to pass.',
      reason: 'Line-level context allowed the LLM to make the smallest possible change. The cleanup of unrelated connection handling was an appropriate bonus that did not break any tests.',
    },
  }

  return (
    <div className="min-h-[calc(100vh-56px)] px-4 md:px-10 py-10 max-w-5xl mx-auto space-y-8">

      {/* Mode notice */}
      {mode === 'upload' && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-teal-200 bg-teal-50 animate-fade-in-up">
          <span className="text-teal-600 mt-0.5">⬡</span>
          <div>
            <div className="text-[10px] font-mono text-teal-700 uppercase tracking-widest mb-1">Existing Code Audit Result</div>
            <p className="text-xs text-teal-800 leading-relaxed">This result reflects the uploaded code and provided context. It is <strong>shown only as a local sample and not a real benchmark result</strong>. Functional verification confidence depends on whether test files and expected behaviour were provided.</p>
          </div>
        </div>
      )}

      {/* Winner + Efficiency cards side-by-side */}
      <div className="animate-fade-in-up grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Best Repair Strategy — takes 2 cols */}
        <div className="md:col-span-2 relative rounded-xl border-2 border-[#1B3A6B]/30 bg-gradient-to-br from-[#1B3A6B]/8 to-white p-6 shadow-md overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#1B3A6B]/5 blur-2xl pointer-events-none" />
          <div className="text-[9px] font-mono text-[#1B3A6B] uppercase tracking-widest mb-3">Best Repair Strategy</div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-display font-black text-3xl md:text-4xl text-[#111118] uppercase tracking-tight mb-1">{STRATEGY_META[winner].title}</div>
              <div className="text-[11px] font-mono text-slate-500 mb-3">{STRATEGY_META[winner].sub}</div>
              <div className="flex flex-wrap gap-2">
                <StatusChip ok={true} label={`${STRATEGY_SCORES[winner].fixed} Issues Fixed`} />
                <StatusChip ok={true} label="Scanner Clean" />
                <StatusChip ok={true} label="No Regression" />
                <StatusChip ok={true} label={`Reviewer: ${STRATEGY_SCORES[winner].reviewer}`} />
              </div>
            </div>
            <div className="shrink-0 text-center">
              <div className="font-display font-black text-5xl text-[#1B3A6B]">{winnerScore}</div>
              <div className="text-[10px] font-mono text-slate-400">/ 100</div>
            </div>
          </div>
        </div>

        {/* Best Efficiency */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col">
          <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-3">Best Efficiency</div>
          <div className="font-display font-black text-xl text-[#111118] uppercase tracking-tight mb-1">{STRATEGY_META[efficiencyWinner].title}</div>
          <div className="text-[10px] font-mono text-slate-500 mb-3">{STRATEGY_META[efficiencyWinner].sub}</div>
          <div className="font-mono text-2xl font-bold text-[#1B3A6B] mb-0.5">{calcEfficiency(efficiencyWinner).toFixed(2)}</div>
          <div className="text-[9px] font-mono text-slate-400 mb-3">successful repairs / 1K tokens</div>
          {!effIsWinner && (
            <p className="text-[11px] text-slate-600 leading-relaxed mt-auto">Achieved similar repair performance to {STRATEGY_META[winner].title} while consuming fewer tokens ({STRATEGY_USAGE[efficiencyWinner].total.toLocaleString()} vs {STRATEGY_USAGE[winner].total.toLocaleString()}).</p>
          )}
          {effIsWinner && (
            <p className="text-[11px] text-slate-600 leading-relaxed mt-auto">Best repair outcome and best token efficiency — highest quality per token spent.</p>
          )}
        </div>
      </div>

      {/* Comparison table */}
      <div className="rounded-lg border border-slate-200 overflow-hidden shadow-sm overflow-x-auto animate-fade-in-up">
        <table className="w-full min-w-[540px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 text-[9px] font-mono text-slate-400 uppercase tracking-widest">Metric</th>
              {active.map(id => (
                <th key={id} className={`text-center px-4 py-3 text-[9px] font-mono uppercase tracking-widest whitespace-nowrap ${id === winner ? 'text-[#1B3A6B]' : 'text-slate-400'}`}>
                  {STRATEGY_META[id].title} {id === winner && '★'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {tableRows.map((row, i) => (
              <tr key={row.label} className={`border-b border-slate-100 ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}>
                <td className="px-4 py-2.5 text-[11px] font-mono text-slate-500">{row.label}</td>
                {active.map(id => {
                  const val = STRATEGY_SCORES[id][row.key]
                  let display: React.ReactNode
                  if (typeof val === 'boolean') {
                    const ok = row.invert ? !val : val
                    display = <span className={ok ? 'text-emerald-600' : 'text-rose-500'}>{ok ? '✓' : '✗'}</span>
                  } else if (row.key === 'score') {
                    display = <span className={`font-display font-black text-base ${id === winner ? 'text-[#1B3A6B]' : 'text-slate-700'}`}>{val}</span>
                  } else {
                    display = <span className="font-mono text-sm text-slate-700">{val as string}</span>
                  }
                  return <td key={id} className="px-4 py-2.5 text-center">{display}</td>
                })}
              </tr>
            ))}
            {/* Separator */}
            <tr className="border-b-2 border-slate-200"><td colSpan={active.length + 1} className="px-4 py-1 text-[8px] font-mono text-slate-300 uppercase tracking-widest bg-slate-50">Token &amp; Cost Efficiency</td></tr>
            {[
              { label: 'Total Tokens', render: (id: StrategyId) => <span className="font-mono text-sm text-slate-700">{(STRATEGY_USAGE[id].total / 1000).toFixed(1)}K</span> },
              { label: 'Est. Cost',    render: (id: StrategyId) => <span className="font-mono text-sm text-slate-700">${STRATEGY_USAGE[id].cost.toFixed(4)}</span> },
              { label: 'Latency',      render: (id: StrategyId) => <span className="font-mono text-sm text-slate-500">{STRATEGY_USAGE[id].latency}s</span> },
              { label: 'Efficiency',   render: (id: StrategyId) => <span className={`font-mono text-sm font-bold ${id === efficiencyWinner ? 'text-[#1B3A6B]' : 'text-slate-600'}`}>{calcEfficiency(id).toFixed(2)} {id === efficiencyWinner ? '★' : ''}</span> },
            ].map((row, i) => (
              <tr key={row.label} className={`border-b border-slate-100 ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}>
                <td className="px-4 py-2.5 text-[11px] font-mono text-slate-500">{row.label}</td>
                {active.map(id => <td key={id} className="px-4 py-2.5 text-center">{row.render(id)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Was the extra cost worth it? */}
      {runnerUp && (
        <div className="animate-fade-in-up rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-2">Was the Additional Token Cost Worth It?</div>
          <p className="text-sm text-slate-700 leading-relaxed">
            {tokenDiff >= 0
              ? `${STRATEGY_META[winner].title} used ${Math.abs(tokenDiff)}% more tokens than ${STRATEGY_META[runnerUp].title} (${STRATEGY_USAGE[winner].total.toLocaleString()} vs ${STRATEGY_USAGE[runnerUp].total.toLocaleString()} tokens) and improved the overall score by ${scoreDiff} points. ${scoreDiff > 5 ? 'The additional context justified the extra token spend — repair quality improved meaningfully.' : 'The improvement is marginal; the simpler strategy may offer better efficiency at scale.'}`
              : `${STRATEGY_META[winner].title} achieved a higher score while using fewer tokens than ${STRATEGY_META[runnerUp].title} — a dominant result on both dimensions.`
            }
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {active.filter(id => id !== winner).map(id => (
              <div key={id} className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                <span className="text-slate-400">{STRATEGY_META[winner].title}:</span>
                <span className="text-[#1B3A6B] font-bold">{STRATEGY_USAGE[winner].total.toLocaleString()} tok</span>
                <span className="text-slate-300">vs</span>
                <span className="text-slate-400">{STRATEGY_META[id].title}:</span>
                <span className="font-bold">{STRATEGY_USAGE[id].total.toLocaleString()} tok</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Why the winner won */}
      <div className="animate-fade-in-up space-y-4">
        <div>
          <h3 className="font-display font-black text-xl text-[#111118] uppercase tracking-tight mb-1">Why {STRATEGY_META[winner].title} Performed Best</h3>
          <p className="text-xs text-slate-500 font-mono">Evidence-based analysis of experimental results</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {whyCards.map(c => (
            <div key={c.title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#1B3A6B] text-base">{c.icon}</span>
                <span className="font-display font-black text-sm text-[#111118] uppercase tracking-tight">{c.title}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Per-strategy analysis */}
      <div className="animate-fade-in-up space-y-4">
        <h3 className="font-display font-black text-xl text-[#111118] uppercase tracking-tight">Strategy Analysis</h3>
        {active.map(id => {
          const a = strategyAnalysis[id]
          const s = STRATEGY_SCORES[id]
          const isWinner = id === winner
          return (
            <div key={id} className={`rounded-lg border p-5 shadow-sm ${isWinner ? 'border-[#1B3A6B]/30 bg-[#1B3A6B]/3' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-display font-black text-lg text-[#111118] uppercase tracking-tight">{STRATEGY_META[id].title}</span>
                    {isWinner && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1B3A6B] text-white">WINNER</span>}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{STRATEGY_META[id].sub}</span>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-display font-black text-2xl ${isWinner ? 'text-[#1B3A6B]' : 'text-slate-600'}`}>{s.score}</div>
                  <div className="text-[9px] font-mono text-slate-400">/ 100</div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  { label: 'What it received', value: a.received },
                  { label: 'What it changed', value: a.changed },
                  { label: 'Vulnerabilities fixed', value: a.fixed },
                  { label: 'Vulnerabilities missed', value: a.missed },
                  { label: 'Functional regression', value: a.regression },
                  { label: 'Why it performed this way', value: a.reason },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-1">{label}</div>
                    <p className="text-slate-600 leading-relaxed">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="animate-fade-in-up flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#1B3A6B]/20 bg-[#1B3A6B]/5 p-5">
        <div>
          <div className="font-display font-black text-lg text-[#111118] uppercase tracking-tight">Demo analysis complete</div>
          <p className="text-xs text-slate-600 mt-1">These deterministic sample results demonstrate the workflow; they are not a security guarantee.</p>
        </div>
        <button onClick={onRestart} className="shrink-0 px-5 py-2.5 rounded bg-[#1B3A6B] text-white font-display font-bold uppercase tracking-widest text-xs hover:bg-[#15305A] transition-colors">Start New Demo</button>
      </div>
      {/* Research metrics (benchmark only) */}
      {false && mode === 'benchmark' && (
        <div className="animate-fade-in-up space-y-4">
          <h3 className="font-display font-black text-xl text-[#111118] uppercase tracking-tight">Aggregate Research Metrics</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { v: '68%', l: 'Secure-and-Functional', s: 'Across all 24 tasks' },
              { v: '91%', l: 'Repair Success Rate',   s: 'At least one issue fixed' },
              { v: '72%', l: 'Complete Repair Rate',  s: 'All findings resolved' },
              { v: '18%', l: 'Partial Repair Rate',   s: 'Some findings remain' },
              { v: '4%',  l: 'Regression Rate',       s: 'Repairs that broke tests' },
              { v: '3.2', l: 'Avg Vulns Before',      s: 'Per generated program' },
              { v: '0.8', l: 'Avg Vulns After',       s: 'Per repaired program' },
              { v: '89%', l: 'Reviewer Acceptance',   s: 'Scanner-feedback strategy' },
              { v: '11%', l: 'Scanner Disagreement',  s: 'Bandit vs Semgrep differ' },
            ].map(s => (
              <div key={s.l} className="rounded-xl border border-black/[0.08] bg-white p-3.5 shadow-sm">
                <div className="font-display font-black text-2xl text-[#111118] mb-0.5">{s.v}</div>
                <div className="text-[10px] font-mono text-[#1B3A6B] uppercase tracking-wide leading-tight mb-0.5">{s.l}</div>
                <div className="text-[10px] text-slate-500 leading-tight">{s.s}</div>
              </div>
            ))}
          </div>

          {/* Efficiency metrics */}
          <div>
            <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-3">Efficiency Metrics — 24-Task Benchmark</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { v: '1,627',    l: 'Avg Tokens / Repair',       s: 'Across all strategies' },
                { v: '117.1K',   l: 'Total Benchmark Tokens',     s: 'All runs combined' },
                { v: '$0.0049',  l: 'Avg Cost / Repair',          s: 'At current pricing' },
                { v: '$0.35',    l: 'Total Benchmark Cost',        s: 'Estimated' },
                { v: '3.2s',     l: 'Avg Repair Latency',          s: 'Per repair call' },
                { v: '0.44',     l: 'Best Efficiency',             s: 'Repairs / 1K tokens' },
              ].map(s => (
                <div key={s.l} className="rounded-xl border border-black/[0.08] bg-white p-3.5 shadow-sm">
                  <div className="font-mono font-bold text-xl text-[#111118] mb-0.5">{s.v}</div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wide leading-tight mb-0.5">{s.l}</div>
                  <div className="text-[10px] text-slate-400 leading-tight">{s.s}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Benchmark ground truth reveal */}
          <div className="rounded-lg border border-[#1B3A6B]/20 bg-[#1B3A6B]/5 p-5 shadow-sm">
            <div className="text-[9px] font-mono text-[#1B3A6B] uppercase tracking-widest mb-3">Benchmark Evaluation — Ground Truth</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {[
                { l: 'Expected Concerns', v: '3', c: 'text-slate-700' },
                { l: 'Detected',          v: '3', c: 'text-emerald-700' },
                { l: 'Missed',            v: '0', c: 'text-emerald-700' },
                { l: 'False Positives',   v: '0', c: 'text-emerald-700' },
              ].map(r => (
                <div key={r.l} className="rounded border border-slate-200 bg-white p-3">
                  <div className={`font-display font-black text-2xl ${r.c} mb-0.5`}>{r.v}</div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wide">{r.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [initialSession] = useState(loadDemoSession)
  const [screen, setScreen] = useState(initialSession.screen)
  const [mode, setMode] = useState<Mode>(initialSession.mode)
  const [selectedTask, setSelectedTask] = useState<BenchmarkTask | null>(() => BENCHMARK_TASKS.find(task => task.id === initialSession.selectedTaskId) || null)
  const [customPrompt, setCustomPrompt] = useState(initialSession.customPrompt)
  const [uploadedCode, setUploadedCode] = useState(initialSession.uploadedCode)
  const [uploadMeta, setUploadMeta] = useState<UploadMeta | null>(initialSession.uploadMeta)
  const [selectedScans, setSelectedScans] = useState<ScanCategoryId[]>(initialSession.selectedScans)
  const [selectedStrategies, setSelectedStrategies] = useState<StrategyId[]>(initialSession.selectedStrategies)
  const live = useLiveBenchmark(initialSession.runId)
  const isLiveBenchmark = mode === 'benchmark' && selectedTask?.id === 'T-01' && live.runId !== null

  useEffect(() => {
    const session: DemoSession = {
      screen,
      mode,
      selectedTaskId: selectedTask?.id || null,
      customPrompt,
      uploadedCode,
      uploadMeta,
      selectedScans,
      selectedStrategies,
      runId: live.runId,
    }
    try {
      window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session))
    } catch {
      // Private browsing or storage limits must never break the local demo.
    }
  }, [screen, mode, selectedTask, customPrompt, uploadedCode, uploadMeta, selectedScans, selectedStrategies, live.runId])

  const handleBenchmark = (task: BenchmarkTask) => { setSelectedTask(task); setCustomPrompt(''); setUploadedCode(''); setUploadMeta(null); setMode('benchmark'); setScreen(2) }
  const handleCustom = (prompt: string) => { setSelectedTask(null); setCustomPrompt(prompt); setUploadedCode(''); setUploadMeta(null); setMode('custom'); setScreen(2) }
  const handleUpload = (code: string, meta: UploadMeta) => { setSelectedTask(null); setCustomPrompt(''); setUploadedCode(code); setUploadMeta(meta); setMode('upload'); setScreen(2) }
  const restartDemo = () => {
    const fresh = defaultDemoSession()
    try {
      window.localStorage.removeItem(DEMO_SESSION_KEY)
    } catch {
      // Storage access is optional for the local demo.
    }
    setMode(fresh.mode)
    setSelectedTask(null)
    setCustomPrompt('')
    setUploadedCode('')
    setUploadMeta(null)
    setSelectedScans([])
    setSelectedStrategies(fresh.selectedStrategies)
    live.reset()
    setScreen(1)
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#111118] font-sans">
      <TopNav screen={screen} mode={mode} onNav={setScreen} />
      <div className="relative z-10 pt-14">
        {screen === 0 && <LandingScreen onStart={() => setScreen(1)} />}
        {screen === 1 && <PromptSelectionScreen onBenchmark={handleBenchmark} onCustom={handleCustom} onUpload={handleUpload} />}
        {screen === 2 && <CodeGenerationScreen mode={mode} task={selectedTask} customPrompt={customPrompt} uploadedCode={uploadedCode} uploadMeta={uploadMeta} onDone={() => setScreen(3)} />}
        {screen === 3 && <ScanSelectionScreen initialSelected={selectedScans} onDone={scans => {
          setSelectedScans(scans)
          setScreen(4)
          if (mode === 'benchmark' && selectedTask?.id === 'T-01') void live.start('T-01', scans)
        }} />}
        {screen === 4 && (isLiveBenchmark
          ? <LiveAnalysisScreen progress={live.progress} scans={selectedScans} error={live.error} onDone={() => setScreen(5)} onBack={() => setScreen(3)} onCancel={() => void live.cancel()} />
          : <AnalysisScreen mode={mode} task={selectedTask} scans={selectedScans} onDone={() => setScreen(5)} onBack={() => setScreen(3)} />)}
        {screen === 5 && <RepairStrategyScreen initialSelected={selectedStrategies} onSelect={strats => {
          setSelectedStrategies(strats)
          setScreen(6)
          if (isLiveBenchmark) void live.configure(strats)
        }} />}
        {screen === 6 && (isLiveBenchmark
          ? <LiveComparisonScreen progress={live.progress} report={live.report} strategies={selectedStrategies} error={live.error} onDone={() => setScreen(7)} onCancel={() => void live.cancel()} />
          : <ComparisonScreen mode={mode} strategies={selectedStrategies} onDone={() => setScreen(7)} />)}
        {screen === 7 && (isLiveBenchmark
          ? live.report
            ? <LiveResultsScreen report={live.report} onRestart={restartDemo} />
            : <main className="mx-auto max-w-4xl px-4 py-16"><div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm"><div className="font-display text-xl font-black uppercase">Loading persisted report</div><p className="mt-2 text-sm text-slate-500">Reconnecting to the local evaluator…</p>{live.error && <p role="alert" className="mt-4 text-sm text-rose-700">{live.error}</p>}</div></main>
          : <ResultsScreen mode={mode} strategies={selectedStrategies} onRestart={restartDemo} />)}
      </div>
    </div>
  )
}
