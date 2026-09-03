from __future__ import annotations
from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from service.config import Settings, load_settings
from service.http_support import parse_request, until_disconnected
from service.models import ExtractionError
from service.response import ClassifyResponse, response_payload
from service.runtime import create_runtime


def create_app(settings: Settings | None = None, runtime_factory=create_runtime) -> FastAPI:
    config = settings or load_settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        async with runtime_factory(config) as (recognizer, schema):
            application.state.recognizer = recognizer
            application.state.schema = schema
            yield

    application = FastAPI(title=config.app_name, version='0.3.0', lifespan=lifespan)
    application.state.config = config

    @application.get('/health')
    async def health():
        return {'status': 'ok', 'service': config.app_name}

    @application.exception_handler(ExtractionError)
    async def extraction_error(request: Request, exc: ExtractionError):
        return JSONResponse({'detail': str(exc)}, status_code=422)

    @application.post('/api/v1/invoice/classify', response_model=ClassifyResponse)
    async def classify(request: Request, file: UploadFile = File(...),
                       booking_rules: str = Form(...), options: str = Form('{}')):
        try:
            rules, tuning, request_id = parse_request(file.filename or '', booking_rules, options,
                                                      request.app.state.schema, request.headers.get('x-request-id'))
        except (ValueError, TypeError) as exc:
            raise HTTPException(400, detail=str(exc)) from exc
        data = await file.read(config.max_upload_size_mb * 1024 * 1024 + 1)
        if not data:
            raise HTTPException(400, detail='Empty file')
        if len(data) > config.max_upload_size_mb * 1024 * 1024:
            raise HTTPException(413, detail=f'File exceeds {config.max_upload_size_mb} MB')
        try:
            result, timings = await until_disconnected(
                request.app.state.recognizer.recognize(data, file.filename, rules, tuning, request_id),
                request.is_disconnected,
            )
        except ValueError as exc:
            raise HTTPException(400, detail=str(exc)) from exc
        except TimeoutError as exc:
            raise HTTPException(504, detail=f'Recognition budget exceeded ({request_id})') from exc
        return response_payload(result, file.filename, request_id, timings)

    return application


app = create_app()

if __name__ == '__main__':
    uvicorn.run(app, host=app.state.config.app_host, port=app.state.config.app_port)
