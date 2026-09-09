from __future__ import annotations
import asyncio
import hashlib
import logging
import time
from decimal import Decimal
from typing import Awaitable, Callable

from .models import ExtractionError, InvoiceExtractionResult
from .model_client import ModelFailure
from .normalization import _build_llm_result, _parse_model_json, _to_float
from .prompts import amount_messages, build_messages, build_text_messages
from .rules import _normalize_booking_rules, _rule_based_extract
from .telemetry import record
from .text_strategy import assess_text_quality, compare_results, validate_text_result


class InvoiceRecognizer:
    def __init__(self, prepare: Callable[..., Awaitable[dict]], invoke: Callable[..., Awaitable[str]],
                 prompt: str, logger: logging.Logger):
        self.prepare, self.invoke, self.prompt, self.logger = prepare, invoke, prompt, logger

    async def recognize(self, data: bytes, filename: str, rules: list[dict], options: dict, request_id: str):
        started = time.monotonic()
        timings = {'model_ms': 0, 'model_attempts': 0, 'text_fast_path': False}
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
                    purpose: str, deadline: float, timeout_limit: int | None = None) -> tuple[dict, str]:
        started = time.monotonic()
        timeout = min(timeout_limit or options['model_timeout_seconds'], deadline - started - 0.1)
        if timeout <= 0:
            raise ModelFailure('budget_exhausted', False)
        timings['model_attempts'] += 1
        attempt = timings['model_attempts']
        status = 'success'
        try:
            raw = await self.invoke(messages, timeout)
            try:
                parsed = _parse_model_json(raw)
                if not isinstance(parsed, dict):
                    raise ValueError('Expected JSON object')
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
            timing_key = 'text_model_ms' if purpose == 'text_extract' else 'vision_model_ms'
            timings[timing_key] = timings.get(timing_key, 0) + elapsed
            record(self.logger, 'model_attempt', request_id=request_id, attempt=attempt,
                   purpose=purpose, status=status, elapsed_ms=elapsed)

    async def _extract(self, content: dict, rules: list[dict], options: dict, request_id: str,
                       timings: dict, deadline: float) -> InvoiceExtractionResult:
        max_calls = 1 + options['max_extra_attempts']
        quality = assess_text_quality(content['text'])
        shadow = not options['text_fast_path_enabled'] and self._sampled(
            request_id, options['text_shadow_sample_percent'])
        timings.update(text_quality_eligible=quality.eligible, text_shadow_sampled=shadow)
        if not quality.eligible or not (options['text_fast_path_enabled'] or shadow) or max_calls < 2:
            reason = quality.reasons or (('model_budget_requires_two_calls',) if max_calls < 2 else ('not_sampled',))
            record(self.logger, 'text_path_skipped', request_id=request_id, reasons=reason)
            return await self._vision_result(content, rules, options, request_id, timings, deadline, max_calls)
        if options['text_fast_path_enabled']:
            return await self._fast_hybrid(content, rules, options, request_id, timings, deadline, max_calls)
        text_task = asyncio.create_task(self._text_candidate(content['text'], rules, options, request_id,
                                                              timings, deadline))
        vision_task = asyncio.create_task(self._vision_result(content, rules, options, request_id,
                                                               timings, deadline, max_calls))
        text_result, result = await asyncio.gather(text_task, vision_task)
        if text_result is not None:
            record(self.logger, 'text_shadow_compared', request_id=request_id,
                   candidate_valid=bool(timings.get('text_candidate_valid')), **compare_results(text_result, result))
        return result

    async def _fast_hybrid(self, content: dict, rules: list[dict], options: dict, request_id: str,
                           timings: dict, deadline: float, max_calls: int) -> InvoiceExtractionResult:
        text_task = asyncio.create_task(self._text_candidate(content['text'], rules, options, request_id,
                                                              timings, deadline))
        try:
            candidate = await asyncio.wait_for(asyncio.shield(text_task), timeout=2)
            if candidate is not None and timings.get('text_candidate_valid'):
                return self._select_text(candidate, request_id, timings)
        except TimeoutError:
            pass
        vision_task = asyncio.create_task(self._vision_result(content, rules, options, request_id,
                                                               timings, deadline, max_calls))
        done, _ = await asyncio.wait((text_task, vision_task), return_when=asyncio.FIRST_COMPLETED)
        if text_task in done:
            candidate = text_task.result()
            if candidate is not None and timings.get('text_candidate_valid'):
                await self._cancel(vision_task)
                return self._select_text(candidate, request_id, timings)
        if vision_task in done:
            await self._cancel(text_task)
            return vision_task.result()
        return await vision_task

    def _select_text(self, result: InvoiceExtractionResult, request_id: str,
                     timings: dict) -> InvoiceExtractionResult:
        timings['text_fast_path'] = True
        record(self.logger, 'text_fast_path_selected', request_id=request_id,
               line_count=len(result.line_items))
        return result

    @staticmethod
    async def _cancel(task: asyncio.Task) -> None:
        if not task.done():
            task.cancel()
        await asyncio.gather(task, return_exceptions=True)

    async def _text_candidate(self, text: str, rules: list[dict], options: dict, request_id: str,
                              timings: dict, deadline: float) -> InvoiceExtractionResult | None:
        try:
            parsed, raw = await self._call(build_text_messages(self.prompt, rules, text), options, request_id,
                                           timings, 'text_extract', deadline, options['text_model_timeout_seconds'])
        except ModelFailure as exc:
            record(self.logger, 'text_candidate_failed', request_id=request_id, error_type=exc.kind)
            return None
        self._derive_total(parsed)
        result = _build_llm_result(parsed, raw, text, [rule['code'] for rule in rules])
        validation = validate_text_result(result)
        timings['text_candidate_valid'] = validation.valid
        record(self.logger, 'text_candidate_evaluated', request_id=request_id, valid=validation.valid,
               reasons=validation.reasons, line_count=len(result.line_items))
        return result

    async def _vision_result(self, content: dict, rules: list[dict], options: dict, request_id: str,
                             timings: dict, deadline: float, max_calls: int) -> InvoiceExtractionResult:
        messages = build_messages(self.prompt, rules, content['images'])
        parsed, raw = None, ''
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
        if (_to_float(parsed.get('amount_incl_tax')) is None and options['amount_repair_enabled']
                and timings['model_attempts'] < max_calls):
            await self._repair_amount(parsed, content['images'], options, request_id, timings, deadline)
        result = _build_llm_result(parsed, raw, content['text'], [rule['code'] for rule in rules])
        if not result.invoice_number and result.amount_incl_tax is None and not result.line_items:
            return self._fallback(content['text'], rules)
        return result

    async def _repair_amount(self, parsed: dict, images: list[str], options: dict, request_id: str,
                             timings: dict, deadline: float) -> None:
        try:
            repair, _ = await self._call(amount_messages(images), options, request_id, timings,
                                         'amount_repair', deadline)
            for key in ('currency', 'amount_excl_tax', 'tax_amount', 'amount_incl_tax'):
                if parsed.get(key) in (None, '') and repair.get(key) not in (None, ''):
                    parsed[key] = repair[key]
        except ModelFailure:
            pass

    @staticmethod
    def _sampled(request_id: str, percent: int) -> bool:
        bucket = int.from_bytes(hashlib.sha256(request_id.encode()).digest()[:4], 'big') % 100
        return bucket < percent

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
