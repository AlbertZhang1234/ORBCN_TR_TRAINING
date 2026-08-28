# 故障排查、安全和生产准备

## 按阶段诊断

记录安全的关联日志，包括 Destination 或服务名称、HTTP 方法、脱敏路径、请求 ID、状态码、耗时、允许重试时的尝试次数、SAP 错误码和失败阶段。

1. 配置：URL、版本、认证、Client/租户、超时或 CA 路径缺失或格式错误。
2. 名称与网络：DNS、路由、VPN、防火墙、Cloud Connector、代理连通性。
3. TLS：主机名、有效期、中间证书链、企业代理 CA、mTLS 证书。
4. 身份认证：Basic/Bearer/OAuth/Destination/证书的获取和服务端接受情况。
5. SAP 授权：服务激活、ICF/Gateway 权限、后端业务权限、Client。
6. CSRF 与会话：Token 获取端点、响应头、多 Cookie、身份与 Client 一致性、过期。
7. 请求契约：服务路径、实体或 Action、方法、请求头、主键/过滤语法、Body 类型。
8. SAP 业务错误：验证或后端业务处理详情。
9. 响应契约：V2/V4 封装、Content-Type、空 Body、意外 HTML/XML、元数据不一致。

## 常见现象

出现 `self signed certificate`、`unable to verify` 或未知 CA：为运行时安装所需 CA 证书链，或配置仅限 SAP Transport 使用的 CA Bundle。禁止设置全局不安全 TLS 标志。

浏览器或 Postman 可用但应用不可用：比较代理/VPN、证书存储、认证重定向和 Cookie、SAP Client 参数、DNS 和运行环境。浏览器可能自动使用 SSO、操作系统代理和证书，而服务端运行时不会。

返回 `200` 但 Body 是 HTML：通常是 SSO/登录页面、Web Dispatcher 重定向或路径错误。检查最终 URL 和 Content-Type，不能自动跟随认证重定向后把结果当作 OData。

读取成功但写入返回 `403`：检查 `X-CSRF-Token`、全部会话 Cookie、Token 获取路径、SAP Client、认证身份和 Token 有效期。同时区分 CSRF 失败和缺少 SAP 写权限。

CSRF 间歇失败：检查全局单例 Client 是否混用了用户或租户、Cookie 是否解析不完整、Token 获取是否存在并发竞争、代理是否删除请求头，或 SAP 会话是否在长时间间隔后过期。

集合解析器找不到数据：检查 V2 的 `d.results`、V4 的 `value`、Content-Type，以及端点返回的是单实体或 Action 结果而不是集合的可能性。

日期偏移一天：仅日期的 SAP 或业务值错误地经过本地/UTC DateTime 转换。应保留日期字符串或使用 Date-Only 类型。

小数精度丢失：JSON Number 被转换成二进制浮点数。保留小数字符串或使用 Decimal 库/类型。

写入后超时：结果是“未知”，不一定失败。任何重放前都应使用稳定业务主键或读取端点核对结果。

## 重试策略

只对符合条件的瞬时读取失败使用带 Jitter 的有界指数退避，例如响应前连接重置，以及 `408`、`429`、`502`、`503`、`504`；同时遵守 `Retry-After`。限制最大次数和总耗时，并传播取消信号。

如果没有明确恢复动作，不应重试 `400`、`401`、`403`、`404`、业务验证错误或并发冲突。超时或传输结果不确定后，禁止自动重放 POST/PATCH/DELETE。只有响应能够证明写入未进入处理阶段，或操作可靠幂等时，才能执行一次 CSRF 刷新和重放。

## 服务端请求伪造（SSRF）和查询安全

使用 SAP Destination Origin 白名单。配置的服务根路径必须与调用方输入分离。跟随 Next Link 时，解析后检查协议、主机、端口和服务根路径，再附加认证或 Cookie。阻止跳转到非预期 Origin，或在跨 Origin 重定向时删除敏感请求头。

对外提供结构化应用过滤条件，不能暴露原始 `$filter`、`$expand`、Action 名称、实体集或 URL 参数。通过白名单和类型化字面量序列化，避免集成接口成为任意 SAP 查询代理。

## 密钥和数据保护

在 Logger 或日志 Sink 边界隐藏 `Authorization`、`Proxy-Authorization`、`Cookie`、`Set-Cookie`、`X-CSRF-Token`、OAuth Client Secret、私钥、证书材料和签名 URL。请求或响应 Body 可能包含员工、供应商、发票、工资、银行等受保护数据。优先记录字段名或数量等元数据，而非完整 Body；设置大小限制、访问控制、保留期和删除策略。

返回安全的应用错误消息，完整诊断 Cause 只保留在受保护的服务端日志中。禁止返回 SAP 凭证或原始 HTML 登录响应。

## 生产准备检查

- 连接和整个请求都具有超时，取消信号可以传播。
- 在安全范围内使用连接池，但不能错误地合并身份或会话状态。
- 指标区分成功、SAP 业务拒绝、认证或授权、CSRF、超时、瞬时后端错误、无效响应和并发冲突。
- 告警基于错误率和延迟，不能包含 Payload 数据。
- 健康检查只读且轻量，不能在每个业务请求中调用 `$metadata`。
- 凭证、Token 和证书无需改代码即可轮换；Bearer 刷新具备并发安全性。
- 代理和自定义 CA 配置只影响 SAP Transport。
- 部署文档说明所需 SAP 服务激活、角色、Client 和网络依赖。
- 当业务风险较高时，可以通过回滚或 Feature Flag 单独关闭写入而保留读取。
