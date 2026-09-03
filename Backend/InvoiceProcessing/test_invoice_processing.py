import asyncio
import io
import json
import logging
import tempfile
import unittest
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import patch

import fitz
import httpx
from PIL import Image
from fastapi.testclient import TestClient

from app import create_app
from service.classifier import InvoiceRecognizer
from service.config import Settings
from service.http_support import until_disconnected
from service.model_client import ModelClient, ModelFailure
from service.models import ExtractionError
from service.preprocessing import prepare_content
from service.runtime import create_runtime
from service.telemetry import create_logger
from service.tuning import validate_options

SCHEMA = json.loads(Path(__file__).with_name('tuning.schema.json').read_text(encoding='utf-8'))
RULES = [{'code': 'SOBE', 'keywords': []}]


def options(**changes):
    return {**validate_options({}, SCHEMA), **changes}


def pdf(pages=1):
    with fitz.open() as document:
        for index in range(pages):
            document.new_page().insert_text((30, 30), f'Invoice page {index + 1}: Total 113.00')
        return document.tobytes()


def content():
    return {'images': ['fixture'], 'text': '', 'pages': 1, 'image_bytes': 10, 'preprocess_ms': 1, 'text_ms': 0}


class PreprocessingTests(unittest.TestCase):
    def test_all_accepted_pages_are_preserved_and_images_are_bounded(self):
        result = prepare_content(pdf(3), 'sample.pdf', options(image_max_edge=1200))
        import base64
        self.assertEqual(len(result['images']), 3)
        self.assertIn('Invoice page 3', result['text'])
        with Image.open(io.BytesIO(base64.b64decode(result['images'][0]))) as image:
            self.assertLessEqual(max(image.size), 1200)

    def test_oversized_pdf_is_rejected_before_rendering(self):
        with patch.object(fitz.Page, 'get_pixmap') as raster:
            with self.assertRaisesRegex(ExtractionError, '6'):
                prepare_content(pdf(6), 'sample.pdf', options())
            raster.assert_not_called()

    def test_invalid_file_and_invalid_options_are_rejected(self):
        with self.assertRaises(ExtractionError):
            prepare_content(b'broken', 'sample.pdf', options())
        for raw in ({'jpeg_quality': 5}, {'image_max_edge': True}, {'unknown': 1}, {'jpeg_quality': None},
                    {'model_timeout_seconds': 100, 'total_timeout_seconds': 50}):
            with self.assertRaises(ValueError):
                validate_options(raw, SCHEMA)


class RecognitionTests(unittest.IsolatedAsyncioTestCase):
    async def run_recognition(self, responses, tuning=None):
        calls = []
        async def prepare(*args):
            return content()
        async def invoke(messages, timeout):
            calls.append(messages)
            response = responses.pop(0)
            if isinstance(response, Exception):
                raise response
            return response
        recognizer = InvoiceRecognizer(prepare, invoke, 'fixture prompt', logging.Logger('test'))
        result, timings = await recognizer.recognize(b'fixture', 'test.pdf', RULES, tuning or options(), 'test-id')
        return result, timings, calls

    async def test_one_call_extracts_fields_and_derives_existing_total(self):
        result, timings, calls = await self.run_recognition([
            json.dumps({'invoice_number': '123', 'amount_excl_tax': 100, 'tax_amount': 13})])
        self.assertEqual(result.amount_incl_tax, 113)
        self.assertEqual(len(calls), 1)
        self.assertEqual(timings['model_attempts'], 1)
        self.assertIn('total_ms', timings)

    async def test_amount_repair_and_transient_retry_share_one_allowance(self):
        result, timings, calls = await self.run_recognition([
            ModelFailure('model_http_429', True), '{"invoice_number":"123"}',
        ])
        self.assertEqual(timings['model_attempts'], 2)
        self.assertEqual(len(calls), 2)
        self.assertEqual(result.invoice_number, '123')

    async def test_amount_repair_retains_original_fields(self):
        result, _, calls = await self.run_recognition([
            '{"invoice_number":"123","buyer_name":"Buyer"}', '{"amount_incl_tax":12.5,"currency":"EUR"}'])
        self.assertEqual(result.invoice_number, '123')
        self.assertEqual(result.buyer_name, 'Buyer')
        self.assertEqual(result.amount_incl_tax, 12.5)
        self.assertEqual(len(calls), 2)

    async def test_disabled_amount_repair_never_calls_again(self):
        _, _, calls = await self.run_recognition(['{"invoice_number":"123"}'], options(amount_repair_enabled=False))
        self.assertEqual(len(calls), 1)

    async def test_unusable_image_result_fails_instead_of_empty_success(self):
        with self.assertRaises(ExtractionError):
            await self.run_recognition([ModelFailure('model_http_401', False)])
        with self.assertRaises(ExtractionError):
            await self.run_recognition(['{}'], options(max_extra_attempts=0))

    async def test_total_deadline_cancels_model_and_no_retry_survives(self):
        cancelled = asyncio.Event()
        async def prepare(*args):
            return content()
        async def invoke(*args):
            try:
                await asyncio.sleep(5)
            finally:
                cancelled.set()
        service = InvoiceRecognizer(prepare, invoke, '', logging.Logger('test'))
        with self.assertRaises(TimeoutError):
            await service.recognize(b'x', 'x.pdf', RULES, options(total_timeout_seconds=0.15), 'timeout-id')
        self.assertTrue(cancelled.is_set())

    async def test_disconnect_cancels_inflight_work(self):
        cancelled = asyncio.Event()
        async def work():
            try:
                await asyncio.sleep(5)
            finally:
                cancelled.set()
        async def disconnected():
            return True
        with self.assertRaises(asyncio.CancelledError):
            await until_disconnected(work(), disconnected)
        self.assertTrue(cancelled.is_set())

    async def test_real_process_pool_can_prepare_pdf(self):
        with tempfile.TemporaryDirectory() as root:
            async with create_runtime(Settings(log_dir=Path(root), preprocess_workers=1)) as (service, _):
                result = await service.prepare(pdf(), 'test.pdf', options())
                self.assertEqual(result['pages'], 1)

    async def test_model_adapter_has_no_hidden_retries(self):
        requests = []
        async def handler(request):
            requests.append(request)
            return httpx.Response(429, json={'error': 'busy'})
        async with httpx.AsyncClient(base_url='https://model.invalid/v1/', transport=httpx.MockTransport(handler)) as client:
            model = ModelClient(client, 'fixture', 0)
            with self.assertRaises(ModelFailure):
                await model.invoke([], 1)
        self.assertEqual(len(requests), 1)
        self.assertEqual(requests[0].url.path, '/v1/chat/completions')


class HttpTests(unittest.TestCase):
    def test_route_validates_input_and_returns_timings_without_raw_output(self):
        with tempfile.TemporaryDirectory() as root:
            logger = create_logger(Path(root))
            @asynccontextmanager
            async def runtime(_):
                async def prepare(data, filename, tuning):
                    return prepare_content(data, filename, tuning)
                async def invoke(*args):
                    return '{"invoice_number":"123","amount_incl_tax":113}'
                yield InvoiceRecognizer(prepare, invoke, '', logger), SCHEMA
            application = create_app(Settings(), runtime_factory=runtime)
            with TestClient(application) as client:
                response = client.post('/api/v1/invoice/classify', files={'file': ('test.pdf', pdf())},
                    data={'booking_rules': json.dumps(RULES)}, headers={'x-request-id': 'fixture-request'})
                self.assertEqual(response.status_code, 200, response.text)
                data = response.json()
                self.assertEqual(data['request_id'], 'fixture-request')
                self.assertEqual(data['timings']['model_attempts'], 1)
                self.assertNotIn('raw_model_output', data)
                oversized = client.post('/api/v1/invoice/classify', files={'file': ('test.pdf', pdf(6))}, data={'booking_rules': json.dumps(RULES)})
                self.assertEqual(oversized.status_code, 422)
                invalid = client.post('/api/v1/invoice/classify', files={'file': ('test.pdf', pdf())},
                    data={'booking_rules': json.dumps(RULES), 'options': '{"jpeg_quality":1}'})
                self.assertEqual(invalid.status_code, 400)
            for handler in logger.handlers:
                handler.close()
            logs = '\n'.join(p.read_text(encoding='utf-8') for p in Path(root).glob('*.jsonl'))
            self.assertIn('fixture-request', logs)
            self.assertNotIn('invoice_number', logs)
            self.assertNotIn('test.pdf', logs)


if __name__ == '__main__':
    unittest.main()
