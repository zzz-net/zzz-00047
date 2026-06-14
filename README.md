# 离线设备点检工作台

一个用于班组在本机记录设备点检的离线 Web 应用。支持计划配置、开始点检、提交结果、主管复核、关闭异常、撤销上一步、历史查询和 CSV/JSON 导出。

## 技术栈

- **前端**: React 18 + TypeScript + Vite + TailwindCSS + Zustand
- **后端**: Express + TypeScript + tsx
- **数据持久化**: 本地 JSON 文件（`data/db.json`）+ 本地图片存储（`data/evidence/`）
- **离线运行**: 完全本地部署，无需外部依赖

## 功能模块

| 模块 | 功能说明 |
|------|----------|
| 工作台 | 概览统计、最近点检单、点检计划 |
| 开始点检 | 选择计划、日期、操作员，创建点检单 |
| 执行点检 | 逐项填写正常/异常，异常上传照片证据 |
| 主管复核 | 审核异常记录，复核通过 |
| 历史查询 | 多条件筛选、导出 CSV/JSON |
| 计划配置 | 管理设备、班次、检查项、点检计划 |

## 状态机流转

```
DRAFT(草稿) → SUBMITTED(已提交) → 无异常 → COMPLETED(已完成)
                    ↓
              有异常 → PENDING_REVIEW(待复核) → REVIEWED(已复核) → CLOSED(已关闭)

任意状态可通过"撤销上一步"回退到上一个状态
```

## 项目结构

```
├── api/                          # 后端代码
│   ├── app.ts                    # Express 应用主入口
│   ├── server.ts                 # 本地服务器启动
│   ├── types/                    # 后端类型定义
│   │   └── index.ts
│   ├── services/                 # 业务逻辑层
│   │   ├── db.ts                 # 数据持久化服务
│   │   ├── seed.ts               # 初始化样例数据
│   │   ├── validation.ts         # 业务规则校验
│   │   └── inspection.ts         # 点检核心业务逻辑
│   └── routes/                   # API 路由
│       ├── devices.ts            # 设备管理 API
│       ├── shifts.ts             # 班次管理 API
│       ├── checkItems.ts         # 检查项管理 API
│       ├── plans.ts              # 点检计划 API
│       ├── inspections.ts        # 点检单 API
│       ├── files.ts              # 文件上传和导出 API
│       └── auth.ts               # 预留认证 API
├── src/                          # 前端代码
│   ├── types/                    # 前端类型定义
│   │   └── index.ts
│   ├── services/                 # API 客户端
│   │   └── api.ts
│   ├── store/                    # Zustand 状态管理
│   │   └── appStore.ts
│   ├── components/               # 通用组件
│   │   ├── Layout.tsx            # 布局和导航
│   │   ├── StatusBadge.tsx       # 状态标签
│   │   └── SeverityBadge.tsx     # 严重程度标签
│   ├── pages/                    # 页面组件
│   │   ├── Dashboard.tsx         # 工作台首页
│   │   ├── StartInspection.tsx   # 开始点检页
│   │   ├── ExecuteInspection.tsx # 执行点检页
│   │   ├── ReviewPage.tsx        # 主管复核页
│   │   ├── HistoryPage.tsx       # 历史查询页
│   │   └── ConfigPage.tsx        # 计划配置页
│   └── App.tsx                   # 路由配置
├── data/                         # 数据目录（自动创建）
│   ├── db.json                   # 数据库 JSON 文件
│   └── evidence/                 # 异常照片证据
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动应用

```bash
npm run dev
```

- 前端界面: http://localhost:5173
- 后端 API: http://localhost:3001

首次启动会自动创建 `data/db.json` 并初始化样例数据。

### 3. 样例数据

系统预置以下数据，可直接用于测试：

**设备**:
- CNC加工中心 A-1 (DEV_001)
- 注塑机 B-2 (DEV_002)
- 冲压机 C-3 (DEV_003)

**班次**:
- 早班 08:00-16:00
- 中班 16:00-00:00
- 夜班 00:00-08:00

**检查项**: 6 项通用和专用检查项

**点检计划**:
- CNC-A1 日常点检（5 项）
- INJ-B2 日常点检（5 项）
- PRS-C3 日常点检（4 项）

**历史记录**:
- ORD_SAMPLE_001: CNC A-1 2026-06-13 早班（已关闭，全部正常）
- ORD_SAMPLE_002: 注塑机 B-2 2026-06-14 早班（待复核，含 1 条异常）

---

## 主流程操作步骤

### 场景 1：正常点检流程（无异常）

1. **创建点检单**
   - 点击顶部"开始点检"
   - 选择计划 "CNC-A1 日常点检"
   - 选择班次日期（默认今日）
   - 输入操作员姓名（如 "张工"）
   - 点击"创建点检单并开始"

2. **逐项检查**
   - 对每个检查项点击"正常"或"异常"
   - 全部选择"正常"
   - 点击"保存草稿"（可选）
   - 点击"提交点检单"

3. **流程自动完成**
   - 无异常时自动流转到 `COMPLETED(已完成)`
   - 主管无需复核

4. **主管关闭**
   - 切换到"主管复核"页面
   - 切换到"已复核待关闭"标签
   - 选择记录，点击"关闭异常"
   - 状态变为 `CLOSED(已关闭)`

### 场景 2：异常点检流程（带证据）

1. **创建点检单**（同场景 1 步骤 1）

2. **逐项检查**
   - 部分项选择"正常"
   - 部分项选择"异常"：
     - 展开异常项卡片
     - 选择严重程度（低/中/高）
     - 填写异常描述
     - **点击"+上传"按钮，选择至少一张照片作为证据**
     - 填写备注（可选）

3. **提交点检单**
   - 点击"提交点检单"
   - 自动流转到 `PENDING_REVIEW(待复核)`

4. **主管复核**
   - 点击"主管复核"
   - 在"待复核"标签中选择记录
   - 查看异常描述和照片证据
   - 填写处理意见（可选）
   - 点击"复核通过"
   - 状态变为 `REVIEWED(已复核)`

5. **关闭异常**
   - 切换到"已复核待关闭"标签
   - 选择记录，点击"关闭异常"
   - 状态变为 `CLOSED(已关闭)`

---

## 非法路径测试用例

### ✅ 测试 1：同一设备同班次重复开单

**复现步骤**:
1. 在"开始点检"页面，选择计划 "CNC-A1 日常点检"
2. 选择日期为 `2026-06-13`（样例数据中已有该日期记录）
3. 输入操作员，点击"创建点检单并开始"

**预期结果**:
- 弹出红色错误提示：
  ```
  重复开单：设备 "CNC加工中心 A-1" 在 2026-06-13 早班 已存在点检单 (单号: ORD_SAMPLE_001)，同一设备同一班次只能开一张点检单。
  ```
- **原数据不被修改**，原有点检单仍保持 `CLOSED` 状态

---

### ✅ 测试 2：异常缺少证据

**复现步骤**:
1. 创建一张新的点检单（选择任意计划，日期不重复）
2. 对某个检查项选择"异常"
3. 填写异常描述，但**不上传任何照片证据**
4. 点击"提交点检单"

**预期结果**:
- 弹出红色错误提示：
  ```
  异常缺少证据：共 X 条异常记录未上传照片证据 (检查项: CI_00X)。提交前请为每条异常上传至少一张照片。
  ```
- **原数据不被修改**，点检单仍保持 `DRAFT(草稿)` 状态，已填写的检查结果和异常描述仍然保留

---

### ✅ 测试 3：未按状态顺序关闭

**复现步骤**:
方法 A - API 直接调用:
```powershell
$orderId = "某张DRAFT状态的点检单ID"
$body = ConvertTo-Json @{ operator="测试员" }
Invoke-WebRequest -Uri "http://localhost:3001/api/inspections/$orderId/close" -Method POST -Body $body -ContentType "application/json"
```

方法 B - 通过界面操作:
1. 创建一张新点检单，但不提交，保持在 `DRAFT(草稿)` 状态
2. 打开浏览器控制台，找到关闭按钮的 API 调用逻辑，手动触发对该草稿单的关闭请求

**预期结果**:
- 返回错误：
  ```
  关闭失败：当前点检单状态为 "DRAFT"，只有 "REVIEWED(已复核)" 状态的点检单才能关闭异常。请先由主管完成复核。
  ```
- **原数据不被修改**，点检单仍保持 `DRAFT(草稿)` 状态

---

### ✅ 测试 4：撤销越界

**复现步骤**:
1. 新创建一张点检单（状态为 `DRAFT`，只有 CREATE 操作日志）
2. 点击"撤销上一步"按钮

**预期结果**:
- 弹出错误提示：
  ```
  撤销失败：已经是最初的创建状态，无法再撤销。
  ```

---

## 数据持久化验证

### ✅ 测试：重启应用后数据保持一致

**复现步骤**:
1. 执行一个完整的点检流程，提交一张带异常的点检单，状态变为 `PENDING_REVIEW`
2. 记住点检单的 ID、状态、异常的证据路径
3. **停止服务器**（Ctrl+C）
4. **重新启动服务器**（`npm run dev`）
5. 打开"历史查询"页面，找到该点检单

**验证内容**:
- [ ] 点检单状态与重启前完全一致
- [ ] 异常记录完整保留（描述、严重程度）
- [ ] 照片证据路径正确，图片可正常显示
- [ ] 操作记录完整，撤销记录仍在
- [ ] 导出 CSV/JSON 的内容与重启前一致

**数据文件位置**:
- 主数据: `data/db.json`（可直接打开查看）
- 照片证据: `data/evidence/`（异常照片存储目录）

> **注意**: `data/` 目录已加入 `.gitignore`，不会被提交到版本控制。删除 `data/db.json` 后重启应用会重新初始化样例数据。

---

## 导出功能验证

### CSV 导出
1. 进入"历史查询"页面
2. 可选择筛选条件（设备、班次、日期范围、状态）
3. 点击"导出 CSV"
4. 下载 CSV 文件，用 Excel 打开验证：
   - 含 UTF-8 BOM，中文正常显示
   - 列：单号、计划名称、设备名称、设备编号、班次、班次日期、状态、操作员、主管、正常项数、异常项数、创建时间、提交时间、复核时间、关闭时间

### JSON 导出（全部数据）
1. 进入"历史查询"页面
2. 点击"导出 JSON"
3. 下载 JSON 文件，验证包含所有数据：
   - `devices` 设备列表
   - `shifts` 班次列表
   - `checkItems` 检查项列表
   - `inspectionPlans` 点检计划列表
   - `inspectionOrders` 所有点检单（含完整的检查结果、异常记录、操作日志）

### 单条记录 JSON 导出
1. 进入"历史查询"页面
2. 点击某条记录的"下载"图标
3. 验证导出的 JSON 仅包含该条点检单的完整信息

---

## API 接口列表

### 设备管理
- `GET /api/devices` - 获取设备列表
- `POST /api/devices` - 创建设备
- `PUT /api/devices/:id` - 更新设备
- `DELETE /api/devices/:id` - 删除设备

### 班次管理
- `GET /api/shifts` - 获取班次列表
- `POST /api/shifts` - 创建班次
- `PUT /api/shifts/:id` - 更新班次
- `DELETE /api/shifts/:id` - 删除班次

### 检查项管理
- `GET /api/check-items` - 获取检查项列表
- `POST /api/check-items` - 创建检查项
- `PUT /api/check-items/:id` - 更新检查项
- `DELETE /api/check-items/:id` - 删除检查项

### 点检计划
- `GET /api/plans` - 获取计划列表
- `POST /api/plans` - 创建计划
- `PUT /api/plans/:id` - 更新计划
- `DELETE /api/plans/:id` - 删除计划

### 点检单
- `GET /api/inspections` - 获取点检单列表（支持筛选）
- `GET /api/inspections/:id` - 获取单条详情
- `POST /api/inspections` - 创建点检单
- `PUT /api/inspections/:id/results` - 更新检查结果
- `POST /api/inspections/:id/submit` - 提交点检单
- `POST /api/inspections/:id/review` - 主管复核
- `POST /api/inspections/:id/close` - 关闭异常
- `POST /api/inspections/:id/undo` - 撤销上一步

### 文件和导出
- `POST /api/evidence` - 上传异常照片
- `GET /api/evidence/:filename` - 查看照片
- `GET /api/export/csv` - 导出点检单 CSV
- `GET /api/export/json` - 导出全部数据 JSON
- `GET /api/export/order/:id/json` - 导出单条记录 JSON

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| `DUPLICATE_INSPECTION` | 同一设备同一班次重复开单 |
| `ANOMALY_MISSING_EVIDENCE` | 异常缺少照片证据 |
| `INVALID_STATUS_TRANSITION` | 非法的状态流转 |
| `INVALID_OPERATION` | 无效操作（如撤销到最初状态） |
| `VALIDATION_ERROR` | 参数校验错误 |
| `NOT_FOUND` | 资源不存在 |

---

## 开发命令

```bash
npm run dev          # 同时启动前端和后端（开发模式）
npm run client:dev   # 仅启动前端
npm run server:dev   # 仅启动后端
npm run build        # 构建生产版本
npm run check        # TypeScript 类型检查
npm run lint         # ESLint 检查
```

## 重置数据

如需重新初始化样例数据，删除 `data` 目录后重启应用即可：

```bash
# Windows PowerShell
Remove-Item -Recurse -Force data

# 或手动删除文件夹
```

---

## 浏览器兼容性

- Chrome / Edge 90+
- Firefox 88+
- Safari 14+

建议使用 Chrome/Edge 浏览器获得最佳体验。
