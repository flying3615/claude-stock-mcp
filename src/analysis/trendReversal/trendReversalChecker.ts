import {
  detectTrendReversal,
  TrendReversalSignal,
} from './multiTimeFrameTrendReversal.js';
import { Candle } from '../../types.js';
import { getStockDataForTimeframe } from '../../util/util.js';

/**
 * 检查股票是否出现小时对日线的顺势逆转信号 - 增强版，含目标价位
 *
 * @param hourlyData 小时级别K线数据
 * @param dailyData 日线级别K线数据
 * @param signalThreshold 信号强度阈值，只有超过此值才被认为是有效信号，默认为40
 * @returns 包含判断结果和详细信号信息的对象，含目标价位
 */
function hasTrendReversalSignal(
  hourlyData: Candle[],
  dailyData: Candle[],
  signalThreshold: number = 40
): {
  hasSignal: boolean;
  primarySignal?: TrendReversalSignal;
  summary: string;
} {
  // 只检查小时对日线的逆转
  const hourlyVsDailySignal = detectTrendReversal(
    hourlyData,
    dailyData,
    '1hour',
    'daily'
  );

  // 检查是否有效信号
  const isValidSignal =
    hourlyVsDailySignal.isReversal &&
    hourlyVsDailySignal.reversalStrength >= signalThreshold;

  // 判断是否存在有效信号
  const hasSignal = isValidSignal;

  // 设置主要信号
  const primarySignal = hasSignal ? hourlyVsDailySignal : undefined;

  // 生成摘要描述
  let summary = '';
  if (hasSignal) {
    const signal = primarySignal!;
    const directionText = signal.direction > 0 ? '上涨' : '下跌';
    const actionText = signal.direction > 0 ? '做多' : '做空';

    summary = `检测到小时线对日线的顺势逆转信号，小时线从逆势调整转为顺应日线${directionText}趋势，信号强度: ${signal.reversalStrength.toFixed(1)}/100，建议${actionText}`;

    if (signal.entryPrice) {
      summary += `，入场价: ${signal.entryPrice.toFixed(2)}`;
    }

    // 添加目标价位信息
    if (signal.targets) {
      summary += `，目标价1: ${signal.targets.target1.toFixed(2)}`;
      summary += `，目标价2: ${signal.targets.target2.toFixed(2)}`;
      summary += `，目标价3: ${signal.targets.target3.toFixed(2)}`;
    }
  } else {
    // 检查是否有弱信号
    if (
      hourlyVsDailySignal.isReversal &&
      hourlyVsDailySignal.reversalStrength < signalThreshold
    ) {
      summary = `检测到弱小时线对日线顺势逆转信号，但强度不足${signalThreshold}，建议等待更明确的信号`;
    } else {
      summary = '未检测到小时线对日线的顺势逆转信号';
    }
  }

  return {
    hasSignal,
    primarySignal,
    summary,
  };
}

/**
 * 快速检查单个股票是否存在小时对日线的顺势逆转信号
 * 此函数会自动获取数据并进行分析
 *
 * @param symbol 股票代码
 * @param signalThreshold 信号强度阈值
 * @returns 包含判断结果和详细信号信息的对象
 */
async function checkStockForReversalSignal(
  symbol: string,
  signalThreshold: number
): Promise<{
  symbol: string;
  hasSignal: boolean;
  primarySignal?: TrendReversalSignal;
  summary: string;
}> {
  try {
    // 获取不同时间周期的数据
    const today = new Date();

    const startDateWeekly = new Date();
    startDateWeekly.setDate(today.getDate() - 365); // 获取一年的数据

    const startDateDaily = new Date();
    startDateDaily.setDate(today.getDate() - 90); // 获取三个月的数据

    const startDateHourly = new Date();
    startDateHourly.setDate(today.getDate() - 30); // 获取一个月的数据

    // 获取日线和小时线数据

    const dailyData = await getStockDataForTimeframe(
      symbol,
      startDateDaily,
      today,
      'daily'
    );

    const hourlyData = await getStockDataForTimeframe(
      symbol,
      startDateHourly,
      today,
      '1hour'
    );

    // 只检查小时对日线的顺势逆转信号
    const result = hasTrendReversalSignal(
      hourlyData,
      dailyData,
      signalThreshold
    );

    return {
      symbol,
      ...result,
    };
  } catch (error) {
    console.error(`分析${symbol}时出错:`, error);
    return {
      symbol,
      hasSignal: false,
      summary: `分析${symbol}时发生错误: ${error.message}`,
    };
  }
}

export { hasTrendReversalSignal, checkStockForReversalSignal };
