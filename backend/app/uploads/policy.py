from dataclasses import dataclass
from enum import StrEnum


class UploadPurpose(StrEnum):
    CUSTOM_PROMPT_CONTEXT = "custom_prompt_context"
    UPLOADED_CODE = "uploaded_code"


@dataclass(frozen=True)
class UploadPolicy:
    allowed_extensions: frozenset[str] = frozenset(
        {
            ".py",
            ".js",
            ".jsx",
            ".ts",
            ".tsx",
            ".json",
            ".toml",
            ".yaml",
            ".yml",
            ".md",
            ".txt",
        }
    )
    max_upload_bytes: int = 2 * 1024 * 1024
    max_file_count: int = 100
    max_expanded_bytes: int = 10 * 1024 * 1024
    max_expansion_ratio: int = 20
    max_path_depth: int = 8
    max_path_length: int = 240
