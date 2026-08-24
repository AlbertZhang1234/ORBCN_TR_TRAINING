# InvoiceProcessing Service

独立发票识别与分类服务，运行端口：`8201`。

## 功能
- 支持上传 `pdf/png/jpg/jpeg`
- 文本提取：优先 `MinerU`，失败自动回退
  - PDF 回退：`pdfminer.six`
  - 图片回退：`pytesseract`
- 分类：`LangChain + LLM`，若 LLM 不可用则规则分类兜底

## 目录
- `app.py`: FastAPI 入口
- `service/text_extractor.py`: 发票文本提取
- `service/classifier.py`: 发票类型分类
- `rule/prompt.md`: 分类提示词

## 启动
```bash
cd Backend/InvoiceProcessing
python3 -m pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8201
```

## Docker 启动
```bash
cd Backend/InvoiceProcessing
docker compose up -d --build
```
说明：Docker 镜像默认设置 `INVOICE_DISABLE_MINERU=1`，容器内走 `pdfminer/tesseract` 提取链路。

查看状态：
```bash
docker compose ps
```

停止服务：
```bash
docker compose down
```

## 环境变量
- `INVOICE_SERVICE_HOST` 默认 `0.0.0.0`
- `INVOICE_SERVICE_PORT` 默认 `8201`
- `INVOICE_MAX_UPLOAD_MB` 默认 `20`
- `INVOICE_PROMPT_PATH` 默认 `Backend/InvoiceProcessing/rule/prompt.md`
- `INVOICE_LLM_MODEL` 默认 `gpt-4o-mini`
- `INVOICE_LLM_TEMPERATURE` 默认 `0`
- `OPENAI_API_KEY`（使用 `langchain-openai` 时需要）
- 兼容 `.env` 自定义命名：`backend_llm_baseurl`、`backend_llm_apikey`、`backend_llm_model`
- 可选：`INVOICE_DISABLE_MINERU=1`（在受限环境跳过 MinerU，直接走回退提取）

## API
### Health
```bash
curl -sS http://127.0.0.1:8201/health
```

### 分类
```bash
curl -sS -X POST http://127.0.0.1:8201/api/v1/invoice/classify \
  -F "file=@/path/to/invoice.pdf"
```

返回示例：
```json
{
  "file": "invoice.pdf",
  "status": 200,
  "category_code": "BAHC",
  "invoice_number": "25119110010005973705",
  "issue_date": "2025-12-01",
  "buyer_name": "欧必盛信息科技(上海)有限公司",
  "buyer_tax_no": "91310000662486644Y",
  "seller_name": "中国铁路...",
  "seller_tax_no": "",
  "amount_excl_tax": 649.51,
  "tax_amount": 19.49,
  "amount_incl_tax": 669.0,
  "line_items_count": 1,
  "engine": "mineru",
  "fallback_used": false,
  "reason": "命中火车票关键字段"
}
```

## API 使用方法（对接版）
### 1. 启动服务
```bash
cd Backend/InvoiceProcessing
uvicorn app:app --host 0.0.0.0 --port 8201
```

### 2. 上传文件并获取结构化结果
- 请求方式：`POST`
- 接口地址：`/api/v1/invoice/classify`
- 请求体：`multipart/form-data`
- 必填字段：`file`（支持 `pdf/png/jpg/jpeg`）

`curl` 示例：
```bash
curl -sS -X POST "http://127.0.0.1:8201/api/v1/invoice/classify" \
  -F "file=@Backend/InvoiceProcessing/Tests/202511/25112000000230975627.pdf"
```

Python 示例：
```python
import requests

url = "http://127.0.0.1:8201/api/v1/invoice/classify"
file_path = "Backend/InvoiceProcessing/Tests/202511/25112000000230975627.pdf"

with open(file_path, "rb") as f:
    resp = requests.post(url, files={"file": (file_path, f, "application/pdf")}, timeout=120)

resp.raise_for_status()
print(resp.json())
```

### 3. 返回字段说明
- `file`: 上传文件名
- `status`: 业务状态码（成功固定为 `200`）
- `category_code`: 发票类别代码（来自 `rule/prompt.md`）
- `invoice_number`: 发票号码
- `issue_date`: 开票日期，格式固定 `YYYY-MM-DD`
- `buyer_name`: 购方公司名
- `buyer_tax_no`: 购方税号
- `seller_name`: 销方公司名
- `seller_tax_no`: 销方税号
- `amount_excl_tax`: 税前金额（两位小数）
- `tax_amount`: 税额（两位小数）
- `amount_incl_tax`: 含税金额（两位小数）
- `line_items_count`: 发票行数
- `engine`: 文本提取引擎（`mineru` / `pdfminer` / `tesseract`）
- `fallback_used`: 是否使用分类兜底
- `reason`: 分类原因

### 4. 常见错误码
- `400`: 文件名缺失、文件为空、文件格式不支持
- `413`: 文件超过大小限制（默认 `20MB`）
- `422`: 发票文本提取失败

## 注意
- `MinerU` 在部分受限沙箱环境可能无法创建进程池，本服务会自动回退到可用提取器。
- 图片 OCR 依赖系统安装 `tesseract` 命令行工具。
