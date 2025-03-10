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
