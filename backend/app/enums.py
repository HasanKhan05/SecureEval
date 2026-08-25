from enum import StrEnum


class Mode(StrEnum):
    BENCHMARK = "benchmark"
    CUSTOM_PROMPT = "custom_prompt"
    UPLOAD = "upload"

class ModeLabel(StrEnum):
    BENCHMARK = "Benchmark"
    CUSTOM_PROMPT = "Exploratory \u2014 Custom Prompt"
    UPLOAD = "Exploratory \u2014 Uploaded Code"



class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ScanCategoryId(StrEnum):
    INJECTION = "injection"
    AUTHENTICATION_AUTHORIZATION = "authentication_authorization"
    SECRETS = "secrets"
    INPUT_VALIDATION = "input_validation"
    DEPENDENCY_CONFIGURATION = "dependency_configuration"


class StrategyId(StrEnum):
    VULNERABILITY_SPECIFIC = "vulnerability_specific_v1"
    SCANNER_FEEDBACK = "scanner_feedback_v1"
    TEST_FEEDBACK = "test_feedback_v1"


ALL_STRATEGIES: tuple[StrategyId, ...] = tuple(StrategyId)
MODE_LABELS: dict[Mode, str] = {
    Mode.BENCHMARK: "Benchmark",
    Mode.CUSTOM_PROMPT: "Exploratory — Custom Prompt",
    Mode.UPLOAD: "Exploratory — Uploaded Code",
}
