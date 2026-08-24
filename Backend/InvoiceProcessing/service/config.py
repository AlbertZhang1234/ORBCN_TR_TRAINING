from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_PROMPT_PATH = BASE_DIR / "rule" / "prompt.md"
DEFAULT_ENV_PATH = BASE_DIR / ".env"


def _load_local_env() -> None:
    if not DEFAULT_ENV_PATH.exists():
        return
    for line in DEFAULT_ENV_PATH.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key and key not in os.environ:
            os.environ[key] = value


_load_local_env()


@dataclass(frozen=True)
class Settings:
    app_name: str = "Invoice Processing Service"
    app_port: int = int(os.getenv("INVOICE_SERVICE_PORT", "8201"))
    app_host: str = os.getenv("INVOICE_SERVICE_HOST", "0.0.0.0")

    llm_model: str = os.getenv("INVOICE_LLM_MODEL", os.getenv("backend_llm_model", "gpt-4o-mini"))
    llm_temperature: float = float(os.getenv("INVOICE_LLM_TEMPERATURE", "0"))
    llm_base_url: str | None = os.getenv("INVOICE_LLM_BASE_URL", os.getenv("backend_llm_baseurl"))
    llm_api_key: str | None = os.getenv("OPENAI_API_KEY", os.getenv("backend_llm_apikey"))

    # When prompt file is empty, we still use a safe default prompt.
    prompt_path: Path = Path(os.getenv("INVOICE_PROMPT_PATH", str(DEFAULT_PROMPT_PATH)))

    max_upload_size_mb: int = int(os.getenv("INVOICE_MAX_UPLOAD_MB", "20"))


settings = Settings()
