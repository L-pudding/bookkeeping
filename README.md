# 记账本小程序 - 使用说明

## 这个小程序能干什么

- **随手记**：首页 3 秒记一笔（金额 + 账户 + 分类就够）
- **多账户**：微信支付、支付宝、银行卡、现金……都建成账户，各管各的
- **防重复**：每笔交易自动生成"指纹"（金额+时间+商户），重复的交易不会入库
- **防漏记**：对账页对比每个账户的"应有余额"（系统算的）vs"实际余额"（你填的），差额不为 0 就是漏了
- **导入账单**：支持微信/支付宝/银行流水导入，CSV 和 Excel(.xlsx/.xls) 都能直接传，自动去重

## 怎么跑起来（6 步）

### 1. 注册小程序账号
去 https://mp.weixin.qq.com 注册一个微信小程序账号，拿到 **AppID**。

### 2. 下载微信开发者工具
去 https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html 下载安装。

### 3. 导入项目
- 打开开发者工具，选「导入项目」
- 项目目录选这个文件夹（bookkeeping）
- AppID 填你注册时拿到的
- 后端服务选「微信云开发」

### 4. 开通云开发 + 修改环境 ID
- 点工具栏「云开发」按钮，按提示开通（免费套餐够用）
- 开通后会得到一个**环境 ID**（类似 `bookkeeping-xxxxx`）
- 打开 `miniprogram/app.js`，把第 7 行 `your-env-id` 换成你的环境 ID
- 打开 `project.config.json`，把 `your-appid-here` 换成你的 AppID

### 5. 部署云函数
- 在开发者工具左侧文件树，右键 `cloudfunctions` 下的每个文件夹
- 选「上传并部署：云端安装依赖」
- 7 个云函数都要部署：
  - `addTransaction` - 添加交易（含指纹去重）
  - `getTransactions` - 查询流水
  - `getAccounts` - 查询账户
  - `manageAccount` - 管理账户（增删改）
  - `reconcile` - 对账计算
  - `initData` - 初始化默认数据
  - `parseBill` - 账单解析（CSV/Excel → 结构化交易记录）

### 6. 创建数据库集合
在云开发控制台 → 数据库，手动创建 3 个集合：
- `accounts`（账户）
- `transactions`（交易）
- `categories`（分类）

权限设置：每个集合的权限改为「仅创建者可读写」。

## 使用流程

1. **首次打开**：会自动初始化 3 个默认账户（微信支付、支付宝、现金）和常用分类
2. **日常记账**：首页输入金额 → 选账户 → 选分类 → 保存
3. **添加账户**：账户页 → + 添加账户（可以建储蓄卡、信用卡等）
4. **对账**：对账页 → 每个账户显示应有余额 vs 实际余额 → 差额不为 0 的标红
5. **导入账单**：导入页 → 选账户 → 选格式 → 上传文件（CSV 或 Excel）→ 预览解析结果 → 确认导入

## 文件结构

```
bookkeeping/
├── miniprogram/             ← 小程序前端
│   ├── pages/
│   │   ├── home/            ← 首页（快速记账）
│   │   ├── transactions/    ← 流水列表
│   │   ├── accounts/        ← 账户管理
│   │   ├── reconcile/       ← 对账视图
│   │   └── import/          ← 账单导入（只管 UI + 上传）
│   ├── utils/
│   │   ├── fingerprint.js   ← 指纹生成（去重核心）
│   │   ├── format.js        ← 金额/日期格式化
│   │   ├── api.js           ← 云函数调用封装
│   │   └── billParser.js    ← 上传文件 + 调 parseBill 云函数
│   ├── app.js / app.json / app.wxss
│   └── sitemap.json
├── cloudfunctions/
│   ├── addTransaction/      ← 添加交易（含指纹去重）
│   ├── getTransactions/     ← 查询流水
│   ├── getAccounts/         ← 查询账户
│   ├── manageAccount/      ← 管理账户
│   ├── reconcile/           ← 对账计算
│   ├── initData/            ← 初始化默认数据
│   └── parseBill/            ← 账单解析云函数
│       ├── index.js          ← 入口：下载文件 → 判断格式 → 调度解析器
│       └── parsers/          ← 解析器模块（各管各的，互不依赖）
│           ├── csvUtils.js   ← 共享工具：CSV 拆行、日期解析、金额清洗
│           ├── excelParser.js← Excel → 行数组（用 xlsx 库）
│           ├── wechatParser.js  ← 微信账单
│           ├── alipayParser.js  ← 支付宝账单
│           ├── bankParser.js    ← 银行流水（智能识别列头）
│           └── genericParser.js← 通用 CSV
└── project.config.json
```

## 模块化设计说明

账单解析采用分层模块化架构：

```
import.js (前端)          → 只管 UI + 上传文件
  ↓ 调用
billParser.js (前端)      → 上传到云存储 + 调 parseBill 云函数
  ↓ 调用
parseBill/index.js (云端) → 下载文件 → 判断 Excel/CSV → 转成行数组 → 调度解析器
  ↓ 调用
parsers/*.js (云端)       → 各格式解析器独立，只依赖 csvUtils
```

**改一处不影响全局：**
- 加新银行格式 → 只改 `bankParser.js`
- 加新平台（如京东金融）→ 新建 `parsers/jdParser.js`，在 `index.js` 的 FORMAT_MAP 加一行
- 换 Excel 解析库 → 只改 `excelParser.js`
- 前端 UI 改版 → 只改 `import.js` + `import.wxml`，解析逻辑不受影响

## 防重防漏原理

**防重（指纹去重）**：每笔交易生成指纹 = hash(归一化金额 + 分钟级时间 + 归一化商户名)。保存前先查同指纹的交易是否已存在，存在就跳过。所以你手动记了一笔，又从微信账单导入了同一笔——系统会识别并跳过。

**防漏（余额对账）**：每个账户有两个余额：
- **应有余额** = 初始余额 + 收入合计 - 支出合计（系统按记录的交易算出来）
- **实际余额** = 你手动填的（比如打开微信看一眼填进去）

两者不等，就是有漏记或错记，对账页标红提醒你。
