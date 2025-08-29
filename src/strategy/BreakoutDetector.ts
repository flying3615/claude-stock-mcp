import { EMA } from 'technicalindicators';
import {
  BreakSignal,
  Candle,
  Strategy,
  SupportResistanceResult,
} from '../types.js';
import { getStockData } from '../util/util.js';

export class BreakoutDetector
  implements Strategy<Promise<SupportResistanceResult>>
{
  private readonly config: {
    leftBars: number;
    rightBars: number;
    volumeThreshold: number;
    toggleBreaks: boolean;
  };

  constructor() {
    this.config = {
      leftBars: 10,
      rightBars: 10,
      volumeThreshold: 20,
      toggleBreaks: true,
    };
  }
  // 使用 fixnan 逻辑的 findPivotPoints 函数
  findPivotPoints(
    data: Candle[],
    leftBars: number,
    rightBars: number
  ): {
    highPivots: (number | null)[];
    lowPivots: (number | null)[];
  } {
    const highPivots: (number | null)[] = Array(data.length).fill(null);
    const lowPivots: (number | null)[] = Array(data.length).fill(null);

    // 首先计算实际的枢轴点
    for (let i = leftBars; i < data.length - rightBars; i++) {
      // 检查高点
      let isHighPivot = true;
      for (let j = i - leftBars; j < i; j++) {
        if (data[j].high >= data[i].high) {
          isHighPivot = false;
          break;
        }
      }

      if (isHighPivot) {
        for (let j = i + 1; j <= i + rightBars; j++) {
          if (data[j].high >= data[i].high) {
            isHighPivot = false;
            break;
          }
        }
      }

      if (isHighPivot) {
        highPivots[i] = data[i].high;
      }

      // 检查低点
      let isLowPivot = true;
      for (let j = i - leftBars; j < i; j++) {
        if (data[j].low <= data[i].low) {
          isLowPivot = false;
          break;
        }
      }

      if (isLowPivot) {
        for (let j = i + 1; j <= i + rightBars; j++) {
          if (data[j].low <= data[i].low) {
            isLowPivot = false;
            break;
          }
        }
      }

      if (isLowPivot) {
        lowPivots[i] = data[i].low;
      }
    }

    // 然后实现类似 fixnan 的逻辑，填充值
    let lastValidHigh = null;
    let lastValidLow = null;

    for (let i = 0; i < data.length; i++) {
      if (highPivots[i] !== null) {
        lastValidHigh = highPivots[i];
      } else if (lastValidHigh !== null) {
        highPivots[i] = lastValidHigh;
      }

      if (lowPivots[i] !== null) {
        lastValidLow = lowPivots[i];
      } else if (lastValidLow !== null) {
        lowPivots[i] = lastValidLow;
      }
    }

    return { highPivots, lowPivots };
  }

  // 主函数来检测支撑和阻力
  detectSupportResistance(
    symbol: string,
    data: Candle[],
    config: {
      leftBars: number;
      rightBars: number;
      volumeThreshold: number;
      toggleBreaks: boolean;
    }
  ): SupportResistanceResult {
    if (data.length < config.leftBars + config.rightBars + 1) {
      console.warn('数据不足以计算支撑阻力位');
      return {
        symbol,
        supportLevels: [],
        resistanceLevels: [],
        dynamicSupport: null,
        dynamicResistance: null,
        breakSignals: [],
      };
    }

    const { leftBars, rightBars, volumeThreshold, toggleBreaks } = config;

    // 1. 使用修复后的函数计算枢轴点
    const { highPivots, lowPivots } = this.findPivotPoints(
      data,
      leftBars,
      rightBars
    );

    // 2. 计算成交量震荡指标
    const volumes = data.map(candle => candle.volume);
    const shortEMA = EMA.calculate({ period: 5, values: volumes });
    const longEMA = EMA.calculate({ period: 10, values: volumes });

    // 计算需要填充的长度
    const shortPadding = volumes.length - shortEMA.length;
    const longPadding = volumes.length - longEMA.length;

    // 用最后一个有效值填充
    const paddedShortEMA = [
      ...shortEMA,
      ...Array(shortPadding).fill(shortEMA[shortEMA.length - 1]),
    ];
    const paddedLongEMA = [
      ...longEMA,
      ...Array(longPadding).fill(longEMA[longEMA.length - 1]),
    ];

    const volumeOsc = volumes.map((_, i) => {
      const long = paddedLongEMA[i];
      const short = paddedShortEMA[i];
      return long > 0 ? (100 * (short - long)) / long : 0;
    });

    // 3. 查找突破信号
    const breakSignals: BreakSignal[] = [];

    if (toggleBreaks) {
      // 从第二个蜡烛开始检查突破
      for (let i = 1; i < data.length; i++) {
        const current = data[i];
        const prev = data[i - 1];
        const currHighPivot = highPivots[i - 1];
        const currLowPivot = lowPivots[i - 1];

        if (currHighPivot !== null && currLowPivot !== null) {
          // 检查支撑突破
          if (
            prev.close >= currLowPivot &&
            current.close < currLowPivot &&
            volumeOsc[i] > volumeThreshold
          ) {
            // 检查是否为熊形针线形态
            const isBearWick =
              current.open - current.close < current.high - current.open;

            breakSignals.push({
              time: current.timestamp,
              type: isBearWick ? 'bear_wick' : 'support_break',
              price: parseFloat(current.close.toFixed(2)),
              strength: parseFloat(Math.min(100, volumeOsc[i]).toFixed(2)),
              breakPriceLevel: parseFloat(currLowPivot.toFixed(2)),
            });
          }

          // 检查阻力突破
          if (
            prev.close <= currHighPivot &&
            current.close > currHighPivot &&
            volumeOsc[i] > volumeThreshold
          ) {
            // 检查是否为牛形针线形态
            const isBullWick =
              current.open - current.low > current.close - current.open;

            breakSignals.push({
              time: current.timestamp,
              type: isBullWick ? 'bull_wick' : 'resistance_break',
              price: parseFloat(current.close.toFixed(2)),
              strength: parseFloat(Math.min(100, volumeOsc[i]).toFixed(2)),
              breakPriceLevel: parseFloat(currHighPivot.toFixed(2)),
            });
          }
        }
      }
    }

    // 4. 过滤出唯一的支撑和阻力水平
    const highSet = new Set<number>();
    const lowSet = new Set<number>();

    highPivots.forEach(p => {
      if (p !== null) highSet.add(p);
    });

    lowPivots.forEach(p => {
      if (p !== null) lowSet.add(p);
    });

    const resistanceLevels = Array.from(highSet).sort((a, b) => a - b);
    const supportLevels = Array.from(lowSet).sort((a, b) => a - b);

    // 5. 获取当前价格附近的支撑和阻力
    const currentPrice = data[data.length - 1].close;

    let dynamicSupport = null;
    let dynamicResistance = null;

    // 找到低于当前价格的最高支撑位
    for (let i = supportLevels.length - 1; i >= 0; i--) {
      if (supportLevels[i] < currentPrice) {
        dynamicSupport = supportLevels[i];
        break;
      }
    }

    // 找到高于当前价格的最低阻力位
    for (let i = 0; i < resistanceLevels.length; i++) {
      if (resistanceLevels[i] > currentPrice) {
        dynamicResistance = resistanceLevels[i];
        break;
      }
    }

    return {
      symbol,
      supportLevels,
      resistanceLevels,
      dynamicSupport,
      dynamicResistance,
      breakSignals,
    };
  }

  async run(symbol: string): Promise<SupportResistanceResult> {
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 200); // 获取更多数据用于计算

    const candles = await getStockData(symbol, startDate, today);

    if (candles.length === 0) {
      console.error('没有获取到数据，无法分析');
      return {
        symbol,
        supportLevels: [],
        resistanceLevels: [],
        dynamicSupport: null,
        dynamicResistance: null,
        breakSignals: [],
      };
    }

    return this.detectSupportResistance(symbol, candles, this.config);
  }
}

// const breakoutDetector = new BreakoutDetector();
// const result = await breakoutDetector.run('PONY');
//
// console.log('result:', result);
