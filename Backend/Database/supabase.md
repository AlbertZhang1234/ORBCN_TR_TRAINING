https://mptbiflewqhhhelbbhfw.supabase.co
Publishablekey:<moved-to-environment>
secretkey:<moved-to-environment>

Table:
### otto_customer (客户主数据)
- `customerid` (PK, string): 客户编号
- `customername` (string): 客户名称
- `taxcode` (string): 税号
- `address` (string): 地址
- `contactperson` (string): 联系人
- `mobile` (string): 联系电话
- `fullname_zh` (string): 全名(中)
- `fullname_en` (string): 全名(英)
- `email` (string): 邮箱
- `language` (string): 语言
- `actualpaymentterm` (string): 实际付款情况描述（例如审批，实际付款周期等）
- `bankaccount` (string): 银行账号

### otto_project (项目主数据)
- `projectid` (PK, string): 项目编号
- `customerid` (FK, string): 客户编号 (关联 `otto_customer.customerid`)
- `description` (string): 项目描述
- `projectmanager` (FK, string): 项目经理 (关联 `otto_user.userid`)
- `trchargeable` (boolean): 差旅是否收费
- `txchargeable` (boolean): 补贴是否收费
- `paymentterm` (string): 付款条款
- `salesperson` (FK, string): 项目经理 (关联 `otto_user.userid`)

### otto_travelentry (差旅记录)
- `travelid` (PK, string): 差旅编号
- `userid` (PK, FK, string): 员工编号 (关联 `otto_user.userid`)
- `projectid` (FK, string): 项目编号 (关联 `otto_project.projectid`)
- `fromdate` (date): 开始日期
- `todate` (date): 结束日期
- `destination` (string): 目的地

### otto_invoices (发票表)
- `invoiceno` (PK, string): 发票编号
- `travelid` (string): 差旅编号
- `userid` (string): 员工编号
- `invoicedate` (date): 发票日期
- `totalnetamount` (numeric): 净额
- `taxamount` (numeric): 税额
- `grossamount` (numeric): 总额
- `bookingcode` (string): 记账代码
- `currency` (string): 本币/入账币种，默认 `CNY`
- `originalamount` (numeric): 票据原始币种含税金额
- `originalcurrency` (string): 票据原始币种，ISO 4217 三位代码
- `status` (string): 状态
- `comment` (string): 备注
- `description` (string): 描述

### otto_tr_h (报销单抬头)
- `id` (PK, bigint): 报销单编号
- `userid` (string): 申请人
- `projectid` (string): 项目编号（必填，一个报销单只能属于一个项目）
- `created_at` (timestamp): 创建日期
- `approver` (string): 审批人
- `approvalstatus` (string): 审批状态
- `bookingstatus` (string): 财务状态

### otto_tr_t (报销单行明细)
- `id` (PK, bigint): 报销单编号
- `invoiceno` (PK, string): 发票编号
- `tr_amount`（string）；报销金额
- `trchargeable` (boolean): 差旅是否收费
- `txchargeable` (boolean): 补贴是否收费

### otto_user (用户表)
- `userid` (PK, string): 用户编号
- `email` (string): 邮箱
- `firstname` (string): 名
- `lastname` (string): 姓
- `mobile` (string): 手机号
- `password` (string): 密码

### otto_role (角色表)
- `roleid` (PK, string): 角色编号
- `description` (string): 描述

### otto_userrole (用户角色关联)
- `userid` (PK, string): 用户编号
- `roleid` (PK, string): 角色编号

### t_loginsessions (登陆session管理)
- `session_id` (PK, string): 会话ID (UUID)
- `userid` (FK, string): 用户ID (关联 `otto_user.userid`)，不使用强关联的外键
- `expires_at` (timestamp): 过期时间
- `created_at` (timestamp): 登录时间
- `updated_at` (timestamp): 更新时间
- `last_accessed_at` (timestamp): 最后访问时间
- `ip_address` (string): 登录IP地址
- `is_active` (boolean): 是否有效 (true: 在线, false: 已登出/失效)
- `device_id` (json): 设备信息
- `cookie` (string): 会话Cookie


员工功能：
1. 维护差旅编号 (otto_te)
2. 管理发票（上传或删除）(otto_inv)
3. 管理报销单（创建，修改，删除）(otto_tr)
4. 自己的报表(otto_rp)

项目经理额外功能：
1. 审批报销单(atto_apv)
2. 报表(otto_rp_p)

财务额外功能
1. 报表（otto_rp_all）
2. 报销单记账

管理员：
全部功能


# 功能与数据逻辑详解

### 1. 客户与项目关系
- **需求**: "一个客户有N个项目，每个项目一个项目经理"
- **数据库实现**:
    - **表关联**: `otto_project` 表通过 `customerid` 外键关联 `otto_customer.customerid` (1:N)。
    - **项目经理**: `otto_project` 表中的 `projectmanager` 字段关联 `otto_user.userid`，指定该项目的负责人。

### 2. 差旅与发票关系
- **需求**: "每个项目会发生N次差旅，每次差旅会发生多次费用有多张发票"
- **数据库实现**:
    - **项目-差旅**: `otto_travelentry` 表通过 `projectid` 关联 `otto_project.projectid` (1:N)。
    - **差旅-发票**: `otto_invoices` 表通过 `travelid` 关联 `otto_travelentry.travelid` (1:N)。
    - **发票数据**: `otto_invoices` 记录具体的费用信息，包括 `totalnetamount` (净额), `taxamount` (税额), `grossamount` (总额) 以及 `bookingcode` (费用类型)。

### 3. 报销单结构与约束
- **需求**: "一个报销单只能是一个项目的，但可以多次差旅做在一张报销单上，所以报销单的行明细就是发票号码"
- **数据库实现**:
    - **报销单头 (Header)**: `otto_tr_h` 存储报销单基本信息（如 `userid` 申请人，`projectid` 项目编号，`created_at` 创建时间）。
        - *注意*: `projectid` 在创建报销单时为必填；一个报销单只能对应一个项目。
        - *编号规则*: 创建时读取 `otto_tr_h.id` 当前最大值，按 `max(id) + 1` 生成新报销单号。
    - **报销单行 (Line Items)**: `otto_tr_t` 表作为中间表，关联 `id` (报销单号) 和 `invoiceno` (发票号)。
    - **逻辑约束**: 
        - 在创建报销单时，后端需校验所有选中的 `invoiceno` 对应的 `travelid` -> `projectid` 必须一致。
        - 允许不同的 `travelid` (只要属于同一 `projectid`) 的发票合并在一个报销单中。
        - `travelid` 对报销单不是必填约束。发票没有 `travelid` 时，仍可按业务规则纳入报销；但如果发票带有 `travelid`，可用于更高效地做发票筛选、项目归属校验和审批路径定位。

### 4. 审批流程
- **需求**: "每个报销单由项目经理审核，审核后交由财务入账"
- **数据库实现**:
    - **提交**: 员工创建报销单 (`otto_tr_h`)，状态 `approvalstatus` 设为 `Wait for Approval` (待审批)。
    - **审批**: 
        - 系统根据报销单所属项目（通过发票反查 `otto_project.projectmanager`）确定审批人。
        - 项目经理操作后，更新 `otto_tr_h.approver` (实际审批人) 和 `otto_tr_h.approvalstatus` (如 `APPROVED`/`REJECTED`)。
    - **入账**: 
        - 财务操作后，更新 `otto_tr_h.bookingstatus` (如 `BOOKED`)。

### 5. 发票状态流转与锁定
- **需求**: "发票上有状态，初始状态是待报销...这个状态下报销单与发票不能再做任何更改"
- **数据库实现**:
    - **发票状态 (`otto_invoices.status`) 流转**:
        1.  **待报销 (PENDING)**: 发票创建后的初始状态。
        2.  **已提交 (SUBMITTED)**: 当发票被添加到报销单 (`otto_tr_t`) 时，状态更新为 `SUBMITTED`。此时发票不可被其他报销单引用。
        3.  **已记账 (BOOKED)**: 当关联的报销单 `otto_tr_h.bookingstatus` 变为 `BOOKED` 时，发票状态同步更新为 `BOOKED`。
    - **数据锁定**:
        - 当 `otto_invoices.status` >= `SUBMITTED`，禁止修改发票关键信息。
        - 当 `otto_tr_h.bookingstatus` = `BOOKED`，禁止修改报销单及关联发票的任何信息（只读）。

### 6. 权限
- **数据权限**：项目经理可以看到属于自己以及自己项目的发票与报销单；财务经理可以看到所有人的发票与报销单，一般用户只能看到自己的发票，管理员只能管理配置，使用用户与角色两个功能。

### 7. 邮件通知与发票附件处理
- **需求**: "报销单审批通过后，自动发送邮件给财务，并附上相关发票文件"
- **系统实现**:
    - **触发机制**:
        - **手动审批**: 项目经理在系统中点击“Approve”按钮时触发。
        - **自动审批**: 创建报销单时，如果符合自动审批条件（如项目经理本人提交），系统自动触发。
    - **邮件发送**:
        - **服务**: 使用 Nodemailer 通过 SMTP 发送。
        - **收件人**: 财务邮箱 (配置在环境变量 `NEXT_PUBLIC_TR_RECEIVER`，默认 `financechina@orbis-group.com`)。
        - **主题**: `TR_{流水号}` (例如 `TR_10001`)。
    - **附件处理**:
        - **文件源**: 系统后端 `data` 目录 (`Frontend/data`)。
        - **匹配逻辑**: 根据报销单行明细中的 `invoiceno` 查找对应的发票文件。
        - **文件命名**: 发票文件名需包含发票号（系统会自动匹配并清理文件名中的特殊字符）。



# 系统菜单结构
- 首页
- 系统管理
  - 用户管理
  - 角色管理
- 主数据维护
  - 客户管理
  - 项目管理
- 报销
  - 差旅管理
  - 发票管理
  - 报销单
- 财务
  - 财务记账与归档



# 发票booking rule
交通类:
- PARK (Parking): 停车费、车位租赁、车辆停放、停车场、保管费 + 车牌号
- TAXI (Taxi): 出租车、网约车、滴滴、快车、专车、代驾
- AUTG (Highway Fee): 过路费、高速费、通行费、ETC、路桥费
- BENL (Petrol for Cars): 汽油、柴油、加油、燃油、中石油、中石化
- BAHC (Train Ticket): 火车票、高铁票、动车票、铁路
- FAHR (Bus/Subway): 地铁、公交、轻轨、城市轨道
- FLUG (Flight): 机票、航空、飞机票
- MTWG (Rental Car): 租车、汽车租赁、车辆租赁(整车出租,非车位)

生活类:
- HOTL (Hotel): 酒店、宾馆、旅馆、住宿、客房、民宿
- BEWI (Hospitality): 餐饮、餐厅、饭店、食堂、聚餐、工作餐
- GE75 (Gift): 礼品、纪念品

办公类:
- KOIN (Communication): 通信费、话费、流量、宽带
- POST (Postal Fee): 快递、邮寄、邮费、物流
- PCKL (PC Accessory): 电脑配件、数据线、转接器、底座、扩展坞
- BUCH (Books): 书籍、图书、资料
- BURO (Office Supply): 办公用品、文具、纸张、耗材

其他类:
- PRIU (Private Overnight): 私人住宿补贴
- REST (Food, Dinner): 正餐、晚餐(特定场景)
- SCHU (Training): 培训、教育、课程
- SOBE (Others): 其他、无法明确分类

# 所有报销单与发票的数据
otto_v_tr_all: 这是数据库中综合了所有报销单与发票相关数据的视图，可以通过它快速的查询数据
