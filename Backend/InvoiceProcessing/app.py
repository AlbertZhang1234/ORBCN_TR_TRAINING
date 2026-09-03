from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from service.classifier import process_invoice, load_prompt
from service.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name, version="0.2.0")


class InvoiceLineItemResponse(BaseModel):
    line_no: int
    description: str
    spec_model: str
    unit_price: float | None
    quantity: float | None
    amount_excl_tax: float | None
    tax_rate: str
    amount_incl_tax: float | None


class ClassifyResponse(BaseModel):
    file: str
    status: int
    category_code: str
    confidence: float
    remark: str
    invoice_number: str
    issue_date: str
    buyer_name: str
    buyer_tax_no: str
    seller_name: str
    seller_tax_no: str
    currency: str
    amount_excl_tax: float | None
    tax_amount: float | None
    amount_incl_tax: float | None
    line_items_count: int
    line_items: list[InvoiceLineItemResponse]
    engine: str
    fallback_used: bool
    reason: str


def _normalize_date(value: str) -> str:
    s = (value or "").strip()
    if not s:
        return ""

    m = re.search(r"(\d{4})[年\-/\.](\d{1,2})[月\-/\.](\d{1,2})", s)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return f"{y:04d}-{mo:02d}-{d:02d}"

    m = re.search(r"(\d{4})(\d{2})(\d{2})", s)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return f"{y:04d}-{mo:02d}-{d:02d}"

    return s


def _round2(value: float | None) -> float | None:
    if value is None:
        return None
    return round(float(value), 2)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


@app.post("/api/v1/invoice/classify", response_model=ClassifyResponse)
async def classify_invoice_endpoint(
    file: UploadFile = File(...),
    booking_rules: str = Form(...),
) -> ClassifyResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="filename is required")

    ext = Path(file.filename).suffix.lower()
    if ext not in {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}:
        raise HTTPException(status_code=400, detail="only pdf/png/jpg/jpeg/webp/gif/bmp are supported")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty file")

    max_size = settings.max_upload_size_mb * 1024 * 1024
    if len(data) > max_size:
        raise HTTPException(status_code=413, detail=f"file too large, max {settings.max_upload_size_mb}MB")

    try:
        parsed_booking_rules = json.loads(booking_rules)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="booking_rules must be valid JSON") from exc
    if not isinstance(parsed_booking_rules, list) or not parsed_booking_rules:
        raise HTTPException(status_code=400, detail="booking_rules must contain active rules")

    prompt_content = load_prompt(settings.prompt_path)
    result = await run_in_threadpool(
        process_invoice,
        file_bytes=data,
        filename=file.filename,
        prompt_content=prompt_content,
        model=settings.llm_model,
        temperature=settings.llm_temperature,
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key,
        booking_rules=parsed_booking_rules,
    )
    
    # Determine engine based on result
    # If LLM worked, it's vision_llm. If fallback used, it's rule_based.
    engine = "vision_llm" if not result.fallback_used else "pdfminer_rule_based"

    return ClassifyResponse(
        file=file.filename,
        status=200,
        category_code=result.category_code,
        confidence=round(float(result.confidence), 4),
        remark=result.remark,
        invoice_number=result.invoice_number,
        issue_date=_normalize_date(result.issue_date),
        buyer_name=result.buyer_name,
        buyer_tax_no=result.buyer_tax_no,
        seller_name=result.seller_name,
        seller_tax_no=result.seller_tax_no,
        currency=result.currency,
        amount_excl_tax=_round2(result.amount_excl_tax),
        tax_amount=_round2(result.tax_amount),
        amount_incl_tax=_round2(result.amount_incl_tax),
        line_items_count=len(result.line_items),
        line_items=[
            InvoiceLineItemResponse(
                line_no=item.line_no,
                description=item.description,
                spec_model=item.spec_model,
                unit_price=item.unit_price,
                quantity=item.quantity,
                amount_excl_tax=item.amount_excl_tax,
                tax_rate=item.tax_rate,
                amount_incl_tax=item.amount_incl_tax,
            )
            for item in result.line_items
        ],
        engine=engine,
        fallback_used=result.fallback_used,
        reason=result.reason,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host=settings.app_host, port=settings.app_port, reload=False)
