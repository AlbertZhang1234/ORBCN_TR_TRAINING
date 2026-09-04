# 发票附件统一存储

普通报销发票和供应商发票共用 `otto_invoice_attachments` 与服务端附件服务。业务抬头仍存
`otto_invoices`，行项目仍存 `otto_invoice_lines`；附件表只保存文件元数据和正式发票关联，不保存二进制内容。

## 数据与文件

- 一张正式发票当前最多关联一个原始文件，`invoiceno` 唯一并外键关联 `otto_invoices`。
- 新文件使用 UUID 文件键，写入 `INVOICE_ATTACHMENT_STORAGE_DIR`；默认目录为
  `<Frontend工作目录>/data/invoice-attachments`。文件名与可修改的发票号码解耦。
- 表记录原文件名、实际 MIME、大小、存储类型和存储键。服务器根据文件签名校验格式，不信任浏览器扩展名。
- `managed` 表示新受管文件；`legacy-invoice` 表示历史 `data/<发票号>.*`；
  `legacy-supplier` 表示历史供应商 UUID 文件。旧文件保持原位，首次读取普通历史文件时按需登记；
  供应商已保存文件由迁移脚本批量登记。
- 替换附件时先安全写入新 UUID 文件，再提交元数据，提交失败会删除新文件；成功后清理旧受管文件。
- 删除未提交、未记账的发票时，数据库级联删除附件记录，提交成功后清理受管文件。历史文件默认保留，
  避免升级后意外删除原有归档。

## 共用入口

- 普通发票创建和批量识别通过 `/api/invoice/source` 写入附件表。
- 普通发票管理和供应商发票管理均通过统一附件服务读取；供应商待处理页仍按草稿 ID 读取上传文件。
- 报销审批后的财务邮件通过同一服务批量读取附件，不再扫描 `data` 目录自行匹配。
- 正式供应商发票保存时，在创建抬头、行项目和更新草稿的同一数据库事务内建立附件关联，不复制文件。
- 发票号码修改时同步更新附件关联；文件键无需变化。

读取权限为：发票所属用户、管理员、财务，以及其项目内发票的项目经理。附件新增、替换和发票删除仅允许
所属用户、管理员或财务。供应商待处理文件只允许上传人读取。

## 部署与兼容

1. 执行 `Backend/Database/migration/create_invoice_attachments.sql`。已有供应商草稿表必须先完成
   `create_supplier_invoice_drafts.sql`。
2. 将 `INVOICE_ATTACHMENT_STORAGE_DIR` 设置为所有 Next 实例共享的持久化卷；数据库与该目录必须一起备份。
3. `INVOICE_ATTACHMENT_MAX_MB` 控制两个入口的附件上限，默认 20 MB；未设置时兼容读取
   `SUPPLIER_UPLOAD_MAX_MB`。
4. 历史普通文件目录仍为 `<Frontend工作目录>/data`；历史供应商目录默认是
   `data/supplier-originals`，也可继续用 `SUPPLIER_INVOICE_STORAGE_DIR` 指定。
5. 部署新构建并重启 Next 服务。确认历史预览和邮件附件正常后，再制定旧目录迁移或保留策略。

数据库集成测试：

```powershell
$env:INVOICE_ATTACHMENT_INTEGRATION='1'
node --env-file=.env.local --import tsx --test tests/invoice-attachments.integration.test.ts
```

测试覆盖新文件保存、替换清理、权限、历史文件按需登记、批量邮件读取和发票删除清理。
