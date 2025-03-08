import { bearish, bullish } from 'technicalindicators';
import { Candle } from '../types.js';
import { MarketQuery } from '../finance/MarketQuery.js';

interface PatternResult {
  date: Date;
  patternType: 'bullish' | 'bearish';
  priceLevel: number;
  strength: number; // 0-100 的强度值
}

/**
 * 检测K线形态
 * @param candles K线数据
 * @param patternCheckingWindow 形态检测窗口大小
 * @returns 看涨和看跌形态的结果
 */
export const detectBullOrBear = (
  candles: Candle[],
  patternCheckingWindow: number = 5
): {
  bullishPatterns: PatternResult[];
  bearishPatterns: PatternResult[];
} => {
  const bullishPatterns: PatternResult[] = [];
  const bearishPatterns: PatternResult[] = [];

  for (let i = patternCheckingWindow; i < candles.length; i++) {
    const currentWindowSize = Math.min(
      patternCheckingWindow,
      candles.length - i
    );

    // i+1 为了包含当前K线
    const windowCandles = candles.slice(i - currentWindowSize, i + 1);

    const patternData = {
      open: windowCandles.map(candle => candle.open),
      high: windowCandles.map(candle => candle.high),
      low: windowCandles.map(candle => candle.low),
      close: windowCandles.map(candle => candle.close),
      timestamp: windowCandles.map(candle => candle.timestamp),
    };

    // 获取最新K线的信息
    const currentCandle = windowCandles[windowCandles.length - 1];
    const currentDate = currentCandle.timestamp;
    const currentClose = currentCandle.close;

    // 检查看涨形态
    const hasBullishPattern = bullish(patternData) as boolean;
    if (hasBullishPattern) {
      // 计算形态强度
      const patternStrength = calculatePatternStrength(
        windowCandles,
        'bullish'
      );

      bullishPatterns.push({
        date: currentDate,
        patternType: 'bullish',
        priceLevel: currentClose,
        strength: patternStrength,
      });
    }

    // 检查看跌形态
    const hasBearishPattern = bearish(patternData) as boolean;
    if (hasBearishPattern) {
      // 计算形态强度
      const patternStrength = calculatePatternStrength(
        windowCandles,
        'bearish'
      );

      bearishPatterns.push({
        date: currentDate,
        patternType: 'bearish',
        priceLevel: currentClose,
        strength: patternStrength,
      });
    }
  }

  return {
    bullishPatterns,
    bearishPatterns,
  };
};

/**
 * 计算K线形态的强度
 * @param candles K线数组
 * @param patternType 形态类型
 * @returns 强度值 (0-100)
 */
function calculatePatternStrength(
  candles: Candle[],
  patternType: 'bullish' | 'bearish'
): number {
  const lastCandle = candles[candles.length - 1];
  const lastBody = Math.abs(lastCandle.close - lastCandle.open);
  const lastRange = lastCandle.high - lastCandle.low;

  // 基础强度
  let strength = 50;

  // 考虑实体大小相对于波动范围 (实体越大，信号越强)
  const bodyToRangeRatio = lastBody / lastRange;
  if (bodyToRangeRatio > 0.7) {
    strength += 20;
  } else if (bodyToRangeRatio > 0.5) {
    strength += 10;
  }

  // 考虑成交量因素 (成交量越大，信号越强)
  const volumes = candles.map(c => c.volume);
  const avgVolume =
    volumes.slice(0, volumes.length - 1).reduce((a, b) => a + b, 0) /
    (volumes.length - 1);
  const lastVolume = lastCandle.volume;

  if (lastVolume > avgVolume * 2) {
    strength += 30;
  } else if (lastVolume > avgVolume * 1.5) {
    strength += 20;
  } else if (lastVolume > avgVolume) {
    strength += 10;
  }

  // 看涨形态:价格收于上方，看跌形态:价格收于下方
  if (patternType === 'bullish' && lastCandle.close > lastCandle.open) {
    strength += 10;
  } else if (patternType === 'bearish' && lastCandle.close < lastCandle.open) {
    strength += 10;
  }

  // 确保强度在 0-100 范围内
  return Math.min(100, Math.max(0, strength));
}

/**
 * 检查最近几天是否出现看涨或看跌形态
 * @param candles K线数据
 * @param daysBefore 检查多少天以内
 * @param minStrength 最小强度要求 (0-100)
 * @returns 过滤后的结果
 */
export const checkBullOrBearRecently = (
  candles: Candle[],
  daysBefore: number = 5,
  minStrength: number = 60
) => {
  if (candles.length === 0) {
    return {
      bullishDatesWithinLast5Days: [],
      bearishDatesWithinLast5Days: [],
      bullishPatternsDetails: [],
      bearishPatternsDetails: [],
    };
  }

  const { bullishPatterns, bearishPatterns } = detectBullOrBear(candles);

  // 计算日期范围
  const today = new Date();
  const cutoffDate = new Date();
  cutoffDate.setDate(today.getDate() - daysBefore);

  // 筛选出符合条件的模式
  const recentBullishPatterns = bullishPatterns.filter(
    pattern =>
      pattern.date >= cutoffDate &&
      pattern.date <= today &&
      pattern.strength >= minStrength
  );

  const recentBearishPatterns = bearishPatterns.filter(
    pattern =>
      pattern.date >= cutoffDate &&
      pattern.date <= today &&
      pattern.strength >= minStrength
  );

  // 为了与原有接口兼容
  return {
    bullishDatesWithinLast5Days: recentBullishPatterns.map(p => p.date),
    bearishDatesWithinLast5Days: recentBearishPatterns.map(p => p.date),
    // 添加详细信息供策略分析使用
    bullishPatternsDetails: recentBullishPatterns,
    bearishPatternsDetails: recentBearishPatterns,
  };
};

/**
 * 多时间周期确认
 * @param symbol 股票代码
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @returns 多周期确认结果
 */
export const multiTimeframeConfirmation = async (
  symbol: string,
  startDate: Date,
  endDate: Date
) => {
  const marketQuery = new MarketQuery();

  // 获取不同时间周期的数据
  const dailyCandles = await marketQuery.getHistoricalData(
    symbol,
    startDate,
    endDate,
    '1d'
  );
  const hourlyCandles = await marketQuery.getHistoricalData(
    symbol,
    startDate,
    endDate,
    '1h'
  );

  // 检测形态
  const dailyResult = checkBullOrBearRecently(dailyCandles, 5, 60);
  const hourlyResult = checkBullOrBearRecently(hourlyCandles, 2, 60);

  // 检查两个时间周期是否有相同方向的信号
  const hasBullishConfirmation =
    dailyResult.bullishDatesWithinLast5Days.length > 0 &&
    hourlyResult.bullishDatesWithinLast5Days.length > 0;

  const hasBearishConfirmation =
    dailyResult.bearishDatesWithinLast5Days.length > 0 &&
    hourlyResult.bearishDatesWithinLast5Days.length > 0;

  return {
    hasBullishConfirmation,
    hasBearishConfirmation,
    dailyBullishSignals: dailyResult.bullishDatesWithinLast5Days,
    dailyBearishSignals: dailyResult.bearishDatesWithinLast5Days,
    hourlyBullishSignals: hourlyResult.bullishDatesWithinLast5Days,
    hourlyBearishSignals: hourlyResult.bearishDatesWithinLast5Days,
    dailyResult,
    hourlyResult,
  };
};
