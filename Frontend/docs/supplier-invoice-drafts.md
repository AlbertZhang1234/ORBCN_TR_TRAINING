# 供应商发票：持久化草稿与原文件

## 保存边界

- 上传接口先把 PDF/PNG/JPEG 写入服务器持久化目录，再创建 `otto_supplier_invoice_drafts` 记录；响应成功才表示上传成功。
- 草稿表记录上传人、原文件名、独立 UUID 文件键、MIME/大小、识别状态、识别原始结果、可编辑抬头/行项目 JSON、版本号和正式发票关联。
- 草稿允许字段暂时不完整，修改自动写库；正式保存才检查必填信息，不再设置确认步骤。
- “保存当前”保存当前发票；“保存全部”直接逐张保存全部未保存发票（先同步最新编辑）。识别中/排队中的任务跳过，校验或保存失败的草稿保留，并汇总成功、跳过、失败数量与原因；单张失败不影响其他发票。
- 正式保存复用现有发票保存规则：在同一数据库事务内创建 `otto_invoices`、`otto_invoice_lines`，并更新草稿状态及 `saved_invoice_no`。相同草稿重试保存是幂等的，其他草稿撞发票号码不会覆盖已有发票。
- 原文件只保存一份，文件键不依赖可修改的发票号码。正式保存不会复制/移动文件。

## 后台任务

Next.js Node 服务启动时由 `instrumentation.ts` 注册后台轮询器。采用数据库 `FOR UPDATE SKIP LOCKED` 领取任务，每实例最多两个并发识别。识别客户端与原报销发票上传共用，仍调用现有 8201 服务，不新增模型服务。

任务领取后租约为 5 分钟，识别 HTTP 超时为 4 分钟。服务中途退出时，重启后租约过期的任务重新领取；租约令牌保证旧执行结果不能覆盖新执行结果。普通识别失败保存为错误状态，用户可重新识别。无需网页一直打开。

该实现面向当前常驻 Node/Next 服务部署。若改成请求结束就冻结进程的无服务器部署，应把同一个 worker 入口迁移到常驻任务进程。

## 配置和上线

1. 执行 `Backend/Database/migration/create_supplier_invoice_drafts.sql`。此表启用 RLS，无匿名客户端策略；服务数据库连接需为表所有者或具备相应服务权限。
   已有部署还需在一个事务内执行 `remove_supplier_invoice_draft_confirmation.sql`，将历史已确认草稿改为待处理状态并移除确认状态约束；不删除草稿内容或原文件。
2. `SUPPLIER_INVOICE_STORAGE_DIR`：建议生产显式设置到持久化卷；默认 `<Frontend工作目录>/data/supplier-originals`。
3. `SUPPLIER_UPLOAD_MAX_MB`：默认 20 MB；需与识别服务限制协调。
4. 部署新构建并重启 Next 服务，使后台注册入口生效；8201 识别服务继续保持运行。
5. 多实例必须共享同一文件存储目录/卷。数据库和原文件目录都应备份，不能只备份数据库。

`SUPPLIER_DRAFT_WORKER_DISABLED=1` 仅用于测试/构建隔离。`NEXT_DIST_DIR` 可用于在独立目录构建验证版本，避免覆盖运行服务的 `.next` 文件。

## 页面与权限

工作台只读取当前用户未完成的草稿任务。正式保存成功后立即从识别列表移除，已保存发票统一到供应商发票管理查看；不删除数据库任务记录或原文件，保留正式发票的原文件关联。应用布局中的独立 store 只负责维护在途请求；数据库才是持久化来源。切换菜单不终止上传/自动保存。刷新关闭时若仍在上传或同步，会提示等待；已经上传成功的识别任务和已经同步的草稿均可恢复。轮询不会让已保存任务重新出现，其他页面保存的任务在下一次同步后退出列表。

多标签页用版本号检查，冲突返回 409；不会静默覆盖另一个页面的内容。可以明确放弃本地未同步内容并重新加载服务器草稿。

待处理页面的“查看原始文件”按草稿 ID 校验上传人；管理页点击发票号码按正式发票 ID 校验上传人或管理员/财务权限，且只允许业务类型 01/02。历史供应商发票可回退读取旧 `data/<发票号>.<扩展名>` 文件；不存在的原文件明确提示错误。原先未正式保存且已丢失的浏览器内存草稿无法追溯恢复。

## 验证

管理页选中一张供应商发票后可点击修改，读取已保存抬头及全部行项目，复用识别页编辑器。
支持修改发票号码、业务字段、原币金额及币种，并新增、复制、删除行；提交和记账状态由原工作流控制。
保存通过 `/api/supplier-invoices/detail` 在同一事务中更新抬头、行项目及已保存草稿，空字段可清空。
读取版本与保存时内容不一致则返回 409，避免覆盖其他页面的修改。已提交或已记账的发票不可编辑；
管理员及财务可修改其他用户发票，普通用户只能修改自己的发票且不可转移所属用户。
修改号码时同步行项目、报销关联和原文件关联，无需数据库迁移；旧文件按需复制到 UUID 存储，原文件保留。
新旧关联与数据保存一起提交，失败时回滚并清理临时副本。

管理页编辑的数据库集成测试使用隔离 schema，验证后整体回滚：设置 `SUPPLIER_EDIT_INTEGRATION=1`，运行
`node --env-file=.env.local --import tsx --test tests/supplier-invoice-edit.integration.test.ts`。

```
npx tsx --test tests/supplier-draft-store.test.ts tests/supplier-invoice-recognition.test.ts tests/invoice-lines.test.ts
```

数据库集成测试需显式设置 `SUPPLIER_DRAFT_INTEGRATION=1`，运行：

```
node --env-file=.env.local --import tsx --test tests/supplier-drafts.integration.test.ts
```

测试创建事务内隔离 schema 和临时文件目录，验证完成后回滚整个 schema 并清理测试文件，不修改已有发票。识别使用固定测试结果，不调用真实模型。

真实 HTTP 与后台启动/恢复测试：先构建 `NEXT_DIST_DIR=.next-supplier-check`，再设置 `SUPPLIER_DRAFT_HTTP=1` 运行 `node --env-file=.env.local --import tsx --test tests/supplier-drafts.http.test.ts`。测试使用 18200 端口、独立数据库 schema 和临时原文件目录，启动真实 Next 服务与本地识别桩，验证上传后离开页面、恢复草稿、原文件接口和服务重启后任务重领，最终自动清理。

后台入口遵循 [Next.js instrumentation 文档](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)。
