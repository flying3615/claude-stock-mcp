# 股票分析 MCP 服务器

这是一个基于 Model Context Protocol (MCP) 的服务器，为 Claude Desktop 提供股票分析工具。该服务器集成了现有的股票分析功能，包括筹码分析、形态分析、趋势反转检测和市场扫描功能。

- 股票数据查询: Yahoo Finance
- 公司基本面数据查询: 需要 FMP API_KEY (https://site.financialmodelingprep.com/)

## 功能特点

- 完全兼容 Claude Desktop 的 MCP 接口
- 提供多种股票分析工具:
  - `get-stock-analysis`: 分析特定股票
  - `company-fundamental`: 查询公司基本面数据
  - `start-bull-bear-scan`: 扫描市场中的多头和空头信号（异步任务）
  - `start-strong-signal-scan`: 扫描市场中的强势股票（异步任务）
  - `start-hot-stock-scan`: 扫描市场中排名靠前的热门股票（异步任务）
  - `get-task-status`: 查询异步任务的状态和结果
  - `market-performance`: 今日市场表现，查询涨跌幅，交易量最大的股票
- 支持长时间运行的异步分析任务
- 集成了全面的股票分析功能
- 生成详细的交易计划报告

## 安装与配置

### 前提条件

- Node.js >= 16.0.0
- npm >= 7.0.0
- Claude Desktop

### 本地安装与运行

1. 克隆代码库:
   ```bash
   git clone https://github.com/yourusername/claude-stock-mcp.git
   cd claude-stock-mcp
   ```

2. 安装依赖:
   ```bash
   npm install
   ```

3. 在开发模式下测试服务器:
   ```bash
   npm run dev
   ```
   
   或使用 MCP Inspector:
   ```bash
   npm run inspect
   ```

4. 构建项目:
   ```bash
   npm run build
   ```

5. 启动服务器:
   ```bash
   npm start
   ```

### 配置 Claude Desktop

1. 创建或编辑 Claude Desktop 配置文件:
   ```bash
   # macOS
   open -a "TextEdit" ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. 添加服务器配置:
   ```json
   {
     "mcpServers": {
       "stock-analysis": {
       "command": "npx",
       "args": [
         "@gabriel3615/claude-stock-analysis-mcp@latest"
        ],
        "env": {
         "FMP_API_KEY": "KEY_HERE"
        }
       }
     }
   }
   ```
   注意: 必须使用绝对路径，并替换"你的用户名"为实际用户名。

3. 保存配置文件并重启 Claude Desktop。

## 使用方法

服务器配置好后，你可以在 Claude Desktop 中使用以下方式访问股票分析功能:

### 分析股票

示例问题:
- "请分析苹果公司的股票表现"
- "我想了解特斯拉股票（TSLA）的交易信号"
- "帮我分析 NVDA 的入场时机和止损位"

Claude 将使用 `get-stock-analysis` 工具分析特定股票。

### 使用异步市场扫描功能

示例问题:
- "请扫描市场，找出目前处于支撑位的多头信号股票"
- "帮我找出市场中最强势的股票"
- "扫描并列出近期热门股票"

Claude 将使用相应的异步任务工具，例如 `start-bull-bear-scan`，并返回一个任务ID。你可以使用该ID查询任务状态和结果。

异步任务使用方法:
1. 启动一个异步扫描任务，获取任务ID
2. 使用 `get-task-status` 查询任务状态
3. 当任务完成时，获取分析结果

这种异步方式可以处理长时间运行的复杂市场分析，避免请求超时问题。

## 开发测试

fastmcp提供了两种便捷的测试方式：

1. 使用命令行模式测试：
   ```bash
   npm run dev
   ```

2. 使用Web界面测试：
   ```bash
   npm run inspect
   ```

这些命令会启动相应的测试环境，让你可以直接与MCP服务器交互，无需Claude Desktop。

## 项目结构

```
claude-stock-mcp/
├── src/
│   ├── index.ts                # MCP 服务器主文件
│   ├── analysis/               # 股票分析相关代码
│   │   ├── IntegratedAnalysis.ts
│   │   ├── IntegratedAnalysisTypes.ts
│   │   ├── chip/               # 筹码分析
│   │   ├── patterns/           # 形态分析
│   │   └── trendReversal/      # 趋势反转分析
│   ├── finance/                # 金融数据相关
│   │   ├── Conditions.ts
│   │   ├── Evaluator.ts
│   │   ├── FMPQuery.ts         # Financial Modeling Prep API 查询
│   │   ├── MarketQuery.ts      # 市场数据查询
│   │   └── __tests__/          # 测试文件
│   ├── strategy/               # 策略分析
│   │   ├── BreakoutDetector.ts
│   │   ├── BullOrBearDetector.ts
│   │   └── StrategyAnalysisAgent.ts
│   ├── types.ts                # 类型定义
│   ├── config.ts               # 配置文件
│   └── util/                   # 工具函数
│       ├── TaskManager.ts      # 异步任务管理
│       ├── Logger.ts           # 日志处理
│       └── util.ts             # 通用工具函数
├── dist/                       # 编译输出
├── logs/                       # 日志文件目录
├── package.json
└── tsconfig.json
```

## 日志系统

为了避免 console 输出干扰 Claude Desktop，项目使用自定义日志系统：

- 所有控制台输出被重定向到日志文件
- 日志文件位于 `logs/` 目录
- 在 Claude Desktop 环境中启用静默模式，禁止所有控制台输出

## 许可证

MIT