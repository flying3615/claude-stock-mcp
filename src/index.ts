#!/usr/bin/env node

/**
 * Stock Analysis MCP Server
 *
 * 这个服务器基于 Model Context Protocol，提供股票分析工具给 Claude Desktop
 */

import { FastMCP, UserError } from 'fastmcp';
import { z } from 'zod';
import { FMPQuery } from './finance/FMPQuery.js';
import { StrategyAnalysisAgent } from './strategy/StrategyAnalysisAgent.js';
import { TaskManager, TaskStatus } from './util/TaskManager.js';
import { Logger } from './util/Logger.js';
import { executeIntegratedAnalysis } from '@gabriel3615/ta_analysis';
import { MarketQuery } from './finance/MarketQuery.js';
import { formatTradePlanOutput } from '@gabriel3615/ta_analysis/dist/analysis/FormatTradePlan.js';

// 初始化日志记录器，重定向控制台输出到文件
// 设置为true表示完全静默模式，不会有任何控制台输出，避免干扰Claude Desktop
Logger.init(true);

// 任务状态枚举

// 初始化任务管理器
const taskManager = new TaskManager();
const marketQuery = new MarketQuery();
const fmpQuery = new FMPQuery();

// 初始化 FastMCP 实例
const server = new FastMCP({
  name: 'Stock Analysis Server',
  version: '1.0.0',
});

server.addTool({
  name: 'get-task-status',
  description: '查询异步任务的状态',
  parameters: z.object({
    taskId: z.string().describe('任务ID'),
  }),
  execute: async (args, { log }) => {
    const { taskId } = args;

    // 获取任务信息
    const task = taskManager.getTask(taskId);

    if (!task) {
      throw new UserError(`找不到任务ID: ${taskId}`);
    }

    log.info(`查询任务状态，任务ID: ${taskId}, 状态: ${task.status}`);

    // 如果任务已完成，直接返回结果（与原始API保持相同格式）
    if (task.status === TaskStatus.COMPLETED && task.result) {
      return JSON.stringify(task.result);
    }

    // 如果任务失败，抛出错误
    if (task.status === TaskStatus.FAILED) {
      throw new UserError(`任务执行失败: ${task.error || '未知错误'}`);
    }

    // 如果任务仍在进行中，返回状态信息
    return JSON.stringify({
      taskId: task.id,
      status: task.status,
      startTime: task.startTime,
      message: '任务仍在处理中，请稍后再查询',
    });
  },
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

    try {
      log.info(`开始分析股票 ${symbol.toUpperCase()}`);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const plan = await executeIntegratedAnalysis(symbol, weights);
      // TODO call each analysis function and return the result
      return JSON.stringify(plan);
    } catch (e) {
      throw new UserError(`分析股票失败: ${e.message}`);
    }
  },
});

server.addTool({
  name: 'company-fundamental',
  description: '获得公司基本信息及评级',
  parameters: z.object({
    symbol: z.string().describe('股票代码，例如 AAPL 或 MSFT'),
    metrics: z
      .array(
        z.enum(['overview', 'income', 'balance', 'cash', 'ratios', 'ratings'])
      )
      .optional()
      .describe('需要获取的指标列表概况，收入，资产负债表，现金流量表，比率'),
  }),
  execute: async (args, { log }) => {
    const { symbol, metrics } = args;

    // 验证股票代码
    if (!symbol || !/^[A-Za-z0-9.]{1,10}$/.test(symbol)) {
      throw new UserError('请提供有效的股票代码，例如 AAPL 或 MSFT');
    }
    try {
      log.info(`开始获得公司基本面信息 ${symbol.toUpperCase()}`);
      const result = await new FMPQuery().companyFundamentals({
        symbol,
        metrics,
      });
      return JSON.stringify(result);
    } catch (e) {
      throw new UserError(`获取公司基本面信息失败: ${e.message}`);
    }
  },
});

server.addTool({
  name: 'market-performance',
  description: '今日市场表现',
  parameters: z.object({
    types: z.array(z.enum(['gainers', 'losers', 'top'])).default(['top']),
    topNumber: z.number().optional().default(5).describe('显示前几名'),
  }),
  execute: async args => {
    try {
      const { types, topNumber } = args;

      const result = {};
      const fearGreedIndex = await marketQuery.getFearGreedIndex();
      if (fearGreedIndex) {
        result['fearGreedIndex'] = fearGreedIndex;
      }

      if (types.includes('gainers')) {
        result['biggestGainers'] =
          await fmpQuery.queryBiggestGainers(topNumber);
      }

      if (types.includes('losers')) {
        result['biggestLosers'] = await fmpQuery.queryBiggestLosers(topNumber);
      }

      if (types.includes('top')) {
        result['topPerformers'] =
          await fmpQuery.queryTopTradedStocks(topNumber);
      }

      result['indexes'] = await marketQuery.getMarketIndices();

      return JSON.stringify(result);
    } catch (e) {
      throw new UserError(`获取市场表现失败: ${e.message}`);
    }
  },
});

server.addTool({
  name: 'start-bull-bear-scan',
  description: '开始扫描市场中股票的多头和空头信号（异步任务）',
  parameters: z.object({
    minVolume: z.number().default(5000000).optional().describe('最小成交量'),
    sourceIds: z
      .array(
        z.enum([
          'day_gainers',
          'growth_technology_stocks',
          'most_actives',
          'small_cap_gainers',
          'aggressive_small_caps',
        ])
      )
      .default(['most_actives'])
      .optional()
      .describe('股票分类'),
  }),

  execute: async (args, { log }) => {
    const { minVolume, sourceIds } = args;
    // 使用新的任务包装器启动异步任务
    const taskId = taskManager.startAsyncTask(
      // 定义要执行的异步任务
      async () => {
        log.info(`开始扫描市场中股票的多头和空头信号`);
        return await new StrategyAnalysisAgent().checkBullBearWithSR({
          minVolume,
          sourceIds,
        });
      },
      // 传递日志记录器
      log
    );

    // 立即返回任务ID
    return JSON.stringify({ taskId, status: TaskStatus.PENDING });
  },
});

server.addTool({
  name: 'start-strong-signal-scan',
  description: '开始扫描市场中基于信号的强势股票（异步任务）',
  parameters: z.object({}),
  execute: async (args, { log }) => {
    // 使用任务包装器启动异步任务
    const taskId = taskManager.startAsyncTask(
      // 定义要执行的异步任务
      async () => {
        log.info(`开始扫描市场中强势股票`);
        return await new StrategyAnalysisAgent().queryStrongSignalStocks();
      },
      // 传递日志记录器
      log
    );

    // 立即返回任务ID
    return JSON.stringify({ taskId, status: TaskStatus.PENDING });
  },
});

server.addTool({
  name: 'start-hot-stock-scan',
  description: '扫描市场中基于适合趋势条件的热门股票（异步任务）',
  parameters: z.object({}),
  execute: async (args, { log }) => {
    const taskId = taskManager.startAsyncTask(
      async () => {
        log.info(`开始扫描市场中热门股票代码`);
        return await new StrategyAnalysisAgent().queryRecordRankedHotStockCodes();
      },
      // 传递日志记录器
      log
    );

    // 立即返回任务ID
    return JSON.stringify({ taskId, status: TaskStatus.PENDING });
  },
});

// 设置定期清理过期任务
setInterval(
  () => {
    taskManager.cleanupTasks(24); // 清理24小时前完成的任务
  },
  60 * 60 * 1000
); // 每小时执行一次

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
