from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class BenchmarkDefinition:
    task_id: str
    title: str
    fixture_directory: str

    def fixture_root(self, fixtures_root: Path) -> Path:
        return fixtures_root / self.fixture_directory


BENCHMARKS = {
    "T-01": BenchmarkDefinition("T-01", "User Login Service", "benchmark_t01"),
    "T-02": BenchmarkDefinition("T-02", "Document File Reader", "benchmark_t02"),
    "T-03": BenchmarkDefinition("T-03", "Command Argument Builder", "benchmark_t03"),
    "T-04": BenchmarkDefinition("T-04", "API Token Configuration", "benchmark_t04"),
    "T-05": BenchmarkDefinition("T-05", "Password Digest Utility", "benchmark_t05"),
}


def list_benchmark_ids() -> tuple[str, ...]:
    return tuple(BENCHMARKS)


def resolve_benchmark(task_id: str) -> BenchmarkDefinition:
    try:
        return BENCHMARKS[task_id]
    except KeyError as exc:
        raise ValueError("unknown benchmark task") from exc