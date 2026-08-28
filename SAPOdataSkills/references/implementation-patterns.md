# 实现模式

## 选择集成方案

如果只接入少量端点，优先复用仓库现有的 HTTP 客户端和依赖管理方式。如果项目已经使用 SAP/OData SDK，或者元数据生成、Batch、Destination、Principal Propagation、复杂 Action、大型 Schema 等能力确实有价值，则使用维护良好的 SDK。

除非现有技术栈无法支持 Cookie Jar、代理、自定义 CA、流式数据或必要认证，否则不要仅为 SAP 引入第二套 HTTP 客户端。

在 SAP BTP 或托管云环境中，优先使用已配置的 Destination/Connectivity 服务和平台身份传播，不要在应用中重新实现凭证管理。将 Destination 适配器放在统一的认证和传输接口后面。

## 推荐边界

```text
入口/Controller/Route
  -> 应用服务或 Use Case
    -> SAP 业务 Gateway
      -> 通用 OData Transport
        -> 注入的 HTTP/Auth/Cookie/Proxy/Logger 依赖
```

- 入口：认证和授权应用调用方、解析并验证传输参数、调用一个 Service、转换错误响应。
- 应用服务：业务权限、流程、编排、幂等和结果核对。
- SAP 业务 Gateway：服务定义、实体或 Action 路径、类型化过滤器、原始 SAP DTO、Payload 映射。
- OData Transport：URL、认证、超时、CSRF/Cookie、版本请求头、响应和错误封装、分页机制。
- Composition Root：读取环境或平台配置并创建具体依赖。客户端包含身份或会话状态时，禁止创建模块级全局实例。

领域层不能读取环境变量、导入 Web 框架或依赖具体 HTTP 库。

## 配置模型

配置名称应符合项目约定，但至少覆盖：

```text
SAP_ODATA_BASE_URL
SAP_ODATA_SERVICE_ROOT
SAP_ODATA_VERSION=v2|v4
SAP_ODATA_AUTH_MODE=basic|bearer|oauth2|destination|mtls|...
SAP_ODATA_CLIENT
SAP_ODATA_LANGUAGE
SAP_ODATA_TIMEOUT_MS
SAP_ODATA_PROXY_URL
SAP_ODATA_CA_FILE
```

密钥存放在平台 Secret Store 中。在启动或组装依赖时验证必填值和数字范围。禁止对服务端凭证使用会暴露到前端的公开配置前缀。基础 Origin 和服务根路径应分开，使业务模块不包含环境专用主机地址。

## 认证和会话接口

将认证设计为可注入 Provider，由其返回请求头或配置 Transport。Bearer Provider 应获取和刷新 Token，不能在进程启动时永久缓存一个会过期的 Token。Basic Auth 编码应使用运行时正确的字节和字符集行为。mTLS 必须在 Transport 层配置客户端证书和私钥，并严格保护密钥。

Cookie Jar 和 CSRF 缓存应按 Destination/Origin、SAP Client/租户、服务根路径和已认证 SAP 身份划分作用域。一个应用请求需要连续执行多次同上下文写入时，可以复用该 Client/Session；不能在无关用户之间共享可变 Cookie Jar。

通过每个作用域的 Promise 或 Lock 合并并发 CSRF 请求。失败后必须移除 In-Flight 状态，使后续请求能够恢复。

## 请求 API 形态

通用适配器通常需要：

- 用于特殊操作的通用 Request；
- 获取单实体和集合；
- 跟随续页 URL；
- 获取 Metadata；
- Create/Update/Delete Helper；
- 仅在需要时增加 Action/Function、Batch 和媒体 Helper；
- 请求级超时、取消、关联 ID、自定义请求头和 CSRF Override。

实体和服务定义应具有类型，并靠近业务 Gateway。需要支持自定义请求头，但不能允许调用方意外覆盖受保护的认证或会话请求头；请求头优先级必须明确。

只对普通 JSON 对象进行 JSON 序列化。字符串、FormData、Stream、Buffer 和 Multipart Body 应保持原形。如果运行时把二进制或 Form Body 表示为对象，不能把所有对象都推断成 JSON。

## 映射规则

原始 DTO 使用 SAP 的准确字段大小写，并在 Gateway 边界映射到应用名称和类型。

- 小数：对精确金额避免使用二进制浮点数；保留字符串或使用项目的 Decimal 类型，并遵守元数据的 Precision/Scale。
- 日期时间：区分 `Edm.Date`、`Edm.DateTime`、`Edm.DateTimeOffset` 和本地业务日期。不能让时区转换改变仅日期值。
- Null 和空值：SAP 可能区分 Null、空字符串、零和未传属性。
- 主键：除非服务契约明确做了标准化，否则保留前导零和 SAP Conversion Exit 语义。
- 布尔值：不能把任意非空字符串转成 True。
- 导航和延迟值：只有已经 Expand 或加载时才映射。

Payload 验证和业务计算应放入纯函数，以便在没有 SAP 连接时测试。

## 测试策略

使用注入或模拟 Transport 的协议测试应覆盖：

- 基础路径、服务路径和请求路径拼接，以及查询和字面量编码；
- 所用版本的 V2/V4 实体和集合封装；
- 相对或绝对续页链接验证；
- 认证请求头行为，并确认日志不会记录密钥；
- 超时和调用方取消；
- SAP JSON/XML 错误和空响应；
- 写入前获取并复用 CSRF 和全部 Cookie；
- 使用 ETag 时的条件请求头；
- 不会执行不安全的写入重试。

业务 Gateway 测试应覆盖 SAP 到领域的映射、类型化过滤器、Payload、验证、部分或不确定结果，以及使用模拟依赖的编排。

在线测试默认只执行 `$metadata` 或有上限的实体查询。在线测试应与确定性的单元测试分开，缺少环境配置时给出明确结果。
