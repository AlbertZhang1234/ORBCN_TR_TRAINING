from __future__ import annotations
import asyncio
import anyio
import json
import re
from pathlib import Path
from uuid import uuid4

from .tuning import validate_options


def parse_request(filename: str, rules_json: str, options_json: str, schema: dict, incoming_id: str | None):
    if Path(filename).suffix.lower() not in {'.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'}:
        raise ValueError('Only PDF, PNG, JPG, JPEG, WEBP, GIF and BMP are supported')
    rules = json.loads(rules_json)
    if not isinstance(rules, list) or not rules or any(not isinstance(rule, dict) for rule in rules):
        raise ValueError('booking_rules must contain active rules')
    options = validate_options(json.loads(options_json), schema)
    request_id = incoming_id if incoming_id and re.fullmatch(r'[a-zA-Z0-9-]{1,64}', incoming_id) else str(uuid4())
    return rules, options, request_id


async def until_disconnected(work, disconnected):
    finished = anyio.Event()
    result, failure = None, None

    async def execute():
        nonlocal result, failure
        try:
            result = await work
        except BaseException as exc:
            failure = exc
        finally:
            finished.set()

    async def monitor():
        while not await disconnected():
            await anyio.sleep(0.25)
        finished.set()

    # Level cancellation also stops Starlette's internally shielded receive checks.
    async with anyio.create_task_group() as group:
        group.start_soon(execute)
        group.start_soon(monitor)
        await finished.wait()
        group.cancel_scope.cancel()
    if failure:
        raise failure
    if result is None:
        raise asyncio.CancelledError('Client disconnected')
    return result
