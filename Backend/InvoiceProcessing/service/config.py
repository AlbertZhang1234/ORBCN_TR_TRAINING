from __future__ import annotations
import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_name: str = 'Invoice Processing Service'
    app_host: str = '0.0.0.0'
    app_port: int = 8201
    llm_model: str = 'gpt-4o-mini'
    llm_temperature: float = 0
    llm_base_url: str = 'https://api.openai.com/v1'
    llm_api_key: str = ''
    max_upload_size_mb: int = 20
    preprocess_workers: int = 2
    prompt_path: Path = Path(__file__).resolve().parent.parent / 'rule' / 'prompt.md'
    log_dir: Path = Path(__file__).resolve().parents[2] / 'log'


def load_settings() -> Settings:
    env = {}
    local = Path(__file__).resolve().parent.parent / '.env'
    if local.exists():
        for line in local.read_text(encoding='utf-8').splitlines():
            if line.strip() and not line.lstrip().startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                env[key.strip()] = value.strip().strip(chr(34)).strip(chr(39))
    env.update(os.environ)
    defaults = Settings()
    return Settings(
        app_name=defaults.app_name,
        app_host=env.get('INVOICE_SERVICE_HOST', defaults.app_host),
        app_port=int(env.get('INVOICE_SERVICE_PORT', defaults.app_port)),
        llm_model=env.get('INVOICE_LLM_MODEL', env.get('backend_llm_model', defaults.llm_model)),
        llm_temperature=float(env.get('INVOICE_LLM_TEMPERATURE', '0')),
        llm_base_url=env.get('INVOICE_LLM_BASE_URL', env.get('backend_llm_baseurl', defaults.llm_base_url)),
        llm_api_key=env.get('OPENAI_API_KEY', env.get('backend_llm_apikey', '')),
        max_upload_size_mb=int(env.get('INVOICE_MAX_UPLOAD_MB', '20')),
        preprocess_workers=max(1, min(4, int(env.get('INVOICE_PREPROCESS_WORKERS', '2')))),
        prompt_path=Path(env.get('INVOICE_PROMPT_PATH', str(defaults.prompt_path))),
        log_dir=Path(env.get('BACKEND_LOG_DIR', str(defaults.log_dir))),
    )
