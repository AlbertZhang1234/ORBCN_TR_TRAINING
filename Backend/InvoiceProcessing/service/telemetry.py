from __future__ import annotations
import json
import logging
import os
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path


def create_logger(directory: Path) -> logging.Logger:
    directory.mkdir(parents=True, exist_ok=True)
    logger = logging.Logger(f'invoice-{os.getpid()}', logging.INFO)
    handler = RotatingFileHandler(directory / f'invoice-processing-{os.getpid()}.jsonl',
                                  maxBytes=10 * 1024 * 1024, backupCount=5, encoding='utf-8')
    handler.setFormatter(logging.Formatter('%(message)s'))
    logger.addHandler(handler)
    return logger


def record(logger: logging.Logger, event: str, **fields) -> None:
    # Callers supply metadata only: never invoice text, model output, filename, or credentials.
    logger.info(json.dumps({'timestamp': datetime.now(timezone.utc).isoformat(), 'event': event, **fields}, ensure_ascii=False))
