from __future__ import annotations
import asyncio
import logging
import time
from decimal import Decimal
from typing import Awaitable, Callable

from .models import ExtractionError, InvoiceExtractionResult
from .model_client import ModelFailure
from .normalization import _build_llm_result, _parse_model_json, _to_float
from .prompts import amount_messages, build_messages
from .rules import _normalize_booking_rules, _rule_based_extract
from .telemetry import record


class InvoiceRecognizer:
    def __init__(self, prepare: Callable[..., Awaitable[dict]], invoke: Callable[..., Awaitable[str]],
                 prompt: str, logger: logging.Logger):
        self.prepare, self.invoke, self.prompt, self.logger = prepare, invoke, prompt, logger

    async def recognize(self, data: bytes, filename: str, rules: list[dict], options: dict, request_id: str):
        started = time.monotonic()
        timings = {'model_ms': 0, 'model_attempts': 0}
        status = 'error'
        normalized = _normalize_booking_rules(rules)
        if not normalized:
            raise ValueError('No valid booking rules provided')
        try:
            async with asyncio.timeout(options['total_timeout_seconds']):
                content = await self.prepare(data, filename, options)
                timings.update({key: content[key] for key in ('preprocess_ms', 'text_ms', 'pages', 'image_bytes')})
                if 'render_ms' in content:
                    timings['render_ms'] = content['render_ms']
                if 'preprocess_wait_ms' in content:
                    timings['preprocess_wait_ms'] = content['preprocess_wait_ms']
                record(self.logger, 'preprocessed', request_id=request_id, **timings)
                result = await self._extract(content, normalized, options, request_id, timings,
                                             started + options['total_timeout_seconds'])
                status = 'fallback' if result.fallback_used else 'success'
                return result, timings
        except asyncio.CancelledError:
            status = 'cancelled'
            raise
        except TimeoutError:
            status = 'timeout'
            raise
        finally:
            timings['total_ms'] = round((time.monotonic() - started) * 1000)
            record(self.logger, 'recognition_finished', request_id=request_id, status=status, **timings)

    async def _call(self, messages: list[dict], options: dict, request_id: str, timings: dict,
                    purpose: str, deadline: float) -> tuple[dict, str]:
        started = time.monotonic()
        timeout = min(options['model_timeout_seconds'], deadline - started - 0.1)
        if timeout <= 0:
            raise ModelFailure('budget_exhausted', False)
        timings['model_attempts'] += 1
        status = 'success'
        try:
            raw = await self.invoke(messages, timeout)
            try:
                parsed = _parse_model_json(raw)
                if not isinstance(parsed, dict):
                    raise ValueError('Expected JSON object')
                # Normalize here so malformed field types can consume one bounded repair attempt.
                _build_llm_result(parsed, raw, '', ['SOBE'])
                return parsed, raw
            except (ValueError, TypeError, OverflowError, AttributeError) as exc:
                raise ModelFailure('model_json_format', True) from exc
        except ModelFailure as exc:
            status = exc.kind
            raise
        except asyncio.CancelledError:
            status = 'cancelled'
            raise
        finally:
            elapsed = round((time.monotonic() - started) * 1000)
            timings['model_ms'] += elapsed
            record(self.logger, 'model_attempt', request_id=request_id, attempt=timings['model_attempts'],
                   purpose=purpose, status=status, elapsed_ms=elapsed)

    async def _extract(self, content: dict, rules: list[dict], options: dict, request_id: str,
                       timings: dict, deadline: float) -> InvoiceExtractionResult:
        messages = build_messages(self.prompt, rules, content['images'])
        parsed, raw = None, ''
        max_calls = 1 + options['max_extra_attempts']
        while timings['model_attempts'] < max_calls:
            try:
                parsed, raw = await self._call(messages, options, request_id, timings, 'extract', deadline)
                break
            except ModelFailure as exc:
                if not exc.retryable or timings['model_attempts'] >= max_calls:
                    break
                await asyncio.sleep(min(2, timings['model_attempts'], max(0, deadline - time.monotonic() - 0.2)))
        if parsed is None:
            return self._fallback(content['text'], rules)
        self._derive_total(parsed)
        if _to_float(parsed.get('amount_incl_tax')) is None and options['amount_repair_enabled'] and timings['model_attempts'] < max_calls:
            try:
                repair, _ = await self._call(amount_messages(content['images']), options, request_id, timings, 'amount_repair', deadline)
                for key in ('currency', 'amount_excl_tax', 'tax_amount', 'amount_incl_tax'):
                    if parsed.get(key) in (None, '') and repair.get(key) not in (None, ''):
                        parsed[key] = repair[key]
            except ModelFailure:
                pass  # Preserve already extracted fields when the optional repair fails.
        result = _build_llm_result(parsed, raw, content['text'], [rule['code'] for rule in rules])
        if not result.invoice_number and result.amount_incl_tax is None and not result.line_items:
            return self._fallback(content['text'], rules)
        return result

    @staticmethod
    def _derive_total(parsed: dict) -> None:
        if _to_float(parsed.get('amount_incl_tax')) is not None:
            return
        amount, tax = _to_float(parsed.get('amount_excl_tax')), _to_float(parsed.get('tax_amount'))
        if amount is not None and tax is not None:
            parsed['amount_incl_tax'] = float(round(Decimal(str(amount)) + Decimal(str(tax)), 2))

    @staticmethod
    def _fallback(text: str, rules: list[dict]) -> InvoiceExtractionResult:
        result = _rule_based_extract(text, rules)
        if not result.invoice_number and result.amount_incl_tax is None:
            raise ExtractionError('模型识别失败且无可用文本结果，请稍后重试 / No usable recognition result')
        return result
