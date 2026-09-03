from __future__ import annotations
import asyncio
import json
import multiprocessing
import time
from concurrent.futures import ProcessPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path

import httpx

from .classifier import InvoiceRecognizer
from .config import Settings
from .model_client import ModelClient
from .preprocessing import prepare_content
from .telemetry import create_logger


@asynccontextmanager
async def create_runtime(settings: Settings):
    schema = json.loads((Path(__file__).resolve().parent.parent / 'tuning.schema.json').read_text(encoding='utf-8'))
    prompt = settings.prompt_path.read_text(encoding='utf-8').strip()
    logger = create_logger(settings.log_dir)
    pool = ProcessPoolExecutor(max_workers=settings.preprocess_workers,
                               mp_context=multiprocessing.get_context('spawn'), max_tasks_per_child=50)
    try:
        async with httpx.AsyncClient(base_url=settings.llm_base_url.rstrip('/') + '/',
                                    headers={'Authorization': f'Bearer {settings.llm_api_key}'},
                                    limits=httpx.Limits(max_connections=16, max_keepalive_connections=8)) as client:
            model = ModelClient(client, settings.llm_model, settings.llm_temperature)

            async def prepare(data, filename, options):
                started = time.monotonic()
                content = await asyncio.get_running_loop().run_in_executor(pool, prepare_content, data, filename, options)
                content['preprocess_wait_ms'] = max(0, round((time.monotonic() - started) * 1000) - content['preprocess_ms'])
                return content

            yield InvoiceRecognizer(prepare, model.invoke, prompt, logger), schema
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
        for handler in logger.handlers:
            handler.close()
