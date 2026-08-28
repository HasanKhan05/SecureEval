import { BENCHMARK_TASKS } from './App'

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2) ? true : false
type Expect<Value extends true> = Value

type LiveBenchmarkId = (typeof BENCHMARK_TASKS)[number]['id']
type _exactFiveLiveBenchmarks = Expect<Equal<LiveBenchmarkId, 'T-01' | 'T-02' | 'T-03' | 'T-04' | 'T-05'>>

void (0 as unknown as _exactFiveLiveBenchmarks)
