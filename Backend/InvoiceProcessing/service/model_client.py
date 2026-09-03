from __future__ import annotations
import asyncio
import httpx


class ModelFailure(Exception):
    def __init__(self, kind: str, retryable: bool):
        super().__init__(kind)
        self.kind, self.retryable = kind, retryable


class ModelClient:
    def __init__(self, client: httpx.AsyncClient, model: str, temperature: float):
        self.client, self.model, self.temperature = client, model, temperature

    async def invoke(self, messages: list[dict], timeout: float) -> str:
        try:
            # One HTTP attempt only. The recognition service owns all retries and deadlines.
            async with asyncio.timeout(timeout):
                response = await self.client.post('chat/completions', json={
                    'model': self.model, 'temperature': self.temperature, 'messages': messages,
                }, timeout=timeout)
                response.raise_for_status()
                payload = response.json()
        except (httpx.TimeoutException, TimeoutError) as exc:
            raise ModelFailure('model_timeout', True) from exc
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            raise ModelFailure(f'model_http_{status}', status in {408, 409, 429} or status >= 500) from exc
        except httpx.TransportError as exc:
            raise ModelFailure('model_network', True) from exc
        except ValueError as exc:
            raise ModelFailure('model_response_format', True) from exc
        try:
            content = payload['choices'][0]['message']['content']
            if isinstance(content, list):
                content = ''.join(part if isinstance(part, str) else str(part.get('text', '')) for part in content)
            if not isinstance(content, str) or not content.strip():
                raise ValueError('Empty model response')
            return content
        except (KeyError, IndexError, TypeError, ValueError, AttributeError) as exc:
            raise ModelFailure('model_response_format', True) from exc
