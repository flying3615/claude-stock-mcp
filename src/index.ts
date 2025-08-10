#!/usr/bin/env node

/**
 * Stock Analysis MCP Server
 *
 * 这个服务器基于 Model Context Protocol，提供股票分析工具给 Claude Desktop
 */

import { FastMCP, UserError } from 'fastmcp';
import { z } from 'zod';
import { StrategyAnalysisAgent } from './strategy/StrategyAnalysisAgent.js';
import { TaskManager, TaskStatus } from './util/TaskManager.js';
import { Logger } from './util/Logger.js';
import {
  executeIntegratedAnalysisV2,
  formatTradePlanOutput,
} from '@gabriel3615/ta_analysis';
import { EconomicIndicator, MarketQuery } from './finance/MarketQuery.js';
import { FMPQuery } from './finance/FMPQuery.js';
import { AlphaVantageQuery } from './finance/AlphaVantageQuery.js';
import { timeFrameConfigs } from './config.js';

// 初始化日志记录器，重定向控制台输出到文件
// 设置为true表示完全静默模式，不会有任何控制台输出，避免干扰Claude Desktop
Logger.init(true);

// 任务状态枚举

// 初始化任务管理器
const taskManager = new TaskManager();
const marketQuery = new MarketQuery();
const fmpQuery = new FMPQuery();
const avQuery = new AlphaVantageQuery();

// 初始化 FastMCP 实例
const server = new FastMCP({
  name: 'Stock Analysis Server',
  version: '1.0.0',
});

// <=====查询外部API=====>
server.addTool({
  name: 'query-company-fundamental',
  description: '获得公司基本信息',
  parameters: z.object({
    symbol: z.string().describe('股票代码，例如 AAPL 或 MSFT'),
    metrics: z
      .array(z.enum(['overview', 'income', 'balance', 'cash', 'earnings']))
      .optional()
      .describe('需要获取的指标列表概况，收入，资产负债表，现金流量表'),
  }),
  execute: async (args, { log }) => {
    const { symbol, metrics } = args;
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY!;

    // 验证股票代码
    if (!symbol || !/^[A-Za-z0-9.]{1,10}$/.test(symbol)) {
      throw new UserError('请提供有效的股票代码，例如 AAPL 或 MSFT');
    }
    try {
      log.info(`开始获得公司基本面信息 ${symbol.toUpperCase()}`);
      const result = await avQuery.companyFundamentals(apiKey, {
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
  name: 'query-stock-market-performance',
  description: '今日市场表现',
  parameters: z.object({
    topNumber: z.number().optional().default(10).describe('显示前几名'),
  }),
  execute: async args => {
    try {
      const { topNumber } = args;

      const result = {};
      result['fearGreedIndex'] = await marketQuery.getFearGreedIndex();
      result['topTraded'] = await fmpQuery.queryTopTradedStocks(topNumber);
      result['indexes'] = await marketQuery.getMarketIndices();

      return JSON.stringify(result);
    } catch (e) {
      throw new UserError(`获取市场表现失败: ${e.message}`);
    }
  },
});

server.addTool({
  name: 'query-other-market-performance',
  description: '其他市场表现',
  parameters: z.object({
    types: z
      .array(z.enum(['treasury', 'commodity', 'crypto', 'forex']))
      .default(['treasury', 'commodity', 'crypto', 'forex']),
  }),
  execute: async args => {
    try {
      const { types } = args;

      const result = {};

      if (types.includes('treasury')) {
        result['treasury'] = await marketQuery.getTreasuryYields();
      }

      if (types.includes('commodity')) {
        result['commodity'] = await marketQuery.getCommoditiesData();
      }

      if (types.includes('crypto')) {
        result['crypto'] = await marketQuery.getCryptoData();
      }

      if (types.includes('forex')) {
        result['forex'] = await marketQuery.getForexData();
      }

      return JSON.stringify(result);
    } catch (e) {
      throw new UserError(`获取市场表现失败: ${e.message}`);
    }
  },
});

server.addTool({
  name: 'query-economic-indicators',
  description: '获取经济数据指标',
  parameters: z.object({
    types: z
      .array(z.nativeEnum(EconomicIndicator))
      .default([
        EconomicIndicator.CPI,
        EconomicIndicator.GDP,
        EconomicIndicator.Inflation,
        EconomicIndicator.FedFundsRate,
      ]),
  }),
  execute: async args => {
    try {
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY!;
      const { types } = args;

      const result = await avQuery.getEconomicIndicators(apiKey, types);

      return JSON.stringify(result);
    } catch (e) {
      throw new UserError(`获取市场表现失败: ${e.message}`);
    }
  },
});

// <======执行股票分析报告=====>
server.addTool({
  name: 'execute-stock-analysis',
  description: '分析指定股票走势',
  parameters: z.object({
    symbol: z.string().describe('股票代码，例如 AAPL 或 MSFT'),
  }),
  execute: async (args, { log }) => {
    const { symbol } = args;

    // 验证股票代码
    if (!symbol || !/^[A-Za-z0-9.]{1,10}$/.test(symbol)) {
      throw new UserError('请提供有效的股票代码，例如 AAPL 或 MSFT');
    }

    try {
      log.info(`开始分析股票 ${symbol.toUpperCase()}`);
      const plan = await executeIntegratedAnalysisV2(symbol);
      let fullExchangeName =
        await marketQuery.getFullExchangeNameFromQuote(symbol);
      fullExchangeName = fullExchangeName.toLowerCase().includes('nasdaq')
        ? 'NASDAQ'
        : fullExchangeName;

      const stockCode = `${fullExchangeName}:${symbol}`;
      console.log(
        `console获取股票代码 ${stockCode}, ${JSON.stringify(timeFrameConfigs)}`
      );

      // const chartImages = await fetchChartData(stockCode, timeFrameConfigs);
      // console.log('chartImages', chartImages);

      // log.info('获取股票图表数据成');
      // const chartImagesData = chartImages.map(image => {
      //   return {
      //     type: 'image' as const,
      //     data: image.imageBase64,
      //     mimeType: 'image/png',
      //   };
      // });

      return {
        content: [
          {
            type: 'text',
            // text: buildMachineReadableSummary(plan),
            text: formatTradePlanOutput(plan),
          },
          // ...chartImagesData,
        ],
      };
    } catch (e) {
      throw new UserError(`分析股票失败: ${e.message}`);
    }
  },
});

// <======启动异步任务工具=====>
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
    const normalizedSourceIds = Array.isArray(sourceIds)
      ? sourceIds
      : sourceIds
        ? [sourceIds]
        : [];
    // 使用新的任务包装器启动异步任务
    const taskId = taskManager.startAsyncTask(
      // 定义要执行的异步任务
      async () => {
        log.info(`开始扫描市场中股票的多头和空头信号`);
        return await new StrategyAnalysisAgent().checkBullBearWithSR({
          minVolume,
          sourceIds: normalizedSourceIds,
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

// <=====任务查询工具=====>
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

// 设置定期清理过期任务
setInterval(
  () => {
    taskManager.cleanupTasks(24); // 清理24小时前完成的任务
  },
  60 * 60 * 1000
); // 每小时执行一次

// 启动服务器
await server.start({
  transportType: 'stdio',
});

export default server;
