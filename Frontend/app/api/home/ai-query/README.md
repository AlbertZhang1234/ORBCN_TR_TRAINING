# AI Query UI Implementation Notes

这个目录对应 `otto_v_tr_all` 的自然语言查询 agent。这里不仅有查询规划和执行逻辑，也沉淀了和 ORBCAFE AgentUI 配合时的 UI 实施经验。

## 目标定位

这个 agent 不是普通聊天机器人，而是企业报销/发票分析面板：

- 输入自然语言问题
- 自动规划查询参数
- 在权限范围内执行查询
- 输出面向业务用户的分析结果
- 优先展示 `结论 + KPI + markdown 表格 + 图表卡片 + suggestions`

## 目录职责

- `route.ts`: HTTP 入口，负责 NDJSON 流式事件输出
- `ottoVTrAllTool.ts`: 主编排，负责 LLM 调用、规划、执行、流式回答回调
- `planningRuntime.ts`: 自然语言 -> tool input 规划
- `queryRuntime.ts`: where/filter/access 约束
- `executionRuntime.ts`: 查询执行与结果汇总
- `answerRuntime.ts`: 最终回答组织、markdown 兜底、卡片拼接
- `cardRuntime.ts`: 卡片决策、校验、JSON card 构建
- `cardDataRuntime.ts`: 图表卡片数据装载
- `metadataRuntime.ts`: metadata 统计与缓存
- `prompts.ts`: planner / answer / card decision 提示词

## UI 接入经验

### 1. 状态流式和回答流式要分开

AgentUI 需要两类流：

- `status`：阶段状态流
- `message_start/message_delta/result`：正文消息流

只做 `status` 不算真正的聊天流式。用户会看到阶段更新，但正文仍然整段出现。

### 2. 回答流式必须发生在 LLM 调用层

如果后端还是：

- `fetch /chat/completions`
- `await response.json()`

那前端永远拿不到 token 级增量。真正的回答流式必须从 `callChatCompletionStream` 开始，按 SSE/`data:` 消费 delta。

### 3. 不能同时叠加两套打字机

如果：

- 服务端已经通过 `message_delta` 增量更新消息
- 前端还把同一条消息标成 `isStreaming: true`

那么 `AgentPanel` 内部的打字机动画会不断被重置，表现为闪烁、抖动、跳字。

结论：

- 真正使用 `message_delta` 时，消息对象应保持 `isStreaming: false`
- 只保留服务端 delta 驱动，不再叠加 UI 内建打字机

### 4. markdown 流式不能 trim delta

markdown 表格、标题、列表都依赖换行。

如果在 SSE delta 上做 `trim()`：

- `###` 标题会贴到正文里
- markdown table 会塌成普通文本
- 列表和分段会失效

结论：

- 对最终完整回答可以 `trim()`
- 对每个流式 delta 必须保留原始换行和空格

### 5. markdown 表格优先，卡片是增强层

文本回答必须优先可读：

- 有 groupedRows -> 必须有 markdown 汇总表
- 有 records -> 必须有 markdown 明细表
- KPI 放在表格前

卡片是补强，不是替代：

- `pie/bar/line` 用于对比、构成、趋势
- 即使有卡片，正文里仍应保留 markdown 表格

### 6. 卡片 JSON 必须服务端兜底

不要直接信任 LLM 产出的 card JSON。安全做法：

- 让 LLM 只决定 `showCards/cards`
- 服务端做字段白名单、类型白名单、topN 限制
- 服务端重新聚合数据后再生成 JSON card block

### 7. pie chart 的 percent 单位要注意

`orbcafe-ui` 的 `pie-chart-card` 中：

- 传了 `percent` 就直接使用
- 期望单位是 `0-100`

不要传 `0-1` 的比例值，否则 legend 和扇区会错。

### 8. fallback 不能只是“查不到”

业务分析 agent 在直接命中不足时要主动补位：

- 没有报销单时，补充同条件下发票数量和金额
- 维度没有非空值时，明确指出字段为空
- 补 suggestions，方便继续追问

## 当前输出契约

理想输出顺序：

1. 结论
2. KPI
3. markdown 汇总表或明细表
4. 1-3 条业务洞察
5. 图表卡片
6. suggestions-card

## 仍需注意的点

- markdown 表格在“流式尚未到达完整分隔线前”会短暂不像表格，这是正常现象
- 如果上游 LLM 网关没有返回 `text/event-stream`，正文会退回非 token 流
- `AgentPanel` 内部滚动区样式在深色模式下需要额外覆盖，否则原生滚动条会过亮
