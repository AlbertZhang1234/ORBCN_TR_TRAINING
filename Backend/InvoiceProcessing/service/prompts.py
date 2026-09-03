from __future__ import annotations
import json
from .rules import _build_booking_rule_prompt


def build_messages(prompt: str, rules: list[dict], images: list[str]) -> list[dict]:
    instruction = (
        '基于发票或收据图片提取全部字段并分类，只输出JSON。字段缺失返回null或空字符串。'
        'category_code只能使用提供的记账规则代码。必须提取所有明细，不得省略。'
        '金额保持原始币种，不要换算人民币；currency必须为ISO三位代码。'
        '收据优先读取Order Total、Payment Total、Total Paid、Amount Paid等实际支付金额，'
        '不要把折扣前小计当最终金额。最终支付金额填amount_incl_tax。'
        f'JSON结构：{json.dumps(RESPONSE_SCHEMA, ensure_ascii=False)}'
    )
    return [
        {'role': 'system', 'content': prompt + '\n\n' + _build_booking_rule_prompt(rules)},
        {'role': 'user', 'content': [{'type': 'text', 'text': instruction}, *image_parts(images)]},
    ]


def image_parts(images: list[str]) -> list[dict]:
    return [{'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{image}'}} for image in images]


def amount_messages(images: list[str]) -> list[dict]:
    instruction = (
        '只提取最终实际支付金额，优先读取价税合计、Order Total、Payment Total、Total Paid、Amount Paid，'
        '不要使用折扣前小计。不换算币种。只输出JSON：'
        '{"currency":"ISO三位币种","amount_excl_tax":null,"tax_amount":null,"amount_incl_tax":null}。'
        '将能确认的金额替换为数字，不能确认的保留null。'
    )
    return [{'role': 'user', 'content': [{'type': 'text', 'text': instruction}, *image_parts(images)]}]

RESPONSE_SCHEMA = {'category_code': 'string, must be one of allowed codes',
 'confidence': 'number between 0 and 1',
 'reason': 'string',
 'remark': 'string, invoice note/remark from 备注 field',
 'invoice_number': 'string, 发票号码',
 'issue_date': 'string, YYYY-MM-DD',
 'buyer_name': 'string, 购买方名称',
 'buyer_tax_no': 'string, 购买方纳税人识别号',
 'seller_name': 'string, 销售方名称',
 'seller_tax_no': 'string, 销售方纳税人识别号',
 'currency': 'string, 原始票据币种，必须使用ISO 4217三位代码，例如 CNY, EUR, USD, JPY',
 'amount_excl_tax': 'number or null, 不含税金额',
 'tax_amount': 'number or null, 税额',
 'amount_incl_tax': 'number or null, 价税合计(小写)',
 'line_items': [{'line_no': 'integer',
                 'description': 'string, 货物或应税劳务、服务名称',
                 'spec_model': 'string, 规格型号',
                 'unit_price': 'number or null',
                 'quantity': 'number or null',
                 'amount_excl_tax': 'number or null, 金额',
                 'tax_rate': 'string, 税率',
                 'amount_incl_tax': 'number or null'}]}
