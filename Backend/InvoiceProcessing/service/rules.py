from __future__ import annotations
import re
from typing import Any
from .models import InvoiceExtractionResult
from .normalization import _extract_currency, _extract_invoice_remark

def _normalize_booking_rules(raw_rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rules: list[dict[str, Any]] = []
    for raw_rule in raw_rules:
        code = str(raw_rule.get("code", "")).strip().upper()
        if not re.fullmatch(r"[A-Z0-9]{2,10}", code):
            continue
        keywords = raw_rule.get("keywords", [])
        if not isinstance(keywords, list):
            keywords = []
        rules.append({
            "code": code,
            "category": str(raw_rule.get("category", "other")).strip(),
            "name_zh": str(raw_rule.get("name_zh", "")).strip(),
            "name_en": str(raw_rule.get("name_en", "")).strip(),
            "description": str(raw_rule.get("description", "")).strip(),
            "keywords": [str(keyword).strip() for keyword in keywords if str(keyword).strip()],
        })
    return rules


def _build_booking_rule_prompt(rules: list[dict[str, Any]]) -> str:
    lines = ["### 记账规则主数据（必须从下列代码中选择）"]
    for rule in rules:
        names = " / ".join(value for value in [rule["name_zh"], rule["name_en"]] if value)
        keywords = "、".join(rule["keywords"])
        detail = rule["description"] or names
        suffix = f"；关键词：{keywords}" if keywords else ""
        lines.append(f'- **{rule["code"]}**: {detail}{suffix}')
    return "\n".join(lines)


def _rule_based_extract(text: str, booking_rules: list[dict[str, Any]]) -> InvoiceExtractionResult:
    t = text.lower()
    allowed_codes = [rule["code"] for rule in booking_rules]
    category = "SOBE" if "SOBE" in allowed_codes else allowed_codes[0]
    reason = "未命中分类关键词"
    for rule in booking_rules:
        matched = next((keyword for keyword in rule["keywords"] if keyword.lower() in t), None)
        if matched:
            category = rule["code"]
            reason = f"命中关键词: {matched}"
            break

    # Basic regex fallback for key header fields
    def first_match(pattern: str) -> str:
        m = re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE)
        return m.group(1).strip() if m else ""

    invoice_number = first_match(r"发票号码[:：]\s*([0-9]{8,})")
    issue_date = first_match(r"开票日期[:：]\s*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日|[0-9]{4}-[0-9]{1,2}-[0-9]{1,2})")
    buyer_tax_no = first_match(r"购买方信息[\s\S]{0,160}?识别号[:：]\s*([0-9A-Z]{15,20})")
    seller_tax_no = first_match(r"销售方信息[\s\S]{0,160}?识别号[:：]\s*([0-9A-Z]{15,20})")
    remark = _extract_invoice_remark(text)

    # Basic regex for amount extraction
    def extract_amount(text: str) -> float | None:
        # Match common total amount patterns
        # 1. 价税合计 (Total Amount with Tax)
        # 2. 小写 (Lowercase Amount)
        # 3. 金额 (Amount) - weaker signal but useful
        patterns = [
            r"价税合计[\u4e00-\u9fa5]*[:：]?\s*[¥￥]?\s*([\d,]+\.\d{2})",
            r"小写.*?[¥￥]?\s*([\d,]+\.\d{2})",
            r"(?:金额|Total).*?[¥￥]?\s*([\d,]+\.\d{2})"
        ]
        for p in patterns:
            m = re.search(p, text, flags=re.IGNORECASE | re.MULTILINE)
            if m:
                try:
                    return float(m.group(1).replace(",", ""))
                except:
                    continue
        return None

    amount_incl_tax = extract_amount(text)

    return InvoiceExtractionResult(
        category_code=category,
        confidence=0.65,
        reason=reason,
        remark=remark,
        invoice_number=invoice_number,
        issue_date=issue_date,
        buyer_name="",
        buyer_tax_no=buyer_tax_no,
        seller_name="",
        seller_tax_no=seller_tax_no,
        currency=_extract_currency(text),
        amount_excl_tax=None,
        tax_amount=None,
        amount_incl_tax=amount_incl_tax,
        line_items=[],
        raw_model_output="rule_based",
        fallback_used=True,
    )
