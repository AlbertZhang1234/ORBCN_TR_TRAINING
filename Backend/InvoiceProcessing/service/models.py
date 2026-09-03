from __future__ import annotations
from dataclasses import dataclass, field

@dataclass
class InvoiceLineItem:
    line_no: int
    description: str
    spec_model: str
    unit_price: float | None
    quantity: float | None
    amount_excl_tax: float | None
    tax_rate: str
    amount_incl_tax: float | None


@dataclass
class InvoiceExtractionResult:
    category_code: str
    confidence: float
    reason: str
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
    line_items: list[InvoiceLineItem] = field(default_factory=list)
    raw_model_output: str = ""
    fallback_used: bool = False


class ExtractionError(Exception):
    pass
