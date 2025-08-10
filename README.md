# Stock Analysis MCP Server

This is a Model Context Protocol (MCP) server that provides stock analysis tools for Claude Desktop. The server integrates existing stock analysis features, including chip distribution analysis, pattern analysis, trend reversal detection, and market scanning capabilities.

- Stock data query: Yahoo Finance
- Company fundamental data query: Requires FMP API_KEY (https://site.financialmodelingprep.com/)

## Features

- Fully compatible with Claude Desktop's MCP interface
- Provides various stock analysis tools:
  - `get-stock-analysis`: Analyze specific stocks
  - `company-fundamental`: Query company fundamental data
  - `start-bull-bear-scan`: Scan the market for bullish and bearish signals (asynchronous task)
  - `start-strong-signal-scan`: Scan the market for strong momentum stocks (asynchronous task)
  - `start-hot-stock-scan`: Scan the market for top trending stocks (asynchronous task)
  - `get-task-status`: Query the status and results of asynchronous tasks
  - `market-performance`: Today's market performance, query stocks with biggest gains/losses and highest volume
- Support for long-running asynchronous analysis tasks
- Integration of comprehensive stock analysis functions
- Generation of detailed trading plan reports

## Installation and Configuration

### Prerequisites

- Node.js >= 16.0.0
- npm >= 7.0.0
- Claude Desktop

### Local Installation and Running

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/claude-stock-mcp.git
   cd claude-stock-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Test the server in development mode:
   ```bash
   npm run dev
   ```
   
   Or use MCP Inspector:
   ```bash
   npm run inspect
   ```

4. Build the project:
   ```bash
   npm run build
   ```

5. Start the server:
   ```bash
   npm start
   ```

### Configure Claude Desktop

1. Create or edit the Claude Desktop configuration file:
   ```bash
   # macOS
   open -a "TextEdit" ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. Add the server configuration:
   ```json
   {
     "mcpServers": {
       "stock-analysis": {
       "command": "npx",
       "args": [
         "@gabriel3615/claude-stock-analysis-mcp@latest"
        ],
        "env": {
         "FMP_API_KEY": "KEY_HERE",
         "APLPVANTAGE_API_KEY": "KEY_HERE"
        }
       }
     }
   }
   ```
   Note: You must use absolute paths and replace "yourusername" with your actual username.

3. Save the configuration file and restart Claude Desktop.

## Usage

Once the server is configured, you can access the stock analysis features in Claude Desktop using the following approaches:

### Analyze Stocks

Example questions:
- "Please analyze Apple's stock performance"
- "I want to understand the trading signals for Tesla stock (TSLA)"
- "Help me analyze entry points and stop-loss levels for NVDA"

Claude will use the `get-stock-analysis` tool to analyze specific stocks.

### Using Asynchronous Market Scanning Features

Example questions:
- "Please scan the market for bullish signal stocks currently at support levels"
- "Help me find the strongest momentum stocks in the market"
- "Scan and list recent hot stocks"

Claude will use the appropriate asynchronous task tools, such as `start-bull-bear-scan`, and return a task ID. You can use this ID to query task status and results.

How to use asynchronous tasks:
1. Start an asynchronous scan task and get a task ID
2. Use `get-task-status` to check the task status
3. When the task is complete, retrieve the analysis results

This asynchronous approach can handle complex market analyses that run for an extended period, avoiding request timeout issues.

## Development Testing

fastmcp provides two convenient ways to test:

1. Using command line mode:
   ```bash
   npm run dev
   ```

2. Using web interface:
   ```bash
   npm run inspect
   ```

These commands will start the respective test environments, allowing you to interact directly with the MCP server without requiring Claude Desktop.

## Project Structure

```
claude-stock-mcp/
├── src/
│   ├── index.ts                # MCP server main file
│   ├── analysis/               # Stock analysis related code
│   │   ├── IntegratedAnalysis.ts
│   │   ├── IntegratedAnalysisTypes.ts
│   │   ├── chip/               # Chip distribution analysis
│   │   ├── patterns/           # Pattern analysis
│   │   └── trendReversal/      # Trend reversal analysis
│   ├── finance/                # Financial data related
│   │   ├── Conditions.ts
│   │   ├── Evaluator.ts
│   │   ├── FMPQuery.ts         # Financial Modeling Prep API query
│   │   ├── MarketQuery.ts      # Market data query
│   │   └── __tests__/          # Test files
│   ├── strategy/               # Strategy analysis
│   │   ├── BreakoutDetector.ts
│   │   ├── BullOrBearDetector.ts
│   │   └── StrategyAnalysisAgent.ts
│   ├── types.ts                # Type definitions
│   ├── config.ts               # Configuration file
│   └── util/                   # Utility functions
│       ├── TaskManager.ts      # Asynchronous task management
│       ├── Logger.ts           # Log handling
│       └── util.ts             # Common utility functions
├── dist/                       # Compiled output
├── logs/                       # Log file directory
├── package.json
└── tsconfig.json
```

## Logging System

To avoid console output interfering with Claude Desktop, the project uses a custom logging system:

- All console outputs are redirected to log files
- Log files are located in the `logs/` directory
- Silent mode is enabled in the Claude Desktop environment, preventing all console output

## License

MIT
