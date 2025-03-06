import {
  analyzeMultiTimeframePatterns,
  ComprehensivePatternAnalysis,
} from '../patterns/multiTimeFramePatternAnalysis.js';
import { Candle } from '../../types.js';

/**
 * 趋势逆转信号接口
 */
interface TrendReversalSignal {
  isReversal: boolean; // 是否出现逆转信号
  direction: number; // 大周期趋势方向（1：上涨，-1：下跌，0：盘整）
  reversalStrength: number; // 逆转信号强度 (0-100)
  smallTimeframe: string; // 小周期类型
  largeTimeframe: string; // 大周期类型
  entryPrice?: number; // 建议入场价
  stopLoss?: number; // 建议止损价

  targets?: {
    target1: number; // 目标1 (保守目标)
    target2: number; // 目标2 (标准量度移动目标)
    target3: number; // 目标3 (扩展目标，通常是1.618倍)
    riskRewardRatio1: number; // 目标1的风险回报比
    riskRewardRatio2: number; // 目标2的风险回报比
    riskRewardRatio3: number; // 目标3的风险回报比
  };
}

/**
 * 增强的综合形态分析结果，含趋势逆转信号
 */
interface EnhancedPatternAnalysis extends ComprehensivePatternAnalysis {
  reversalSignals: TrendReversalSignal[]; // 可能有多个逆转信号（小时对日线，日线对周线）
  primaryReversalSignal?: TrendReversalSignal; // 最主要的逆转信号
}

/**
 * 计算量度移动 (Measured Move) 目标价位
 *
 * @param smallTimeframeData 小周期K线数据
 * @param windowSize 窗口大小
 * @param largerTrendDirection 大周期趋势方向
 * @param entryPrice 入场价
 * @param stopLoss 止损价
 * @returns 多个目标价位和风险回报比
 */
export function calculateMeasuredMoveTargets(
  smallTimeframeData: Candle[],
  windowSize: number,
  largerTrendDirection: number,
  entryPrice: number,
  stopLoss: number
): {
  target1: number;
  target2: number;
  target3: number;
  riskRewardRatio1: number;
  riskRewardRatio2: number;
  riskRewardRatio3: number;
} {
  // 确保数据足够
  if (smallTimeframeData.length < windowSize * 3) {
    // 数据不足，返回基于风险的保守估计
    const risk = Math.abs(entryPrice - stopLoss);
    return {
      target1: largerTrendDirection > 0 ? entryPrice + risk : entryPrice - risk,
      target2:
        largerTrendDirection > 0
          ? entryPrice + risk * 2
          : entryPrice - risk * 2,
      target3:
        largerTrendDirection > 0
          ? entryPrice + risk * 3
          : entryPrice - risk * 3,
      riskRewardRatio1: 1,
      riskRewardRatio2: 2,
      riskRewardRatio3: 3,
    };
  }

  // 寻找关键支点
  const lookbackPeriod = windowSize * 3;
  const recentData = smallTimeframeData.slice(-lookbackPeriod);

  let pivotHigh = -Infinity;
  let pivotLow = Infinity;
  let pivotHighIndex = -1;
  let pivotLowIndex = -1;

  if (largerTrendDirection > 0) {
    // 上涨趋势
    // 寻找之前下跌的最高点
    for (let i = 0; i < recentData.length - windowSize; i++) {
      if (recentData[i].high > pivotHigh) {
        pivotHigh = recentData[i].high;
        pivotHighIndex = i;
      }
    }

    // 寻找之前下跌的最低点
    for (let i = pivotHighIndex; i < recentData.length - windowSize / 3; i++) {
      if (recentData[i].low < pivotLow) {
        pivotLow = recentData[i].low;
        pivotLowIndex = i;
      }
    }

    if (pivotHighIndex >= 0 && pivotLowIndex > pivotHighIndex) {
      const previousDownMove = pivotHigh - pivotLow;
      const risk = entryPrice - stopLoss;

      // 计算不同的目标位
      const target1 = entryPrice + risk; // 1:1 风险回报比
      const target2 = pivotLow + previousDownMove; // 标准量度移动
      const target3 = pivotLow + previousDownMove * 1.618; // 斐波那契扩展

      return {
        target1,
        target2,
        target3,
        riskRewardRatio1: risk > 0 ? (target1 - entryPrice) / risk : 1,
        riskRewardRatio2: risk > 0 ? (target2 - entryPrice) / risk : 2,
        riskRewardRatio3: risk > 0 ? (target3 - entryPrice) / risk : 3,
      };
    }
  } else {
    // 下跌趋势
    // 寻找之前上涨的最低点
    for (let i = 0; i < recentData.length - windowSize; i++) {
      if (recentData[i].low < pivotLow) {
        pivotLow = recentData[i].low;
        pivotLowIndex = i;
      }
    }

    // 寻找之前上涨的最高点
    for (let i = pivotLowIndex; i < recentData.length - windowSize / 3; i++) {
      if (recentData[i].high > pivotHigh) {
        pivotHigh = recentData[i].high;
        pivotHighIndex = i;
      }
    }

    if (pivotLowIndex >= 0 && pivotHighIndex > pivotLowIndex) {
      const previousUpMove = pivotHigh - pivotLow;
      const risk = stopLoss - entryPrice;

      // 计算不同的目标位
      const target1 = entryPrice - risk; // 1:1 风险回报比
      const target2 = pivotHigh - previousUpMove; // 标准量度移动
      const target3 = pivotHigh - previousUpMove * 1.618; // 斐波那契扩展

      return {
        target1,
        target2,
        target3,
        riskRewardRatio1: risk > 0 ? (entryPrice - target1) / risk : 1,
        riskRewardRatio2: risk > 0 ? (entryPrice - target2) / risk : 2,
        riskRewardRatio3: risk > 0 ? (entryPrice - target3) / risk : 3,
      };
    }
  }

  // 默认返回基于风险的保守估计
  const risk = Math.abs(entryPrice - stopLoss);
  return {
    target1: largerTrendDirection > 0 ? entryPrice + risk : entryPrice - risk,
    target2:
      largerTrendDirection > 0 ? entryPrice + risk * 2 : entryPrice - risk * 2,
    target3:
      largerTrendDirection > 0 ? entryPrice + risk * 3 : entryPrice - risk * 3,
    riskRewardRatio1: 1,
    riskRewardRatio2: 2,
    riskRewardRatio3: 3,
  };
}

/**
 * 判断当前趋势方向 - 改进版，能够处理较小数量的数据
 * @param data K线数据
 * @param period 均线周期，默认为20
 * @param minSlopePoints 计算斜率的最小点数，默认为5
 * @returns 趋势方向：1表示上涨，-1表示下跌，0表示盘整
 */
function determineTrendDirection(
  data: Candle[],
  period: number = 20,
  minSlopePoints: number = 5
): number {
  // 动态调整周期，确保能够处理较小数据集
  const effectivePeriod = Math.min(period, Math.floor(data.length / 2));

  // 如果数据量实在太少，无法计算趋势，返回0
  if (data.length < Math.max(effectivePeriod + 2, minSlopePoints + 1)) {
    return 0; // 数据不足，默认为盘整
  }

  // 计算简单移动平均线 (SMA)
  const sma = [];
  for (let i = effectivePeriod - 1; i < data.length; i++) {
    const sum = data
      .slice(i - effectivePeriod + 1, i + 1)
      .reduce((acc, candle) => acc + candle.close, 0);
    sma.push(sum / effectivePeriod);
  }

  // 确定用于计算斜率的点数
  const slopePoints = Math.min(minSlopePoints, sma.length);

  // 如果计算出的SMA点数太少，无法计算趋势
  if (slopePoints < 3) {
    return 0; // 点数太少，无法可靠判断趋势
  }

  // 计算均线斜率，使用最后的几个点
  const recentSMA = sma.slice(-slopePoints);

  // 简单线性回归计算斜率
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;
  const n = recentSMA.length;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += recentSMA[i];
    sumXY += i * recentSMA[i];
    sumX2 += i * i;
  }

  // 防止分母为0
  if (n * sumX2 - sumX * sumX === 0) {
    return 0;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // 根据数据量动态调整斜率阈值
  // 较小的数据集需要更大的斜率才能判定为趋势
  const slopeThreshold = 0.0005 * (30 / Math.min(data.length, 30));

  // 用均线斜率判断趋势
  if (slope > slopeThreshold) return 1; // 上涨趋势
  if (slope < -slopeThreshold) return -1; // 下跌趋势
  return 0; // 盘整
}

/**
 * 判断小周期是否在逆转并顺从大周期趋势 - 含目标价位计算
 *
 * @param smallTimeframeData 小周期K线数据
 * @param largeTimeframeData 大周期K线数据
 * @param smallTimeframe 小周期类型
 * @param largeTimeframe 大周期类型
 * @param smallPeriod 小周期均线周期
 * @param largePeriod 大周期均线周期
 * @returns 增强版逆转信号数据，含目标价位
 */
function detectTrendReversal(
  smallTimeframeData: Candle[],
  largeTimeframeData: Candle[],
  smallTimeframe: string,
  largeTimeframe: string,
  smallPeriod: number = 15,
  largePeriod: number = 60
): TrendReversalSignal {
  // 确定大趋势方向
  const largerTrendDirection = determineTrendDirection(
    largeTimeframeData,
    largePeriod
  );

  // 如果大趋势不明确，返回无信号
  if (largerTrendDirection === 0) {
    return {
      isReversal: false,
      direction: 0,
      reversalStrength: 0,
      smallTimeframe,
      largeTimeframe,
    };
  }

  // 定义时间窗口大小，根据数据量动态调整
  const availableDataPoints = smallTimeframeData.length;
  // 每个窗口最少需要5根K线，否则可能无法可靠判断趋势
  const minWindowSize = 5;

  // 根据可用数据量确定窗口大小
  const windowSize = Math.min(
    20, // 理想的窗口大小
    Math.max(minWindowSize, Math.floor(availableDataPoints / 4))
  );

  // 确保数据足够计算两个窗口
  if (availableDataPoints < windowSize * 2) {
    return {
      isReversal: false,
      direction: 0,
      reversalStrength: 0,
      smallTimeframe,
      largeTimeframe,
    };
  }

  // 计算当前趋势 - 使用最近的数据
  const recentData = smallTimeframeData.slice(-windowSize);
  const currentSmallTrend = determineTrendDirection(
    recentData,
    Math.min(smallPeriod, Math.floor(windowSize / 2))
  );

  // 计算之前的趋势 - 使用再往前的一段数据
  const previousData = smallTimeframeData.slice(-windowSize * 2, -windowSize);
  const previousSmallTrend = determineTrendDirection(
    previousData,
    Math.min(smallPeriod, Math.floor(windowSize / 2))
  );

  // 判断小周期是否从逆向大趋势转向顺向大趋势
  const wasCounterTrend =
    previousSmallTrend === -largerTrendDirection || previousSmallTrend === 0;
  const isNowAligned = currentSmallTrend === largerTrendDirection;

  // 获取最近的价格以计算入场价和止损价
  const recentCandles = smallTimeframeData.slice(-10);
  const currentPrice = smallTimeframeData[smallTimeframeData.length - 1].close;

  // 计算建议的入场价和止损价
  const entryPrice = currentPrice;
  let stopLoss: number;

  // 寻找小周期的最近支撑位或阻力位作为止损
  if (largerTrendDirection > 0) {
    // 做多
    // 找最近的低点作为止损
    const recentLow = Math.min(...recentCandles.map(c => c.low));
    stopLoss = recentLow * 0.99; // 低点下方1%
  } else {
    // 做空
    // 找最近的高点作为止损
    const recentHigh = Math.max(...recentCandles.map(c => c.high));
    stopLoss = recentHigh * 1.01; // 高点上方1%
  }

  // 计算逆转强度 (0-100)
  let reversalStrength = 0;

  if (wasCounterTrend && isNowAligned) {
    // 检查逆转的强度，使用以下指标：
    // 1. 最近K线的价格变化幅度
    const priceChangePercent =
      Math.abs(
        (recentCandles[recentCandles.length - 1].close -
          recentCandles[0].close) /
          recentCandles[0].close
      ) * 100;

    // 2. 成交量变化
    const recentVolumes = recentCandles.slice(0, 5).map(c => c.volume);
    const avgRecentVolume =
      recentVolumes.length > 0
        ? recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length
        : 0;

    const currentVolume = recentCandles[recentCandles.length - 1].volume;
    let volumeIncreasePercent = 0;
    if (currentVolume !== 0) {
      volumeIncreasePercent =
        avgRecentVolume > 0 ? (currentVolume / avgRecentVolume) * 100 - 100 : 0;
    }

    // 3. 与大周期趋势的一致性
    const trendAlignmentScore =
      currentSmallTrend === largerTrendDirection ? 30 : 0;

    // 4. 计算趋势强度 - 基于趋势的斜率
    let trendStrengthScore = 0;
    if (recentData.length >= 5) {
      const firstPrice = recentData[0].close;
      const lastPrice = recentData[recentData.length - 1].close;
      const priceChange = Math.abs((lastPrice - firstPrice) / firstPrice) * 100;
      trendStrengthScore = Math.min(15, priceChange);
    }

    // 组合计算强度分数
    reversalStrength = Math.min(
      100,
      Math.max(
        0,
        Math.min(35, priceChangePercent * 7) +
          Math.min(25, volumeIncreasePercent * 0.5) +
          trendAlignmentScore +
          trendStrengthScore
      )
    );

    // 计算目标价位
    const targets = calculateMeasuredMoveTargets(
      smallTimeframeData,
      windowSize,
      largerTrendDirection,
      entryPrice,
      stopLoss
    );

    return {
      isReversal: true,
      direction: largerTrendDirection,
      reversalStrength,
      smallTimeframe,
      largeTimeframe,
      entryPrice,
      stopLoss,
      targets,
    };
  }

  return {
    isReversal: false,
    direction: largerTrendDirection,
    reversalStrength: 0,
    smallTimeframe,
    largeTimeframe,
  };
}

/**
 * 增强版多时间周期价格形态分析，仅包含小时对日线的顺势逆转检测
 * 适用于波段交易，专注于中短期价格变动
 */
async function multiTimeframePatternAnalysis(
  weeklyData: Candle[],
  dailyData: Candle[],
  hourlyData: Candle[]
): Promise<EnhancedPatternAnalysis> {
  // 获取基础的价格形态分析
  const baseAnalysis = await analyzeMultiTimeframePatterns(
    weeklyData,
    dailyData,
    hourlyData
  );

  // 只检查小时对比日线的逆转 (移除了日线对周线的检测)
  const hourlyVsDailyReversal = detectTrendReversal(
    hourlyData,
    dailyData,
    '1hour',
    'daily'
  );

  // 收集逆转信号 (现在只有小时对日线一种可能)
  const reversalSignals = [hourlyVsDailyReversal].filter(
    signal => signal.isReversal
  );

  // 设置主要逆转信号
  let primaryReversalSignal: TrendReversalSignal | undefined;

  if (reversalSignals.length > 0) {
    primaryReversalSignal = reversalSignals[0];

    // 修改原有分析的描述和信号强度
    const directionText = primaryReversalSignal.direction > 0 ? '做多' : '做空';
    baseAnalysis.description = `${baseAnalysis.description} 检测到小时周期趋势逆转并顺从日线周期趋势，提供${directionText}交易机会，逆转强度: ${primaryReversalSignal.reversalStrength.toFixed(1)}/100。`;

    // 如果逆转信号较强，增强整体信号强度
    if (primaryReversalSignal.reversalStrength > 50) {
      baseAnalysis.signalStrength = Math.min(
        100,
        baseAnalysis.signalStrength + 10
      );
    }
  }

  return {
    ...baseAnalysis,
    reversalSignals,
    primaryReversalSignal,
  };
}

/**
 * 多时间周期分析示例 - 增强版（含小周期顺势逆转检测）
 */

export {
  determineTrendDirection,
  detectTrendReversal,
  TrendReversalSignal,
  EnhancedPatternAnalysis,
  multiTimeframePatternAnalysis,
};
