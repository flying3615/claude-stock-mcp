/**
 * Stock Analysis MCP Server
 *
 * 这个服务器基于 Model Context Protocol，提供股票分析工具给 Claude Desktop
 */

import { FastMCP, UserError } from 'fastmcp';
import { z } from 'zod';
import { executeIntegratedAnalysis } from './analysis/IntegratedAnalysis.js';

// 初始化 FastMCP 实例
const server = new FastMCP({
  name: 'Stock Analysis Server',
  version: '1.0.0',
});

/**
 * 获取股票分析报告
 *
 * 分析特定股票的交易信号、支撑阻力位和入场策略
 */
server.addTool({
  name: 'get-stock-analysis',
  description: '分析指定股票的交易信号和策略',
  parameters: z.object({
    symbol: z.string().describe('股票代码，例如 AAPL 或 MSFT'),
    weights: z
      .object({
        chip: z.number().optional().describe('筹码分析权重 (0-1)'),
        pattern: z.number().optional().describe('形态分析权重 (0-1)'),
      })
      .optional()
      .describe('分析权重配置'),
  }),
  execute: async (args, { log }) => {
    const { symbol, weights } = args;

    // 验证股票代码
    if (!symbol || !/^[A-Za-z0-9.]{1,10}$/.test(symbol)) {
      throw new UserError('请提供有效的股票代码，例如 AAPL 或 MSFT');
    }

    log.info(`开始分析股票 ${symbol.toUpperCase()}`);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const result = await executeIntegratedAnalysis(symbol, weights);
    return JSON.stringify(result);
  },
});

// 启动服务器
await server.start({
  transportType: 'stdio', // 开发模式使用stdio
  // 生产模式应该使用SSE
  // transportType: "sse",
  // sse: {
  //   endpoint: "/sse",
  //   port: 3000,
  // }
});

// console.log('股票分析 MCP 服务器已启动');
// console.log(`可用工具: ${server.getToolNames().join(', ')}`);

export default server;
