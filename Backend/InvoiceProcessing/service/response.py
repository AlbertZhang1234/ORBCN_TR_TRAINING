from __future__ import annotations
import re
from dataclasses import asdict
from pydantic import BaseModel
from .models import InvoiceExtractionResult

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
    request_id: str
    timings: dict
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


def response_payload(result: InvoiceExtractionResult, filename: str, request_id: str, timings: dict) -> dict:
    data = asdict(result)
    data.pop('raw_model_output', None)
    data.update(file=filename, status=200, issue_date=_normalize_date(result.issue_date),
                confidence=round(float(result.confidence), 4), line_items_count=len(result.line_items),
                engine='native_pdf_rule_based' if result.fallback_used else 'vision_llm',
                request_id=request_id, timings=timings)
    for key in ('amount_excl_tax', 'tax_amount', 'amount_incl_tax'):
        data[key] = _round2(data[key])
    return data

