# InvoiceProcessing Service

发票识别服务，默认端口 8201。普通报销和供应商后台任务共享此服务。

## 本轮处理流程

1. Next 服务从 `otto_system_config` 读取管理员保存的识别参数。
2. 两个入口通过 `otto_invoice_recognition_leases` 共享识别额度；领取额度的短事务结束后才发送 HTTP 请求。
3. Python 在独立进程池中处理 PDF / 图片。PDF 一次打开，提取原生文本并渲染所有允许的页面；不再写临时文件或重复跑 pdfminer。
4. 长边和 JPEG 质量限制控制图片体积。超过 PDF 页数限制时返回 422，明确要求拆分，绝不静默舍弃后续页。
5. 复用异步 HTTP 客户端调用当前部署配置指定的兼容模型。初次识别、网络/格式重试、补金额共享有限次数与总预算。
6. 已有不含税金额和税额时先计算总额；仍缺总额且有额外调用额度时才补识别。模型全部失败时仅使用原生 PDF 文本作规则兜底；没有可用结果则报错。
7. HTTP 客户端断开或总预算耗尽时取消异步模型调用；已经开始的本地进程计算可能继续结束，但不会继续调用模型。

这一轮保留视觉识别主路径。文本/视觉自动分流、文件指纹缓存、多页分批合并不在本轮启用。
原有超过 400 行的报销导入弹窗和翻译字典仅做与本轮相关的局部接入，保留现有保存、报销跳转和其他页面翻译，避免顺带重构历史 UI；新增后端模块均低于 400 行。

## 升级与启动

先使用服务端数据库角色执行 `../Database/migration/create_system_config.sql`。新增两张表均启用 RLS，无匿名读写策略。
新库的完整 `schema.sql` 已包含这两张表。迁移可重复执行，不修改既有发票。

```powershell
cd Backend/InvoiceProcessing
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m uvicorn app:app --host 127.0.0.1 --port 8201
```

升级 Python 依赖并重启 8201 服务，然后部署并重启 Next 服务。构建 Next 时可设置 `SUPPLIER_DRAFT_WORKER_DISABLED=1`；运行时应移除此测试开关。
管理员进入“系统设置 → 系统配置”调整参数。保存使用版本号检查，多管理员冲突返回 409；新任务读取新参数，已经开始的任务保留原参数。
降低总并发不会中止已在执行的任务；等待它们完成后按新额度准入。供应商 worker 在空闲时轮询，任务完成后立即补充空闲槽位。

## 配置边界

`tuning.schema.json` 是 Python 校验、Next 服务校验和配置页字段的共同定义，包括：

- 上传并发（默认 3）、普通报销批量并发（2）、供应商后台并发（每实例 2）、跨入口总识别并发（2）。
- 等待额度上限（45 秒）、单张处理总预算（180 秒）、单次模型超时（60 秒）。
- 额外模型调用次数（1），异常重试和补金额共用；补金额开关（开）。
- 单份 PDF 页数（5）、图片最长边（2400 像素）、JPEG 质量（85）。

配置页仅管理员可读写。普通用户只能读取批量上传所需的两个并发参数。
总并发作用于共用数据库的 Next 入口，识别端口应仅对可信应用服务开放；直接绕过 Next 调用 8201 不参与数据库额度管理。

部署配置继续使用环境变量：

- `INVOICE_LLM_BASE_URL` / `INVOICE_LLM_MODEL` / `OPENAI_API_KEY`，兼容 `backend_llm_baseurl` / `backend_llm_model` / `backend_llm_apikey`。
- `INVOICE_LLM_TEMPERATURE` 默认 0。
- `INVOICE_MAX_UPLOAD_MB` 默认 20。Next 供应商入口的 `SUPPLIER_UPLOAD_MAX_MB` 应与之协调。
- `INVOICE_PREPROCESS_WORKERS` 默认 2，范围 1–4；变更需重启。PDF 不在线程中运行。
- `INVOICE_PROMPT_PATH` 可覆盖提示词路径。提示词在进程启动时加载，修改需重启。
- Next 的 `INVOICE_PARSE_ENDPOINT` 指向 8201 接口。

后台草稿租约为 5 分钟。配置限制保证正常 HTTP 路径的最大排队 60 秒 + 处理 210 秒 + 传输宽限 10 秒低于租约。
共享识别额度使用独立到期租约，进程退出后可自动回收。普通报销等待额度超时会提示繁忙；供应商任务回到队列，避免把容量不足误记为识别失败。

## 日志

相关日志统一保存到 `Backend/log`：

- `invoice-client-YYYY-MM-DD-PID.jsonl`：共享额度等待、配置版本、请求大小、整体耗时与错误类型。
- `invoice-processing-PID.jsonl`：预处理、文本提取、渲染、进程等待/传输、每次模型调用及总耗时。每文件 10 MB，最多保留 5 份轮转文件。

两端通过 `request_id` 关联。不记录发票正文、原文件名、识别输出或密钥。Next 日志按天和进程分文件；长期部署可用运维日志保留策略清理旧日期文件。
默认 Node 从 Frontend 工作目录定位 `../Backend/log`，Python 从模块路径定位 `Backend/log`。分开部署时用 `BACKEND_LOG_DIR` 指向对应挂载目录。
Docker Compose 已把 `../log` 挂载到 `/app/log`，不把 `.env` 或本地虚拟环境打包进镜像。

响应中附带 `request_id`、`timings`。日志的 `preprocess_wait_ms` 包含进程排队、冷启动及进程间传输；不是纯 CPU 执行时间。

## API

`POST /api/v1/invoice/classify`，multipart 表单：

- `file`：PDF / PNG / JPG / JPEG / WEBP / GIF / BMP。
- `booking_rules`：有效记账规则 JSON 数组，必填。
- `options`：符合 `tuning.schema.json` 的参数对象 JSON，省略时使用默认值。

支持头 `x-request-id`。返回发票头、币种、金额、完整明细、分类及置信度；接口保留原字段并新增请求编号与耗时。
400 表示参数问题，413 表示文件过大，422 表示文件无法处理或没有可用识别结果，504 表示总预算耗尽。

## 验证

在本目录执行：

```powershell
.venv/Scripts/python -m unittest test_invoice_processing -v
```

测试使用生成的 PDF、模拟模型和真实进程池，覆盖页数上限、尺寸、金额补识别、重试次数、总预算、客户端断开、HTTP 参数与日志；不调用外部模型。

在 Frontend 目录执行：

```powershell
node --import tsx --test tests/invoice-performance.test.ts tests/supplier-draft-store.test.ts
```

`SYSTEM_CONFIG_INTEGRATION=1` 加 `DATABASE_URL` 可运行 `tests/system-config.integration.test.ts`，创建隔离 schema 验证配置版本冲突和多个客户端的共享额度，然后清理。
`SUPPLIER_DRAFT_HTTP=1` 可运行已有 `tests/supplier-drafts.http.test.ts`，验证实际 Next HTTP / 后台识别 / 服务重启；用 `NEXT_DIST_DIR` 指定已构建的隔离目录。

上线后使用同一批电子 PDF、扫描件和多页票据比较单张、5 张和 10 张：排队耗时、P50/P95、总完成时间、模型调用数，以及金额和明细准确率。模拟模型测试不能替代真实票据准确率和提速验证。
