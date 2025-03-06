# Claude 股票分析 MCP 服务器

这是一个基于 Model Context Protocol (MCP) 的服务器，为 Claude Desktop 提供股票分析工具。该服务器集成了现有的股票分析功能，包括筹码分析、形态分析和趋势反转检测。

## 功能特点

- 完全兼容 Claude Desktop 的 MCP 接口
- 提供两个主要工具:
  - `get-stock-analysis`: 开始分析特定股票
  - `check-analysis-status`: 查询分析状态和结果
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
         "command": "node /Users/你的用户名/Documents/git/claude-stock-mcp/dist/stock-analysis-server.js"
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

Claude 将使用 `get-stock-analysis` 工具开始分析，并返回一个任务 ID。

### 查询分析状态

示例问题:
- "请查询之前分析的状态"
- "分析完成了吗？"
- "查看任务 [任务ID] 的状态"

Claude 将使用 `check-analysis-status` 工具获取分析结果。如果分析已完成，它会提供交易计划摘要。

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
├── index.ts    # MCP 服务器主文件
├── src/
│   ├── analysis/              # 股票分析相关代码
│   │   ├── FormatTradePlan.ts
│   │   ├── IntegratedAnalysis.ts
│   │   ├── SaveTradePlanToHTML.ts
│   │   └── ...
│   └── util/                  # 工具函数
├── dist/                      # 编译输出
├── trading-reports/           # 分析报告保存目录
├── package.json
└── tsconfig.json
```

## 许可证

MIT
