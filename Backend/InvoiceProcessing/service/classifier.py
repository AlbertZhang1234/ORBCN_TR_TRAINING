from __future__ import annotations

import base64
import json
import logging
import re
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pdfminer.high_level import extract_text as pdfminer_extract_text

logger = logging.getLogger(__name__)

DEFAULT_PROMPT = """你是一个报销系统的发票分类与信息抽取助手。"""


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

def load_prompt(prompt_path: str) -> str:
    path = Path(prompt_path)
    if path.exists():
        content = path.read_text(encoding="utf-8", errors="ignore").strip()
        if content:
            return content
    return DEFAULT_PROMPT


def _pdf_to_images(file_bytes: bytes) -> list[str]:
    """
    Convert PDF bytes to base64 encoded JPEG images.
    """
    images = []
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))  # 2x zoom for better OCR
            img_bytes = pix.tobytes("jpeg")
            b64_str = base64.b64encode(img_bytes).decode("utf-8")
            images.append(b64_str)
        doc.close()
    except Exception as exc:
        raise ExtractionError(f"PDF to image conversion failed: {exc}") from exc
    return images


def _image_to_base64(file_bytes: bytes) -> str:
    """
    Read image bytes and return base64 string.
    """
    try:
        return base64.b64encode(file_bytes).decode("utf-8")
    except Exception as exc:
        raise ExtractionError(f"Image read failed: {exc}") from exc


def _prepare_multimodal_content(file_bytes: bytes, filename: str) -> dict:
    """
    Prepares content for multimodal LLM processing.
    """
    suffix = Path(filename).suffix.lower()
    
    # 1. Image Content
    images = []
    if suffix == ".pdf":
        images = _pdf_to_images(file_bytes)
    elif suffix in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}:
        images = [_image_to_base64(file_bytes)]
    else:
        raise ExtractionError(f"unsupported file type: {suffix}")

    # 2. Text Content (Fallback)
    text_content = ""
    if suffix == ".pdf":
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name
        try:
            text_content = pdfminer_extract_text(tmp_path)
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    return {
        "images": images,
        "text_fallback": text_content,
        "type": suffix
    }


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


def _parse_model_json(raw: str) -> dict[str, Any]:
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text.replace("json", "", 1).strip()
    return json.loads(text)


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
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
        return float(m.group(0))
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


def process_invoice(
    file_bytes: bytes,
    filename: str,
    prompt_content: str,
    model: str,
    temperature: float,
    base_url: str | None = None,
    api_key: str | None = None,
    booking_rules: list[dict[str, Any]] | None = None,
) -> InvoiceExtractionResult:
    """
    Unified entry point: Process invoice file -> Extract info & Classify -> Return Structured Data
    """
    normalized_rules = _normalize_booking_rules(booking_rules or [])
    if not normalized_rules:
        raise ExtractionError("No valid booking rules provided")

    # 1. Prepare Content (PDF -> Images)
    try:
        content_data = _prepare_multimodal_content(file_bytes, filename)
    except ExtractionError as exc:
        logger.error(f"Extraction failed: {exc}")
        # If extraction fails, we can't do much but return empty result or raise
        # Here we return a safe empty result with error in reason
        return InvoiceExtractionResult(
            category_code="SOBE",
            confidence=0.0,
            reason=f"File processing error: {exc}",
            remark="",
            invoice_number="",
            issue_date="",
            buyer_name="",
            buyer_tax_no="",
            seller_name="",
            seller_tax_no="",
            currency="",
            amount_excl_tax=None,
            tax_amount=None,
            amount_incl_tax=None,
            line_items=[],
            fallback_used=True
        )

    # 2. Setup LLM & Schema
    allowed_codes = [rule["code"] for rule in normalized_rules]
    prompt_content = f"{prompt_content}\n\n{_build_booking_rule_prompt(normalized_rules)}"
    
    # This Schema MUST match the fields we want to extract
    response_schema = {
        "category_code": "string, must be one of allowed codes",
        "confidence": "number between 0 and 1",
        "reason": "string",
        "remark": "string, invoice note/remark from 备注 field",
        "invoice_number": "string, 发票号码",
        "issue_date": "string, YYYY-MM-DD",
        "buyer_name": "string, 购买方名称",
        "buyer_tax_no": "string, 购买方纳税人识别号",
        "seller_name": "string, 销售方名称",
        "seller_tax_no": "string, 销售方纳税人识别号",
        "currency": "string, 原始票据币种，必须使用ISO 4217三位代码，例如 CNY, EUR, USD, JPY",
        "amount_excl_tax": "number or null, 不含税金额",
        "tax_amount": "number or null, 税额",
        "amount_incl_tax": "number or null, 价税合计(小写)",
        "line_items": [
            {
                "line_no": "integer",
                "description": "string, 货物或应税劳务、服务名称",
                "spec_model": "string, 规格型号",
                "unit_price": "number or null",
                "quantity": "number or null",
                "amount_excl_tax": "number or null, 金额",
                "tax_rate": "string, 税率",
                "amount_incl_tax": "number or null",
            }
        ],
    }

    format_instruction = (
        "你必须基于发票图片内容进行全要素提取和智能分类。"
        f"可用category_code仅限: {', '.join(allowed_codes)}。\n"
        "请仔细提取所有字段，特别是金额、日期和购买方/销售方信息。\n"
        "必须识别票据原始币种并输出currency。中文人民币发票输出CNY；欧元输出EUR；美元输出USD；日元输出JPY；德语、法语、英语、日语票据也必须识别币种。\n"
        "amount_excl_tax、tax_amount、amount_incl_tax必须保持票据原始币种金额，不要自行换算成人民币。\n"
        "如果字段缺失或无法识别，请返回null或空字符串。\n"
        "只输出JSON，不要额外解释。\n"
        f"JSON结构: {json.dumps(response_schema, ensure_ascii=False)}"
    )

    try:
        llm = ChatOpenAI(model=model, temperature=temperature, base_url=base_url, api_key=api_key)
        
        # Construct multimodal message
        content_parts = []
        content_parts.append({"type": "text", "text": format_instruction})
        
        images = content_data.get("images", [])
        file_type = content_data.get("type", ".jpeg")
        
        if images:
            # Add images (limit to first 5 pages)
            mime_type = "image/jpeg"
            if file_type == ".png":
                mime_type = "image/png"
            elif file_type == ".webp":
                mime_type = "image/webp"
            elif file_type == ".gif":
                mime_type = "image/gif"
            elif file_type == ".bmp":
                mime_type = "image/bmp"

            for img_b64 in images[:5]:
                content_parts.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime_type};base64,{img_b64}"}
                })
        else:
            # Fallback to text if no images
            text_fallback = content_data.get("text_fallback", "")
            user_input = text_fallback[:12000] if len(text_fallback) > 12000 else text_fallback
            content_parts.append({"type": "text", "text": f"\n\n以下是发票OCR/解析结果:\n{user_input}"})

        message = [
            SystemMessage(content=prompt_content),
            HumanMessage(content=content_parts),
        ]
        
        raw = llm.invoke(message).content
        parsed = _parse_model_json(raw)
        
        # Use text fallback for rule-based extraction if LLM fails or for remark extraction fallback
        text_content = content_data.get("text_fallback", "")

        return InvoiceExtractionResult(
            category_code=_normalize_code(str(parsed.get("category_code", "SOBE")), allowed_codes),
            confidence=max(0.0, min(1.0, _to_float(parsed.get("confidence")) or 0.2)),
            reason=str(parsed.get("reason", "模型未提供原因") or "模型未提供原因"),
            remark=str(parsed.get("remark", "") or "").strip() or _extract_invoice_remark(text_content),
            invoice_number=str(parsed.get("invoice_number", "") or ""),
            issue_date=str(parsed.get("issue_date", "") or ""),
            buyer_name=str(parsed.get("buyer_name", "") or ""),
            buyer_tax_no=str(parsed.get("buyer_tax_no", "") or ""),
            seller_name=str(parsed.get("seller_name", "") or ""),
            seller_tax_no=str(parsed.get("seller_tax_no", "") or ""),
            currency=_normalize_currency(parsed.get("currency")) or _extract_currency(text_content),
            amount_excl_tax=_to_float(parsed.get("amount_excl_tax")),
            tax_amount=_to_float(parsed.get("tax_amount")),
            amount_incl_tax=_to_float(parsed.get("amount_incl_tax")),
            line_items=_parse_line_items(parsed.get("line_items")),
            raw_model_output=raw,
            fallback_used=False,
        )
    except Exception as exc:
        logger.warning("LLM extract failed, fallback to rule-based: %s", exc)
        text_content = content_data.get("text_fallback", "")
        result = _rule_based_extract(text_content, normalized_rules)
        result.raw_model_output = f"llm_error: {exc}"
        return result
