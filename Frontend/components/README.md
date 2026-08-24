# ORBAI SAP UI 开发手册 (Developer Manual)

**版本**: 1.2.0
**更新日期**: 2026-01-22
**适用对象**: ORBAI 前端开发团队

---

## 1. 概述 (Overview)

本组件库 (`10_Frontend/components/sap/ui`) 是 ORBAI SAP 项目的核心 UI 基础。它不仅仅是一套组件，更是一套**设计语言**和**开发标准**。我们基于 **MUI (Material-UI)** 构建，深度定制了 **SAP Fiori** 设计风格，旨在提供一致、高效、企业级的用户体验。

### 1.1 设计哲学 (Design Philosophy)

1.  **Atomic Design (原子设计)**: 组件严格分级。
    *   **Atoms (原子)**: 不可再分的基础组件 (如 Button, Input)。
    *   **Molecules (分子)**: 由原子组成的简单功能单元 (如 DateRangePicker, SearchBar, CMessageBox)。
    *   **Structures (组织)**: 复杂的页面级区块 (如 CTable, CSmartFilter, CPageLayout)。
2.  **Configuration over Code (配置优于代码)**: 
    *   为了减少重复劳动，复杂的组件（特别是表格和筛选器）采用“配置驱动”模式。你不需要写几十行 JSX 来渲染一个表格，只需要定义一个 Column Config 数组。
3.  **Business Ready (业务就绪)**: 
    *   我们不造通用的轮子，只造业务需要的轮子。
    *   内置了 SAP 业务场景必须的：变体管理 (Variant Management)、Excel 导出、列宽调整、多级分组、服务端分页等。
4.  **Type Safety (类型安全)**:
    *   全面拥抱 TypeScript。所有的组件 Props、数据源、配置项都必须有严格的类型定义。

### 1.2 目录结构 (Directory Structure)

```
10_Frontend/components/sap/ui/
├── Common/
│   ├── Atoms/           # [原子] 基础组件 (CButton, CTextField...)
│   ├── Molecules/       # [分子] 复合组件 (CDateRangePicker, CMessageBox, CVariantManagement...)
│   ├── Structures/      # [组织] 核心业务组件 (CTable, CSmartFilter, CPageLayout...)
│   ├── PageComponents/  # [页面级] 封装了业务逻辑的智能组件 (CVariantManager...)
│   └── Styles/          # 全局样式与主题 (theme.tsx, colors.ts)
└── README.md            # 本手册
```

### 1.3 组件清单 (Component List)

下表列出了所有可用的 UI 组件，按文件夹分类。

| 文件夹 (Folder) | 文件名 (Filename) | 中文名 (Chinese Name) | 功能描述 (Function) |
| :--- | :--- | :--- | :--- |
| **Common/Atoms** | `CBadge.tsx` | 徽章 | 用于显示通知数量或状态标记。 |
| | `CButton.tsx` | 按钮 | 基础按钮组件，统一了 SAP 风格的样式和交互。 |
| | `CCheckbox.tsx` | 复选框 | 基础复选框组件。 |
| | `CChip.tsx` | 标签 | 用于展示标签或状态的小元素。 |
| | `CDatePicker.tsx` | 日期选择器 | 单个日期选择组件。 |
| | `CDivider.tsx` | 分割线 | 用于分隔内容的线条。 |
| | `CFileUpload.tsx` | 文件上传 | 文件上传组件。 |
| | `CIconButton.tsx` | 图标按钮 | 仅包含图标的按钮。 |
| | `CMenu.tsx` | 菜单 | 弹出式菜单组件。 |
| | `CPaper.tsx` | 纸片 | 基础容器组件，提供阴影和背景。 |
| | `CRadioGroup.tsx` | 单选框组 | 一组互斥的选项。 |
| | `CSelect.tsx` | 下拉选择 | 下拉选择组件。 |
| | `CTextArea.tsx` | 文本域 | 多行文本输入组件。 |
| | `CTextField.tsx` | 文本框 | 单行文本输入组件。 |
| | `CTypography.tsx` | 排版 | 用于展示不同层级的文本（标题、正文等）。 |
| **Common/Molecules** | `CAppHeaderActions.tsx` | 应用头动作 | 全局头部操作区（主题切换、语言切换、用户菜单）。 |
| | `CDateRangePicker.tsx` | 日期范围选择器 | 选择起始和结束日期的组件。 |
| | `CFilterField.tsx` | 过滤字段 | 智能过滤器中的单个过滤项组件。 |
| | `CList.tsx` | 列表 | 展示数据列表的组件。 |
| | `CMessageBox.tsx` | 消息框 | 弹出式消息提示框，替代原生 alert/confirm。 |
| | `CStatusBadge.tsx` | 状态徽章 | 专门用于显示业务状态的带有颜色的徽章。 |
| | `CVariantManagement.tsx` | 变式管理 | 管理查询条件的变式（保存、加载、默认设置）。 |
| **Common/Structures** | `CChat.tsx` | 聊天窗口 | AI 助手聊天界面组件。 |
| | `CFilterSection.tsx` | 过滤区块 | 包含多个过滤字段的区域。 |
| | `CPageHeader.tsx` | 页面头部 | 标准页面头部，包含标题、返回按钮和操作区。 |
| | `CPageLayout.tsx` | 页面布局 | 标准页面布局容器，整合了头部和内容区。 |
| | `CSmartFilter.tsx` | 智能过滤器 | 综合过滤栏，集成了变式管理和动态过滤字段。 |
| | `CTable.tsx` | 数据表格 | 核心表格组件，支持排序、筛选、分页、布局保存等。 |
| | `CTable/CTableBody.tsx` | 表格主体 | 表格的数据渲染区域。 |
| | `CTable/CTableFooter.tsx` | 表格底部 | 表格的底部区域（如合计行）。 |
| | `CTable/CTableHead.tsx` | 表格头部 | 表格的标题栏，支持排序和列宽调整。 |
| | `CTable/CTableMenu.tsx` | 表格菜单 | 表格的上下文菜单。 |
| | `CTable/CTableMobile.tsx` | 表格移动视图 | 移动端适配的卡片式视图。 |
| | `CTable/CTableToolbar.tsx` | 表格工具栏 | 表格顶部的工具栏（标题、操作按钮）。 |
| **Common/Styles** | `theme.tsx` | 主题配置 | 全局 MUI 主题定义，包含颜色、排版等配置。 |

---

## 2. 核心架构与整合 (Architecture & Integration)

本 UI 库不是孤立存在的，它必须与项目的 **Service 层** (后端数据) 和 **Page 层** (业务逻辑) 紧密配合。

### 2.1 数据流架构 (Data Flow)

**Service Layer** (`20_Backend/SAP/src/...`)  
⬇️ *(Promise / Async Data)*  
**Page Layer** (`10_Frontend/components/sap/app/...`)  
⬇️ *(Props: rows, columns, config)*  
**UI Components** (`10_Frontend/components/sap/ui/...`)

*   **Service 层**: 负责 HTTP 请求、数据转换、错误处理。返回标准化的 TypeScript 接口。
*   **Page 层**: 负责状态管理 (State Management)，如 `loading`, `page`, `filters`。使用 `useSmartTable` Hook 来简化逻辑。
*   **UI 层**: 纯展示组件 (Presentational Components)。只根据传入的 Props 渲染，不直接发起网络请求。

### 2.2 标准页面开发模板 (Page Template)

一个完整的业务页面由两部分组成：
1.  **Next.js Page Wrapper** (`app/SAP/.../page.tsx`): 负责整体布局（Header, Sidebar）和主题注入。
2.  **View Component** (`components/sap/app/.../View.tsx`): 负责具体的业务逻辑和 UI 展示。

#### 2.2.1 Next.js Page Wrapper

所有 SAP 业务页面的入口文件（Next.js `page.tsx`）**必须**使用 `MainWrapper` 和 `SAPThemeWrapper` 进行包裹，以确保 Header 和 Sidebar 正确显示。

```tsx
// 10_Frontend/app/SAP/m_sapbp/page.tsx

'use client';

import React from 'react';
import { MainWrapper } from '@/components/layout/main-wrapper';
import SAPThemeWrapper from '@/components/sap/SAPThemeWrapper';
import { BusinessPartnerView } from '@/components/sap/app/BusinessPartner/BusinessPartnerView';
import { useTextelement } from '@/hooks/useTextelement';

export default function BusinessPartnerPage() {
  const { getText } = useTextelement('m_sapbp');

  return (
    // MainWrapper: 提供 Header, Sidebar 和 User Context
    <MainWrapper appTitle={getText('00001') || 'Business Partners'}>
      {/* SAPThemeWrapper: 注入 SAP Fiori 主题样式 */}
      <SAPThemeWrapper>
        <BusinessPartnerView />
      </SAPThemeWrapper>
    </MainWrapper>
  );
}
```

#### 2.2.2 View Component (Business Logic)

业务组件（如 `BusinessPartnerView.tsx`）负责具体的数据获取和展示。

```tsx
// 1. 引入 Service (数据层)
import { businessPartnerService } from '@/services/m_sapbp/BusinessPartner/BusinessPartnerService';

// 2. 引入 UI 组件 (视图层)
import { CPageLayout } from '@/components/sap/ui/Common/Structures/CPageLayout';
import { CTable } from '@/components/sap/ui/Common/Structures/CTable'; 
import { useSmartTable } from '@/hooks/useSmartTable'; // 核心 Hook

export const BusinessPartnerPage = () => {
    // 3. 状态管理 Hooks (极度推荐使用 useSmartTable)
    const {
        filters, setFilters,           // 筛选状态
        activeLayout, handleLayoutSave, // 表格布局状态
        variants, ...                  // 变体管理状态
    } = useSmartTable({ appId: 'm_sapbp_BusinessPartner', ... });

    const [data, setData] = useState([]);
    
    // 4. 数据获取逻辑
    const loadData = async () => {
        const res = await businessPartnerService.getAll({ ...filters });
        setData(res);
    };

    // 5. 定义列 (Column Definition)
    const columns = [
        { id: 'id', label: 'ID', minWidth: 100 },
        { id: 'name', label: 'Name', minWidth: 200 }
    ];

    return (
        // 6. 根容器：CPageLayout (统一的页面外壳)
        // 注意：如果外层 MainWrapper 已显示标题，建议设置 hideHeader={true} 避免双重标题
        <CPageLayout title="Business Partners" hideHeader={true}>
            <Stack spacing={2} sx={{ height: '100%' }}>
                 {/* 7. 核心内容：CTable (集成了筛选、工具栏、表格主体) */}
                <CTable
                    columns={columns}
                    rows={data}
                    filterConfig={{
                        fields: [{ id: 'name', label: 'Name', type: 'text' }],
                        filters: filters,
                        onFilterChange: setFilters,
                        onSearch: loadData
                    }}
                    fitContainer={true} // 填满剩余高度
                    fullWidth={false}   // 宽度自适应，不强制铺满
                    selectionMode="multiple"
                />
            </Stack>
        </CPageLayout>
    );
};
```

---

## 3. 核心组件详解 (Core Components)

### 3.1 CTable (超级表格)

**引用路径**: `import { CTable } from '../../ui/Common/Structures/CTable';`

这是本项目最复杂、功能最强大的组件。它不仅仅是一个 `<table />`，而是一个完整的数据展示解决方案。

#### 3.1.1 核心特性 (Key Features)

*   **智能宽度 (Smart Width)**: 
    *   通过 `fullWidth={false}` (默认)，表格会根据列宽自然布局，不会在列很少时强行拉伸导致难看。
    *   通过 `fullWidth={true}`，表格强制占满父容器宽度。
*   **高度自适应 (Fit Container)**:
    *   设置 `fitContainer={true}`，表格会自动计算并填满父容器的剩余高度。**前提**: 父容器必须是 Flex Column 布局且有高度。
*   **列宽调整 (Column Resizing)**:
    *   用户可以拖拽表头分割线调整列宽。
    *   调整后的列宽会暂存，配合 `onLayoutSave` 可持久化到后端。
*   **多选与复选框 (Selection)**:
    *   设置 `selectionMode="multiple"` 或 `"single"`，第一列自动渲染 Checkbox。
    *   支持 Shift 键多选（待完善）。
*   **集成筛选 (Integrated Filter)**:
    *   不需要在表格外面单独写 FilterBar，直接传入 `filterConfig` 属性，CTable 会自动在顶部渲染筛选区域。

#### 3.1.2 关键 Props 详解

| 属性名 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `columns` | `HeadCell[]` | (必填) | 列定义数组。 |
| `rows` | `any[]` | (必填) | 数据源数组。 |
| `title` | `string` | 'Data Table' | 表格标题，显示在工具栏左侧。 |
| `loading` | `boolean` | `false` | 是否显示加载状态（骨架屏/Loading条）。 |
| `selectionMode` | `'single' \| 'multiple' \| 'none'` | `'none'` | 选择模式。 |
| `selected` | `string[]` | `[]` | 当前选中的行 ID 数组。 |
| `onSelectionChange`| `(ids: string[]) => void` | - | 选中项改变时的回调。 |
| `rowKey` | `string \| (row) => string` | `'id' \| 'ID'` | **新增**。指定行的唯一标识字段。当数据中没有 standard `id` 字段时必须设置此项，否则选择功能将异常。 |
| `fullWidth` | `boolean` | `false` | **重要**。`true`=强制100%宽；`false`=根据内容自然宽度。 |
| `fitContainer` | `boolean` | `false` | **重要**。`true`=填满父容器高度。 |
| `filterConfig` | `FilterConfig` | `undefined` | 筛选器配置对象。传入则开启筛选功能。 |
| `layout` | `TableLayout` | `null` | 外部传入的布局配置（用于恢复用户习惯）。 |
| `onLayoutSave` | `(layout) => void` | - | 用户点击“保存布局”时的回调。 |

#### 3.1.3 FilterConfig 详解 (New)

`filterConfig` 对象除了定义筛选字段外，现在还支持直接集成变体管理：

```typescript
{
    // ... 筛选字段配置 ...
    
    // [New] 变体管理集成
    // 只要传入 appId，CTable 就会自动在筛选栏渲染 CVariantManager
    appId: 'my_app_id', 

    // [Required for Layout Saving] 必须传入当前变体 ID，否则无法保存布局
    currentVariantId: currentVariantId, 
    
    currentLayout: activeLayout,
    variantService: myVariantService, // 可选：注入自定义 Service
    
    // 变体加载回调 (通常直接映射 useSmartTable 的 handleVariantLoad)
    onVariantLoad: handleVariantLoad,

    // [Optional] 布局保存结果回调
    onSuccess: (msg) => showSnackbar(msg, 'success'),
    onError: (msg) => showSnackbar(msg, 'error')
}
```

#### 3.1.4 Layout Persistence (布局持久化)

在 v1.1.0 版本中，表格布局（列宽、显示隐藏、排序、分组）的保存逻辑已完全封装在 `CTable` 内部。

**工作原理**:
1.  用户点击表格工具栏的“保存布局”按钮。
2.  `CTable` 检查 `filterConfig` 中的 `currentVariantId`。
3.  如果存在有效的变体 ID，`CTable` 会自动调用 `variantService.saveVariant` 将当前布局更新到该变体中。
4.  保存成功或失败会触发 `onSuccess` / `onError` 回调。

**开发者只需要做**:
确保将 `currentVariantId` 和 `variantService` 正确传递给 `filterConfig`。无需编写任何额外的保存逻辑。


#### 3.1.5 Column 定义接口

```typescript
interface HeadCell {
    id: string;          // 对应 rows 中的数据 Key
    label: string;       // 表头显示的文字
    minWidth?: number;   // 最小宽度 (px)
    width?: number;      // 初始宽度 (px)
    align?: 'left' | 'right' | 'center'; // 对齐方式
    numeric?: boolean;   // 是否为数字 (影响排序和合计)
    
    // 自定义渲染函数 (最常用)
    // row: 当前行数据
    renderCell?: (row: any) => React.ReactNode; 
    
    // 自定义分组取值函数 (当字段是嵌套对象时必填)
    // 用于告诉表格如何获取该列的分组依据值
    getGroupValue?: (row: any) => string | number;
}
```

**示例 1: 基础渲染**:
```tsx
{
    id: 'status',
    label: 'Status',
    renderCell: (row) => (
        <CChip 
            label={row.status} 
            color={row.status === 'Active' ? 'success' : 'error'} 
        />
    )
}
```

**示例 2: 嵌套字段分组 (重要)**:
如果你的数据结构是嵌套的（如 `row.address.city`），直接指定 `id: 'city'` 会导致分组时显示 `undefined`。必须使用 `getGroupValue`。

```tsx
{
    id: 'City',
    label: 'City',
    // 渲染显示
    renderCell: (row) => row.address?.city,
    // 分组取值 (Fix: 解决分组显示 undefined 的问题)
    getGroupValue: (row) => row.address?.city || 'Unknown'
}
```

---

### 3.2 CSmartFilter (智能筛选栏)

通常作为 `CTable` 的一部分使用，但也可以独立使用。

**功能**:
*   根据配置自动生成筛选表单。
*   支持多种字段类型：`text`, `select`, `date`, `number`。
*   **变体管理 (Variant Management)**: 允许用户保存当前的筛选条件组合为“变体(Variant)”，方便下次一键加载。

**字段类型配置**:
```typescript
{
    id: 'role',
    label: 'User Role',
    type: 'select',
    options: [
        { value: 'admin', label: 'Administrator' },
        { value: 'user', label: 'Standard User' }
    ]
}
```

---

### 3.3 CPageLayout (通用页面布局)

**引用路径**: `import { CPageLayout } from '../../ui/Common/Structures/CPageLayout';`

**作用**:
确保所有业务页面拥有统一的 Header、Padding 和背景色。它就像一个“相框”，把你的业务内容框在里面。

**Props**:
*   `title`: 页面标题。
*   `hideHeader`: 是否隐藏头部（用于极简模式，或当 MainWrapper 已显示标题时避免重复）。
*   `children`: 页面内容。

---

### 3.4 CVariantManager (变体管理器)

**引用路径**: `import { CVariantManager } from '../../ui/Common/PageComponents/CVariantManager';`

**作用**:
这是一个"智能组件" (Smart Component)，它完美封装了变体管理的所有逻辑（UI + API）。
你**不再需要**在每个业务页面中手动引入 `VariantService`，也不需要手动编写 `saveVariant`, `deleteVariant` 等繁琐的样板代码。它内置了与后端 API 的交互。

**核心特性**:
*   **自动加载**: 挂载时自动根据 `appId` 获取变体列表。
*   **自动默认**: 如果有默认变体，自动触发 `onLoad`。
*   **内置 API**: 内部集成了标准的 Axios 请求（默认 `http://localhost:8888`，可配置）。

**代码示例**:

```tsx
<CVariantManager 
    // 1. 必填：用于区分不同应用的变体
    appId="m_sapbp_BusinessPartner"
    
    // 2. 传入当前页面的状态（用于保存）
    currentFilters={filters}
    currentLayout={activeLayout}
    
    // 3. 处理变体加载（用于恢复状态）
    onLoad={(variant) => {
        setFilters(variant.filters);
        setActiveLayout(variant.layout);
        // 可选：如果 variant.executeOnLoad 为 true，可以触发查询
        if (variant.executeOnLoad) {
            loadData();
        }
    }}
/>
```

**Props**:

| 属性名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `appId` | `string` | Yes | 应用 ID，后端根据此 ID 隔离变体数据。 |
| `currentFilters` | `object` | - | 当前页面的筛选条件对象（保存时会用到）。 |
| `currentLayout` | `object` | - | 当前表格的布局对象（保存时会用到）。 |
| `onLoad` | `(variant) => void` | Yes | 当用户选择某个变体时触发。 |
| `variantService` | `IVariantService` | - | 可选：自定义变体服务实现（用于 Mock 或特殊逻辑）。 |
| `serviceUrl` | `string` | - | 后端 API 地址，默认为 `http://localhost:8888`。 |

---

### 3.5 CMessageBox (消息框)

**引用路径**: `import { CMessageBox } from '../../ui/Common/Molecules/CMessageBox';`

**作用**:
替代原生的 `alert` 和 `confirm`，提供符合 SAP Fiori 风格的弹窗交互。支持成功、警告、错误等多种状态，以及自定义按钮文本。

**核心特性**:
*   **类型丰富**: 支持 `success` (绿), `warning` (橙), `error` (红), `info` (蓝) 等多种预设样式，自动适配图标和颜色。
*   **交互灵活**: 可配置是否显示取消按钮，自定义按钮文字。
*   **视觉统一**: 完美的圆角和颜色配置，与整体主题保持一致。

**Props 详解**:

| 属性名 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `open` | `boolean` | (必填) | 控制弹窗显示。 |
| `onClose` | `() => void` | (必填) | 关闭弹窗的回调（点击取消或背景时触发）。 |
| `type` | `'success' \| 'warning' \| 'error' \| 'info' \| 'default'` | `'default'` | 弹窗类型，决定图标和主题色。 |
| `title` | `string` | - | 弹窗标题。 |
| `message` | `string \| ReactNode` | - | 弹窗内容，支持富文本。 |
| `onConfirm` | `() => void` | - | 确认按钮的回调。如果不传，确认按钮仅执行 onClose。 |
| `showCancel` | `boolean` | `true` | 是否显示取消按钮。通常在 `type='error'` 或纯通知时设为 `false`。 |
| `confirmText` | `string` | `'OK'` | 确认按钮文本。 |
| `cancelText` | `string` | `'Cancel'` | 取消按钮文本。 |
| `maxWidth` | `'xs' \| 'sm' \| ...` | `'xs'` | 弹窗最大宽度。 |

**推荐用法 (Best Practice)**:

建议在页面组件中使用单一的状态对象来管理弹窗，而不是定义多个 `useState`。

```tsx
// 1. 定义状态 (建议放在组件顶部)
const [alertState, setAlertState] = useState<{
    open: boolean;
    type: 'success' | 'warning' | 'error' | 'info';
    message: string;
    onConfirm?: () => void; // 可选：存储确认回调
}>({ open: false, type: 'success', message: '' });

// 辅助函数：显示弹窗
const showAlert = (type: 'success' | 'warning' | 'error', msg: string, onConfirm?: () => void) => {
    setAlertState({ open: true, type, message: msg, onConfirm });
};

// 辅助函数：关闭弹窗
const closeAlert = () => {
    setAlertState(prev => ({ ...prev, open: false }));
};

// 2. 渲染组件 (放在 JSX 最后)
<CMessageBox
    open={alertState.open}
    type={alertState.type}
    title={alertState.type.toUpperCase()} // 或使用 getText()
    message={alertState.message}
    onClose={closeAlert}
    onConfirm={alertState.onConfirm}
    showCancel={!!alertState.onConfirm} // 只有有确认回调时才显示取消按钮
    confirmText="OK" // 建议使用 getText('OK')
    cancelText="Cancel"
/>

// 3. 调用示例
// 场景 A: 简单通知
showAlert('success', 'Data saved successfully.');

// 场景 B: 阻断式确认
showAlert('warning', 'Are you sure you want to delete?', () => {
    // 执行删除逻辑
    deleteItem(id);
});
```

---

## 4. 基础组件 (Atoms)

为了保持 UI 风格统一 (SAP Fiori 风格)，**请严禁直接使用 MUI 原生组件**，必须使用以下封装组件：

### 4.1 CButton
*   **替换**: `@mui/material/Button`
*   **特点**: 样式调整为 Fiori 风格（圆角、阴影、Hover 态）。
*   **用法**: `<CButton variant="contained">Save</CButton>`

### 4.2 CTextField
*   **替换**: `@mui/material/TextField`
*   **特点**: 高度压缩，边框颜色调整，Focus 态调整。
*   **用法**: `<CTextField label="Name" fullWidth />`

### 4.3 CSelect
*   **替换**: `@mui/material/Select`
*   **特点**: 下拉菜单样式优化。

### 4.4 CCheckbox / CRadio
*   **替换**: Checkbox / Radio
*   **特点**: 颜色使用 SAP 主题色。

---

## 5. 最佳实践 (Best Practices)

1.  **关于表格宽度**:
    *   绝大多数情况下，请保持 `fullWidth={false}`。这会让表格看起来更精致，不会在只有两列时拉伸满整个 4K 屏幕。
    *   如果列非常多，表格会自动产生横向滚动条。

2.  **关于多语言**:
    *   不要在 Label 中写死中文或英文。
    *   使用 `useTextelement` Hook 获取文本。
    *   `label: getText('00001', 'Business Partner')`

3.  **关于 RenderCell**:
    *   `renderCell` 非常强大，但也是性能杀手。
    *   不要在 `renderCell` 里面定义新的组件或函数，这会导致每次渲染都重新创建函数。
    *   尽量渲染轻量级的组件。

4.  **关于 Service 整合**:
    *   UI 组件不应该知道 API 的 URL。所有 URL 和 Fetch 逻辑都在 Service 层。

5.  **关于弹窗交互 (Dialogs & Notifications)**:
    *   **严禁原生**: 严禁使用浏览器原生的 `window.alert` 或 `window.confirm`，它们会阻塞 JS 线程且样式无法定制。
    *   **CMessageBox (Blocking)**: 用于需要用户明确关注或做出决策的场景。
        *   *关键操作确认* (如删除、提交)。
        *   *系统级错误* (如网络断开、权限不足)。
    *   **Snackbar (Non-blocking)**: 用于轻量级反馈，不打断用户心流。
        *   *操作成功* (如保存成功、复制成功)。
        *   *轻微警告* (如必填项未填)。
    *   **避免弹窗地狱**: 不要在一个操作流中连续弹出多个 CMessageBox。

---

## 6. 常见问题 (FAQ)

**Q1: 我想给表格加个操作列（如编辑、删除按钮），怎么做？**
A: 在 `columns` 数组最后加一列：
```tsx
{
    id: 'actions',
    label: 'Actions',
    renderCell: (row) => (
        <Stack direction="row" spacing={1}>
            <CIconButton onClick={() => handleEdit(row)}>
                <EditIcon />
            </CIconButton>
            <CIconButton onClick={() => handleDelete(row)} color="error">
                <DeleteIcon />
            </CIconButton>
        </Stack>
    )
}
```

**Q2: 如何实现自定义的表格工具栏按钮？**
A: `CTable` 目前通过 `actions` 属性（如果有的话，视具体实现而定）或推荐在 `CTable` 上方使用 `Stack` 布局自定义工具栏。标准模式下，`CTable` 内置了变体管理和筛选器，业务操作按钮（如“新建”）通常放在 `CPageHeader` 或 `CPageLayout` 的 `actions` 插槽中。

**Q3: 表格数据量很大，支持虚拟滚动吗？**
A: 目前 `CTable` 基于分页模式设计（服务端分页）。如果确实需要展示大量数据且不分页，后续会考虑引入 `react-window` 进行虚拟化支持，但当前版本建议优先使用分页。
