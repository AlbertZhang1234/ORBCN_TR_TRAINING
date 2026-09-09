from __future__ import annotations
import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from .models import InvoiceExtractionResult, InvoiceLineItem


@dataclass(frozen=True)
class TextQuality:
    eligible: bool
    reasons: tuple[str, ...]


@dataclass(frozen=True)
class TextValidation:
    valid: bool
    reasons: tuple[str, ...]


def assess_text_quality(text: str) -> TextQuality:
    normalized = (text or '').strip()
    reasons: list[str] = []
    if len(normalized) < 300:
        reasons.append('too_short')
    meaningful = len(re.findall(r'[A-Za-z0-9\u4e00-\u9fff]', normalized))
    if meaningful / max(1, len(normalized)) < 0.35:
        reasons.append('low_character_density')
    lines = [line.strip() for line in normalized.splitlines() if line.strip()]
    if len(lines) < 8:
        reasons.append('too_few_lines')
    signals = sum(bool(re.search(pattern, normalized, re.IGNORECASE)) for pattern in (
        r'invoice|发票', r'total|合计|总计', r'date|日期', r'vat|tax|税',
    ))
    if signals < 3:
        reasons.append('missing_invoice_signals')
    if len(re.findall(r'\d[\d,.]*', normalized)) < 6:
        reasons.append('too_few_numbers')
    return TextQuality(not reasons, tuple(reasons))


def validate_text_result(result: InvoiceExtractionResult) -> TextValidation:
    reasons: list[str] = []
    required = {
        'invoice_number': result.invoice_number,
        'issue_date': result.issue_date,
        'seller_name': result.seller_name,
        'currency': result.currency,
    }
    reasons.extend(f'missing_{name}' for name, value in required.items() if not str(value or '').strip())
    if result.invoice_number and len(re.sub(r'\W+', '', result.invoice_number)) < 5:
        reasons.append('invalid_invoice_number')
    if result.issue_date and not _valid_date(result.issue_date):
        reasons.append('invalid_issue_date')
    if result.currency and not re.fullmatch(r'[A-Z]{3}', result.currency):
        reasons.append('invalid_currency')
    if result.confidence < 0.85:
        reasons.append('low_confidence')
    if not result.line_items:
        reasons.append('missing_line_items')
    elif any(not item.description.strip() for item in result.line_items):
        reasons.append('line_description_missing')
    if not _header_amounts_reconcile(result):
        reasons.append('header_amount_mismatch')
    if not _line_amounts_reconcile(result):
        reasons.append('line_total_mismatch')
    return TextValidation(not reasons, tuple(reasons))


def compare_results(text: InvoiceExtractionResult, vision: InvoiceExtractionResult) -> dict[str, bool | int]:
    fields = {
        'category_match': text.category_code == vision.category_code,
        'invoice_number_match': _same_text(text.invoice_number, vision.invoice_number),
        'issue_date_match': _same_text(text.issue_date, vision.issue_date),
        'seller_match': _same_text(text.seller_name, vision.seller_name),
        'currency_match': text.currency == vision.currency,
        'header_amounts_match': all(_same_amount(getattr(text, name), getattr(vision, name)) for name in (
            'amount_excl_tax', 'tax_amount', 'amount_incl_tax')),
        'line_count_match': len(text.line_items) == len(vision.line_items),
        'line_totals_match': _same_amount(_line_sum(text.line_items), _line_sum(vision.line_items)),
    }
    return {**fields, 'all_match': all(fields.values()), 'text_line_count': len(text.line_items),
            'vision_line_count': len(vision.line_items)}


def _header_amounts_reconcile(result: InvoiceExtractionResult) -> bool:
    if None in (result.amount_excl_tax, result.tax_amount, result.amount_incl_tax):
        return False
    expected = Decimal(str(result.amount_excl_tax)) + Decimal(str(result.tax_amount))
    return abs(expected - Decimal(str(result.amount_incl_tax))) <= Decimal('0.02')


def _line_amounts_reconcile(result: InvoiceExtractionResult) -> bool:
    if not result.line_items:
        return False
    tolerance = Decimal(str(max(0.05, len(result.line_items) * 0.02)))
    net = _complete_sum(result.line_items, 'amount_excl_tax')
    gross = _complete_sum(result.line_items, 'amount_incl_tax')
    net_ok = net is not None and result.amount_excl_tax is not None and abs(net - Decimal(str(result.amount_excl_tax))) <= tolerance
    gross_ok = gross is not None and result.amount_incl_tax is not None and abs(gross - Decimal(str(result.amount_incl_tax))) <= tolerance
    return net_ok or gross_ok


def _complete_sum(items: list[InvoiceLineItem], field: str) -> Decimal | None:
    values = [getattr(item, field) for item in items]
    return None if any(value is None for value in values) else sum((Decimal(str(value)) for value in values), Decimal())


def _line_sum(items: list[InvoiceLineItem]) -> float | None:
    for field in ('amount_incl_tax', 'amount_excl_tax'):
        total = _complete_sum(items, field)
        if total is not None:
            return float(total)
    return None


def _same_text(left: str, right: str) -> bool:
    normalize = lambda value: re.sub(r'\W+', '', value or '').casefold()
    return normalize(left) == normalize(right)


def _same_amount(left: float | None, right: float | None) -> bool:
    if left is None or right is None:
        return left is right
    return abs(Decimal(str(left)) - Decimal(str(right))) <= Decimal('0.02')


def _valid_date(value: str) -> bool:
    match = re.fullmatch(r'(\d{4})-(\d{2})-(\d{2})', value.strip())
    if not match:
        return False
    try:
        date(*(int(part) for part in match.groups()))
        return True
    except ValueError:
        return False
