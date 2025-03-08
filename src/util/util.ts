import yahooFinance from 'yahoo-finance2';
import { Candle } from '../types.js';

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export interface NamedPromise<T> {
  promise: Promise<T>;
  name: string;
}

/**
 * 检查价格是否在某个水平附近
 * @param price 当前价格
 * @param level 价格水平
 * @param threshold 阈值（百分比）
 * @returns 是否在水平附近
 */
export function isNearLevel(
  price: number,
  level: number,
  threshold: number
): boolean {
  const diff = Math.abs(price - level) / level;
  return diff <= threshold;
}

export const promiseWithTimeout = async <T>(
  namedPromise: NamedPromise<T>,
  timeout: number,
  errorMsg: string
): Promise<T> => {
  let timeoutId: NodeJS.Timeout | undefined = undefined;
  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${namedPromise.name} ${errorMsg}`));
      }, timeout);
    });

    return await Promise.race([
      namedPromise.promise.then(r => {
        return r;
      }),
      timeoutPromise,
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
};

export function calculateRSI(prices: number[], period: number): number[] {
  const rsi: number[] = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;

  rsi.push(100 - 100 / (1 + averageGain / averageLoss));

  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      averageGain = (averageGain * (period - 1) + change) / period;
      averageLoss = (averageLoss * (period - 1)) / period;
    } else {
      averageGain = (averageGain * (period - 1)) / period;
      averageLoss = (averageLoss * (period - 1) - change) / period;
    }

    rsi.push(100 - 100 / (1 + averageGain / averageLoss));
  }

  return rsi;
}

export function rollingMin(prices: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    const start = Math.max(0, i - window + 1);
    const end = i + 1;
    const windowSlice = prices.slice(start, end);
    result.push(Math.min(...windowSlice));
  }
  return result;
}

export function rollingMax(prices: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    const start = Math.max(0, i - window + 1);
    const end = i + 1;
    const windowSlice = prices.slice(start, end);
    result.push(Math.max(...windowSlice));
  }
  return result;
}

export function standardDeviation(values: number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
  const avgSquaredDiff =
    squaredDiffs.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

export function percentChange(prices: number[]): number[] {
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const change = ((prices[i] - prices[i - 1]) / prices[i - 1]) * 100;
    changes.push(change);
  }
  return changes;
}

export function calculateSlope(prices: number[]): number {
  const n = prices.length;
  const x = Array.from({ length: n }, (_, i) => i + 1);
  const y = prices;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

// same as MarketQuery.getHistoricalData
export async function getStockData(
  symbol: string,
  startDate: Date,
  endDate: Date,
  interval = '1d'
): Promise<Candle[]> {
  const queryOptions = {
    period1: startDate,
    period2: endDate,
    interval,
  } as any;

  try {
    const result = (await yahooFinance.chart(symbol, queryOptions)) as any;
    const candles: Candle[] = [];

    if (result && result.quotes && result.quotes.length > 0) {
      result.quotes.forEach(quote => {
        if (quote.date && quote.close && quote.volume !== undefined) {
          candles.push({
            symbol,
            open: quote.open || quote.close,
            high: quote.high || quote.close,
            low: quote.low || quote.close,
            close: quote.close,
            volume: quote.volume,
            timestamp: new Date(quote.date),
          });
        }
      });
    }

    return candles;
  } catch (error) {
    console.error('获取股票数据时出错:', error);
    return [];
  }
}

export async function getStockDataForTimeframe(
  symbol: string,
  startDate: Date,
  endDate: Date,
  timeframe: 'weekly' | 'daily' | '1hour'
): Promise<Candle[]> {
  // 实际应用中，应该直接从数据提供商获取对应时间周期的数据
  // 这里为了简化，我们从日线数据模拟其他时间周期

  // 首先获取原始日线数据
  const rawData = await getStockData(symbol, startDate, endDate);

  if (timeframe === 'daily') {
    return await getStockData(symbol, startDate, endDate); // 直接返回日线数据
  } else if (timeframe === 'weekly') {
    // 将日线数据聚合为周线
    return await getStockData(symbol, startDate, endDate, '1wk');
  } else if (timeframe === '1hour') {
    // 注意：实际应用中应该直接获取真实的日内数据
    // 过滤掉夜盘影响，成交量为0的数据
    return (await getStockData(symbol, startDate, endDate, '1h')).filter(
      c => c.volume !== 0
    );
  }

  // 默认返回日线数据
  return rawData;
}
