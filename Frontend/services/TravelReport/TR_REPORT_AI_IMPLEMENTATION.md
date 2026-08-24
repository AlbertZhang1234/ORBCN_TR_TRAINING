# TR Report AI 功能实现笔记

## 目标

在 `tr-report` 页面里，用户通过 Header 搜索框输入自然语言报表需求，系统自动生成 Pivot 配置并刷新报表，不走单独的 AI Panel。

核心能力：

- 自然语言 -> `rows / columns / filters / values / filterSelections`
- 实时反馈 AI 三阶段状态（理解问题、分析工具、执行配置）
- AI 运行时对整个 Pivot 窗口显示流光边框
- 结果直接应用到受控 `CPivotTable` 模型

---

## 目录与文件

依赖版本：

- `orbcafe-ui ^1.1.5`

### 1) 前端页面编排

- `Frontend/app/pc/tr-report/page.tsx`

职责：

- Header `onSearch` 直接触发 `/api/tr-report/ai`（NDJSON 流式）
- 将 AI 返回的 `TrReportAiPlan` 应用到 `usePivotTable` 受控模型
- 使用新版内建 `PivotChart` 能力，接入 `initialChart / initialChartCollapsed / initialTableCollapsed`
- 展示三灯珠状态（仅 AI running 时显示）
- AI 运行时渲染 Pivot 外层流光边框
- 对日期做标准化并拆分年/月/日维度字段

### 2) AI 字段协议与类型

- `Frontend/services/TravelReport/pivotAi.ts`

职责：

- 定义工具名：`apply_tr_report_pivot`
- 定义阶段枚举：`question_understanding | tool_analysis | tool_execution`
- 定义计划结构 `TrReportAiPlan`
- 维护字段目录（类型、角色、别名、可用聚合）

### 3) AI API 路由（流式）

- `Frontend/app/api/tr-report/ai/route.ts`

职责：

- 接收 `question`
- 解析权限上下文
- 调用 runtime 生成计划
- 以 NDJSON 事件流返回：`status / result / message_start / message_delta / error`

### 4) AI runtime（规划核心）

- `Frontend/app/api/tr-report/ai/runtime.ts`

职责：

- 加载运行时元数据（top values）
- LLM 规划 + 启发式兜底
- 过滤值规范化（审批状态、记账状态、费用类别、日期）
- 布局清洗与再平衡（重点：维度在行列间分配，不全塞行）

---

## 前端执行流程

1. 用户在 Header 搜索框输入需求。
2. `page.tsx` 发起 `POST /api/tr-report/ai`，`stream: true`。
3. 收到 `status` 事件时更新三灯珠状态。
4. 收到 `result.plan` 后调用：
   - `pivotActions.setLayout(...)`
   - `pivotActions.setChartDimension(...)`
   - `pivotActions.setChartPrimaryValue(...)`
   - `pivotActions.setChartSecondaryValue(...)`
   - `pivotActions.setChartType(...)`
   - `pivotModel.setFilterSelections(...)`
   - `pivotModel.setShowGrandTotal(...)`
5. AI running 结束后关闭灯珠与流光状态。

---

## PivotChart 接入方式

新版 `orbcafe-ui` 已把 `PivotChart` 集成到 `CPivotTable/usePivotTable` 内部，因此不需要单独拼一个外部图表组件。

当前接法：

- `usePivotTable()` 传入 `initialChart`
- 同时开启：
  - `initialChartCollapsed: false`
  - `initialTableCollapsed: false`
- `defaultPresets` 中补 `chart` 快照
- AI 应用新布局时，按当前 `rows / columns / values` 自动重算默认图表配置

默认图表策略：

- 图表维度优先取 `rows[0]`，否则取 `columns[0]`
- 主度量取 `values[0]`
- 对比度量取 `values[1]`（如果有）
- 若维度是年月日或日期字段，则默认 `line`
- 其他维度默认 `bar-vertical`

---

## AI 规划逻辑（runtime）

### 1) 三类信息拆解

- 维度（Dimensions）：放 `rows/columns`
- 度量（Measures）：放 `values`
- 精确约束（Exact filters）：放 `filterSelections`

### 2) 清洗规则

- 仅允许字段目录中的 fieldId
- 去重，避免同字段出现在多个 zone
- 若字段有 `filterSelections`，从 rows/columns 移除并加入 filters

### 3) 维度再平衡（关键改进）

通过 `rebalancePlanDimensions()`：

- 对 ID/Name 成对字段做分组（如项目、申请人、客户）
- 保障同组字段在同一轴
- 在有多个维度组时，自动分配一部分到 columns
- 状态、月份、币种、费用类别优先列轴（在存在主实体维度时）

这样避免“AI 把所有维度都丢到 rows”。

---

## 日期维度处理（非 AI 但影响结果）

在 `page.tsx` 中新增 `toDateParts()`：

- 支持解析 `YYYY-MM-DD` / `YYYY/M/D` / 可被 `Date` 识别的字符串
- 输出标准化：
  - `year: YYYY`
  - `month: YYYY-MM`
  - `day: YYYY-MM-DD`

并为关键日期字段提供三级维度：

- 创建时间：`tr_created_year/month/day`
- 发票日期：`invoicedate_year/month/day`
- 行程起止：`travel_from_year/month/day`、`travel_to_year/month/day`

目的：避免把具体日期当“月”后出现 `Fri Mar` 这种错误分组。

---

## 当前 UI 约定

- 不使用 `AgentPanel`
- 三灯珠仅 AI 运行时显示
- 三灯珠位置在“方案下拉框”左侧，透明叠加，不遮挡内容
- AI 运行时 Pivot 外框显示流光边框；非运行时恢复普通边框

---

## 可扩展建议

- 继续扩字段别名（业务术语同义词）提升命中率
- 增加更多低基数字段优先列轴策略
- 在 `runtime` 增加计划质量日志，便于定位误判
- 后续可加“保存本次 AI 布局为预设方案”能力
