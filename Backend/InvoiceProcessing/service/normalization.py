from __future__ import annotations
import json
import math
import re
from typing import Any
from .models import InvoiceExtractionResult, InvoiceLineItem

def _parse_model_json(raw: str) -> dict[str, Any]:
    if isinstance(raw, list):
        parts = []
        for item in raw:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                parts.append(str(item.get("text", "")))
        raw = "".join(parts)
    text = str(raw or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text.replace("json", "", 1).strip()
    return json.loads(text)


def _build_llm_result(
    parsed: dict[str, Any],
    raw: str,
    text_content: str,
    allowed_codes: list[str],
) -> InvoiceExtractionResult:
    invoice_number = str(parsed.get("invoice_number", "") or "")
    amount_excl_tax = _to_float(parsed.get("amount_excl_tax"))
    tax_amount = _to_float(parsed.get("tax_amount"))
    amount_incl_tax = _to_float(parsed.get("amount_incl_tax"))

    # Receipts normally have no VAT fields; the final charged amount is the
    # usable total and should be visible in both amount columns.
    if not invoice_number.strip() and tax_amount is None and amount_incl_tax is not None:
        amount_excl_tax = amount_excl_tax if amount_excl_tax is not None else amount_incl_tax

    return InvoiceExtractionResult(
        category_code=_normalize_code(str(parsed.get("category_code", "SOBE")), allowed_codes),
        confidence=max(0.0, min(1.0, _to_float(parsed.get("confidence")) or 0.2)),
        reason=str(parsed.get("reason", "模型未提供原因") or "模型未提供原因"),
        remark=str(parsed.get("remark", "") or "").strip() or _extract_invoice_remark(text_content),
        invoice_number=invoice_number,
        issue_date=str(parsed.get("issue_date", "") or ""),
        buyer_name=str(parsed.get("buyer_name", "") or ""),
        buyer_tax_no=str(parsed.get("buyer_tax_no", "") or ""),
        seller_name=str(parsed.get("seller_name", "") or ""),
        seller_tax_no=str(parsed.get("seller_tax_no", "") or ""),
        currency=_normalize_currency(parsed.get("currency")) or _extract_currency(text_content),
        amount_excl_tax=amount_excl_tax,
        tax_amount=tax_amount,
        amount_incl_tax=amount_incl_tax,
        line_items=_parse_line_items(parsed.get("line_items")),
        raw_model_output=raw,
        fallback_used=False,
    )


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(value) else None
    s = str(value).strip()
    if not s:
        return None
    s = s.replace(",", "")
    s = s.replace("¥", "")
    s = s.replace("￥", "")
    s = s.replace("€", "")
    s = s.replace("$", "")
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    if not m:
        return None
    try:
        number = float(m.group(0))
        return number if math.isfinite(number) else None
    except ValueError:
        return None


def _normalize_code(code: str, allowed_codes: list[str]) -> str:
    c = (code or "").strip().upper()
    if c in allowed_codes:
        return c

    return "SOBE" if "SOBE" in allowed_codes else allowed_codes[0]


def _normalize_currency(value: Any) -> str:
    s = str(value or "").strip().upper()
    if not s:
        return ""

    compact = re.sub(r"[\s_\-]+", "", s)
    aliases = {
        "RMB": "CNY",
        "CNH": "CNY",
        "YUAN": "CNY",
        "人民币": "CNY",
        "欧元": "EUR",
        "美元": "USD",
        "日元": "JPY",
        "日圆": "JPY",
        "英镑": "GBP",
        "港币": "HKD",
        "港元": "HKD",
    }
    if compact in aliases:
        return aliases[compact]
    if re.fullmatch(r"[A-Z]{3}", compact):
        return compact
    if "€" in s:
        return "EUR"
    if "$" in s or "USD" in compact:
        return "USD"
    if "JPY" in compact:
        return "JPY"
    if "CNY" in compact or "RMB" in compact:
        return "CNY"
    return compact[:3] if len(compact) >= 3 else ""


def _extract_currency(text: str) -> str:
    normalized = text or ""
    upper = normalized.upper()
    currency_patterns = [
        (r"\bEUR\b|€|欧元", "EUR"),
        (r"\bUSD\b|US\$|美元", "USD"),
        (r"\bJPY\b|日元|日圆", "JPY"),
        (r"\bGBP\b|£|英镑", "GBP"),
        (r"\bHKD\b|港币|港元", "HKD"),
        (r"\bCNY\b|\bRMB\b|￥|人民币", "CNY"),
    ]
    for pattern, code in currency_patterns:
        if re.search(pattern, upper, flags=re.IGNORECASE):
            return code
    return "CNY"


def _extract_invoice_remark(text: str) -> str:
    normalized = (text or "").replace("\u3000", " ")
    if not normalized.strip():
        return ""

    patterns = [
        r"(?:^|\n)\s*备\s*注[:：]?\s*([^\n\r]{1,240})",
        r"(?:^|\n)\s*备注信息[:：]?\s*([^\n\r]{1,240})",
        r"备\s*注[:：]?\s*([^\n\r]{1,240})",
    ]
    cut_markers = r"(?:收款人|复核|开票人|销售方|购买方|价税合计|机器编号|校验码|发票号码|开票日期)"

    for pattern in patterns:
        match = re.search(pattern, normalized, flags=re.IGNORECASE)
        if not match:
            continue
        candidate = re.split(cut_markers, match.group(1))[0]
        candidate = re.sub(r"\s+", " ", candidate).strip(" :：;；,，。")
        if candidate and candidate not in {"无", "-", "--"}:
            return candidate
    return ""


def _parse_line_items(items: Any) -> list[InvoiceLineItem]:
    if not isinstance(items, list):
        return []
    parsed: list[InvoiceLineItem] = []
    for idx, item in enumerate(items, 1):
        if not isinstance(item, dict):
            continue
        parsed.append(
            InvoiceLineItem(
                line_no=int(item.get("line_no") or idx),
                description=str(item.get("description", "") or ""),
                spec_model=str(item.get("spec_model", "") or ""),
                unit_price=_to_float(item.get("unit_price")),
                quantity=_to_float(item.get("quantity")),
                amount_excl_tax=_to_float(item.get("amount_excl_tax")),
                tax_rate=str(item.get("tax_rate", "") or ""),
                amount_incl_tax=_to_float(item.get("amount_incl_tax")),
            )
        )
    return parsed
