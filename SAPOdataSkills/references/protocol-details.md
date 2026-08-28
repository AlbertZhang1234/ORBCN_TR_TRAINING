# SAP OData 协议细节

## 版本和请求头

根据元数据和真实 Payload 判断版本，不能只根据 URL 推断。

OData V2 JSON 常用 `Accept: application/json`，JSON 写入常用 `Content-Type: application/json`。服务要求时，发送 `DataServiceVersion: 2.0` 和 `MaxDataServiceVersion: 2.0`。

OData V4 应使用 `OData-Version: 4.0`，并按需使用 `OData-MaxVersion: 4.0`。V4 媒体类型可能包含 `application/json;odata.metadata=minimal` 等参数。必须保留目标服务的特殊要求。

不要手工设置 `Host`、`Content-Length`、Connection 或 Transfer-Encoding 等传输请求头，应交给 HTTP 运行时计算。

## 响应结构

常见 V2 集合响应：

```json
{"d":{"results":[],"__next":"...","__count":"42"}}
```

常见 V2 单实体响应为 `{"d":{...}}`。V2 可能包含 `__metadata`、延迟加载的导航链接、字符串形式的小数，以及 `/Date(1704067200000)/` 之类的旧式日期。一些 SAP 服务也会返回普通 ISO 风格日期；应同时依据元数据声明和实际契约解析。

常见 V4 集合响应：

```json
{"@odata.context":"...","@odata.count":42,"value":[],"@odata.nextLink":"..."}
```

V4 单实体通常位于顶层并使用 OData 注解。空的成功响应也是合法结果，写入和删除尤其可能返回 `204 No Content`。

## 查询和主键构造

使用结构化 URL 和查询构造器。只开放应用允许的查询选项，不能接受不可信调用方传入的原始 OData 表达式。

- 字符串字面量中的单引号必须重复转义：`O'Brien` 变为 `'O''Brien'` 后再做 URL 编码。
- 根据版本和元数据格式化有类型的字面量；字符串、GUID、日期/时间、小数、布尔值和 Enum 不能互换。
- 使用准确的 SAP 属性名和值构造复合主键表达式。
- 使用 `$select` 和有上限的 `$top`；通过白名单验证 `$skip`、`$orderby`、`$expand` 和过滤字段。
- 避免大型或无边界的 `$expand`，否则可能造成昂贵的后端查询和过大的响应。

URL 百分号编码只保护 URI 语法，不能验证 OData 语法，也不能阻止表达式注入。

## 分页

V2 使用 `d.__next`，V4 使用 `@odata.nextLink`。续页链接可能包含 `$skiptoken` 或后端状态，应当作为不透明值处理。将相对链接解析到已知服务 Origin 后，发送认证或 Cookie 前必须验证解析后的协议、Origin 和服务根路径。

分别返回页面数据、Next Link 和 Count。若调用方要求拉取全部页面，必须限制最大页数、最大条数、总耗时并支持取消，否则变化中的数据集或异常链接可能造成无限工作。

V2 常通过 `$inlinecount=allpages` 返回 `__count`；V4 常通过 `$count=true` 返回 `@odata.count`。真实服务中的 Count 可能是字符串或数字，应显式转换。

## CSRF 和会话 Cookie

SAP Gateway 通常通过以下流程保护修改类请求：

1. 对服务接受的 `GET` 或 `HEAD` 发起已认证请求，并发送 `X-CSRF-Token: Fetch`。
2. 从响应头读取 `X-CSRF-Token`，并使用完整 Cookie Jar 或能保留多个 `Set-Cookie` 的运行时 API 捕获全部 Cookie。
3. 写入时发送 `X-CSRF-Token: <token>` 和匹配的会话 Cookie，并保持身份、SAP Client/租户、Origin 和服务上下文一致。

只有在作用域正确的会话中才能缓存 Token 或合并并发 Token 请求。若响应明确表示 Token 已过期或缺失，可以清除并重新获取一次；但只有能排除重复业务效果时才能重放写操作。CSRF Token 不能代替身份认证。

## 并发和条件请求

实体通过响应头或元数据提供 ETag 时，更新或删除必须通过 `If-Match` 携带该值。将 `412 Precondition Failed` 作为并发冲突暴露给应用，以便重新加载或让用户处理冲突。`If-Match: *` 会跳过版本匹配，只能作为明确的业务决策使用。

需要时可使用 `If-None-Match` 和条件 GET，但缓存不能跨 SAP 身份或租户共享。

## 操作、批处理和媒体

Action 或 Function Import 可能使用 GET 或 POST，也可能是 Bound 或 Unbound。必须从元数据确定名称、命名空间、参数和绑定方式，不能把 Action 当作普通实体集 POST。

`$batch` 使用 `multipart/mixed`，写入 ChangeSet 是否具备原子性取决于服务行为。需要生成或解析批处理时，应使用成熟的 OData/SAP 库。保留每个 Part 的状态和错误，不能假设外层 HTTP 状态代表所有内部操作。

媒体实体和流需要使用服务声明的 Content-Type，也可能通过 `$value` 访问。禁止对二进制或 Multipart Body 强制执行 JSON 序列化。

## 错误解析

SAP 错误可能是 JSON 或 XML。应捕获 HTTP 状态、SAP 错误 `code`、本地化 `message`（包括 V2 的 `message.value`）、Inner Error/Details、相关响应头，以及 `sap-message`、平台追踪头等请求关联信息。限制原始 Payload 大小并隐藏敏感数据。

将错误分类为：配置、网络/TLS/代理、超时或取消、认证、授权、CSRF、并发、限流或瞬时后端错误、验证或业务拒绝、未找到、无效响应。服务端日志应保留原始 Cause，返回给应用的错误必须安全。
