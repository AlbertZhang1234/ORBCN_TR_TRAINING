# 20260308 版本变更记录（相对上一版）

- 分支：`20260308`
- 对比基线：`db22f69898d212c9c20d9b75eac57bf4706a7ec3`（`2026-02-27 17:44:49 +0800`）
- 对比方式：当前工作区（含已跟踪修改 + 新增文件）相对基线提交

## 1. 变更规模

- 已跟踪文件变更：`43` 个
- 代码统计：`+1193 / -909`
- 新增未跟踪文件：`8` 个

## 2. 功能与代码改动（按模块）

### Frontend/app（19 文件）
- 新增财务报表页面：`Frontend/app/pc/tr-report/page.tsx`（TRReport，透视表）
- 导航与多语言：
  - `Frontend/app/pc/_components/nav.tsx`
  - `Frontend/app/pc/_components/PcI18nProvider.tsx`
- 管理代理权限与可见性控制：
  - `Frontend/app/api/admin/supabase/route.ts`
- 报销相关页面与交互增强：
  - `Frontend/app/pc/reimbursements/*`
  - `Frontend/app/pc/approve/page.tsx`
- 多页面统一补齐 `tableProps.appId` 等兼容改动：
  - `users / roles / projects / customers / invoices / travel-entries / home`

### Frontend/services（10 文件 + 2 新文件）
- 新增报表数据服务：`Frontend/services/TravelReport/list.ts`
- 新增客户端登出服务：`Frontend/services/Auth/logoutClient.ts`
- 报销审批/创建/修改/删除/列表逻辑调整：
  - `Frontend/services/TravelReimbursement/*`
- Supabase 表配置与代理白名单扩展：
  - `Frontend/services/_core/tables.ts`
  - `Frontend/services/_core/supabaseRest.ts`
- Variant service 类型与存储键策略兼容：
  - `Frontend/services/common/variant-service.ts`

### Frontend/components（4 文件）
- `CVariantManagement` 与 `CVariantManager` 类型/布局引用兼容调整
- 首页卡片与头部动作组件更新

### Backend/Database（3 文件 + 1 新文件）
- 新增报销总览视图脚本：`Backend/Database/migration/create_otto_v_tr_all.sql`
- Schema 更新（含 `otto_v_tr_all` 视图定义与字段补充）
- 迁移与文档同步调整：
  - `Backend/Database/migration/migrate_pg.js`
  - `Backend/Database/supabase.md`

## 3. 新增文件清单（8）

1. `Backend/Database/migration/create_otto_v_tr_all.sql`
2. `Frontend/app/api/reimbursement/approval-action/route.ts`
3. `Frontend/app/api/reimbursement/approve/route.ts`
4. `Frontend/app/api/reimbursement/sendtoapprover/route.ts`
5. `Frontend/app/pc/tr-report/page.tsx`
6. `Frontend/services/Auth/logoutClient.ts`
7. `Frontend/services/TravelReimbursement/serverApproval.ts`
8. `Frontend/services/TravelReport/list.ts`

## 4. 仓库规范化与缓存清理

- 已清理缓存/临时产物：
  - `Frontend/.next`
  - `Frontend/tsconfig.tsbuildinfo`
  - `__pycache__`、`.DS_Store` 等
- 已删除运行时文件（原先被跟踪）：
  - `.run/backend_8201.pid`
  - `.run/frontend_8200.pid`
  - `.run/logs/backend_8201.log`
  - `.run/logs/frontend_8200.log`
- `.gitignore` 已补充：
  - `.run/`
  - `old_db_dump.json`

## 5. 上传 GitHub 前建议检查

1. `git status` 确认提交范围
2. `git add -A && git commit -m "chore: prepare release 20260308"`
3. `git push -u origin 20260308`

