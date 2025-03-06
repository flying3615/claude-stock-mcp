import { Candle } from '../../types.js';
import {
  detectPeaksAndValleys,
  findCupAndHandle,
  findDoubleTopsAndBottoms,
  findFlagsAndPennants,
  findHeadAndShoulders,
  findRoundingPatterns,
  findTriangles,
  findWedges,
} from './findPatterns.js';

/**
 * 价格形态类型枚举
 */
enum PatternType {
  HeadAndShoulders = 'head_and_shoulders',
  InverseHeadAndShoulders = 'inverse_head_and_shoulders',
  DoubleTop = 'double_top',
  DoubleBottom = 'double_bottom',
  TripleTop = 'triple_top',
  TripleBottom = 'triple_bottom',
  AscendingTriangle = 'ascending_triangle',
  DescendingTriangle = 'descending_triangle',
  SymmetricalTriangle = 'symmetrical_triangle',
  RisingWedge = 'rising_wedge',
  FallingWedge = 'falling_wedge',
  Rectangle = 'rectangle',
  Flag = 'flag',
  Pennant = 'pennant',
  CupAndHandle = 'cup_and_handle',
  RoundingBottom = 'rounding_bottom',
  RoundingTop = 'rounding_top',
}

/**
 * 形态识别状态枚举
 */
enum PatternStatus {
  Forming = 'forming', // 正在形成
  Completed = 'completed', // 已完成但未确认突破
  Confirmed = 'confirmed', // 已确认突破
  Failed = 'failed', // 形成后失败
}

/**
 * 形态趋势方向枚举
 */
enum PatternDirection {
  Bullish = 'bullish', // 看多形态
  Bearish = 'bearish', // 看空形态
  Neutral = 'neutral', // 中性形态
}

/**
 * 峰谷点类型
 */
interface PeakValley {
  index: number; // 在K线数组中的索引
  price: number; // 价格（高点或低点）
  date: Date; // 日期
  type: 'peak' | 'valley'; // 峰或谷
}

/**
 * 形态组成部分
 */
interface PatternComponent {
  startIndex: number; // 形态开始点在K线数组中的索引
  endIndex: number; // 形态结束点在K线数组中的索引
  keyPoints: PeakValley[]; // 形态的关键点
  patternHeight: number; // 形态高度（最高点与最低点的价差）
  breakoutLevel: number; // 突破价位（颈线）
  volumePattern: string; // 成交量特征
}

/**
 * 价格形态分析结果
 */
interface PatternAnalysisResult {
  patternType: PatternType; // 形态类型
  status: PatternStatus; // 形态状态
  direction: PatternDirection; // 形态方向
  reliability: number; // 可靠性评分(0-100)
  significance: number; // 重要性评分(0-100)

  component: PatternComponent; // 形态组成部分

  priceTarget?: number; // 价格目标（如果形态已确认）
  stopLoss?: number; // 建议止损位

  breakoutExpected?: boolean; // 是否预期将发生突破
  breakoutDirection?: PatternDirection; // 预期突破方向
  probableBreakoutZone?: [number, number]; // 可能的突破区域

  description: string; // 形态描述
  tradingImplication: string; // 交易含义
}

/**
 * 多时间周期形态分析结果
 */
interface MultiTimeframePatternAnalysis {
  timeframe: 'weekly' | 'daily' | '1hour';
  patterns: PatternAnalysisResult[];
  dominantPattern?: PatternAnalysisResult; // 主导形态
  patternSignal: PatternDirection; // 形态综合信号
}

/**
 * 完整的价格形态分析结果，包含所有时间周期
 */
interface ComprehensivePatternAnalysis {
  timeframeAnalyses: MultiTimeframePatternAnalysis[];
  combinedSignal: PatternDirection; // 综合信号
  signalStrength: number; // 信号强度(0-100)
  description: string; // 总体形态分析描述
}

/**
 * 主函数：分析所有形态，增强最近形态的重要性
 * @param rawData K线数据
 * @param timeframe 时间周期
 */
async function analyzeAllPatterns(
  rawData: Candle[],
  timeframe: 'weekly' | 'daily' | '1hour'
): Promise<MultiTimeframePatternAnalysis> {
  // 仅保留最近100根K线
  const data = rawData.slice(-100);

  // 检测所有峰谷点
  const peaksValleys = detectPeaksAndValleys(data);

  // 分析所有形态
  const headAndShoulders = findHeadAndShoulders(data, peaksValleys);
  const doubleTopsBottoms = findDoubleTopsAndBottoms(data, peaksValleys);
  const triangles = findTriangles(data, peaksValleys);
  const wedges = findWedges(data, peaksValleys);
  const flagsPennants = findFlagsAndPennants(data, peaksValleys);
  const cupHandle = findCupAndHandle(data, peaksValleys);
  const roundingPatterns = findRoundingPatterns(data, peaksValleys);

  // 合并所有形态
  const allPatterns = [
    ...headAndShoulders,
    ...doubleTopsBottoms,
    ...triangles,
    ...wedges,
    ...flagsPennants,
    ...cupHandle,
    ...roundingPatterns,
  ];

  // 计算当前最后一根K线的索引
  const lastIndex = data.length - 1;

  // 修改每个形态的重要性，根据形态结束点与最后一根K线的距离加权
  allPatterns.forEach(pattern => {
    // 计算形态结束点与当前点的距离
    const distanceFromCurrent = lastIndex - pattern.component.endIndex;

    // 计算距离因子：距离越近，因子越大
    // 使用指数衰减函数，可以根据需要调整衰减速率
    const distanceFactor = Math.exp(-0.05 * distanceFromCurrent);

    // 更新形态的重要性，与距离因子成正比
    pattern.significance = pattern.significance * distanceFactor;

    // 为已确认突破的形态额外加分
    if (pattern.status === PatternStatus.Confirmed) {
      pattern.significance *= 1.5;
    }

    // 对正在形成中但接近完成的形态增加一定权重
    if (
      pattern.status === PatternStatus.Forming &&
      pattern.breakoutExpected &&
      distanceFromCurrent < 5
    ) {
      pattern.significance *= 1.3;
    }
  });

  // 按照调整后的可靠性和重要性排序
  allPatterns.sort(
    (a, b) => b.reliability * b.significance - a.reliability * a.significance
  );

  // 确定主导形态
  const dominantPattern = allPatterns.length > 0 ? allPatterns[0] : undefined;

  // 确定形态综合信号，更偏重于最近的形态
  let patternSignal = PatternDirection.Neutral;
  let bullishScore = 0;
  let bearishScore = 0;

  // 仅考虑最近的N个形态来确定信号方向
  const recentPatternCount = Math.min(10, allPatterns.length);
  const recentPatterns = allPatterns.slice(0, recentPatternCount);

  for (const pattern of recentPatterns) {
    const patternWeight = pattern.reliability * pattern.significance;

    if (pattern.direction === PatternDirection.Bullish) {
      bullishScore += patternWeight;
    } else if (pattern.direction === PatternDirection.Bearish) {
      bearishScore += patternWeight;
    }
  }

  if (bullishScore > bearishScore * 1.5) {
    patternSignal = PatternDirection.Bullish;
  } else if (bearishScore > bullishScore * 1.5) {
    patternSignal = PatternDirection.Bearish;
  } else if (bullishScore > bearishScore) {
    patternSignal = PatternDirection.Bullish;
  } else if (bearishScore > bullishScore) {
    patternSignal = PatternDirection.Bearish;
  }

  // 返回分析结果
  return {
    timeframe,
    patterns: allPatterns,
    dominantPattern,
    patternSignal,
  };
}

/**
 * 综合多时间周期的形态分析，更注重最近形态
 * @param timeframeAnalyses 各时间周期的形态分析结果
 */
function combinePatternAnalyses(
  timeframeAnalyses: MultiTimeframePatternAnalysis[]
): ComprehensivePatternAnalysis {
  // 计算综合信号
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;

  // 对不同时间周期的信号进行加权，短期时间周期权重更高
  const timeframeWeights = {
    weekly: 1.0,
    daily: 1.5,
    '1hour': 2.0,
  };

  for (const analysis of timeframeAnalyses) {
    const weight = timeframeWeights[analysis.timeframe] || 1.0;

    if (analysis.patternSignal === PatternDirection.Bullish) {
      bullishCount += weight;
    } else if (analysis.patternSignal === PatternDirection.Bearish) {
      bearishCount += weight;
    } else {
      neutralCount += weight;
    }
  }

  let combinedSignal = PatternDirection.Neutral;

  if (bullishCount > bearishCount * 1.2) {
    combinedSignal = PatternDirection.Bullish;
  } else if (bearishCount > bullishCount * 1.2) {
    combinedSignal = PatternDirection.Bearish;
  } else if (bullishCount > bearishCount) {
    combinedSignal = PatternDirection.Bullish;
  } else if (bearishCount > bullishCount) {
    combinedSignal = PatternDirection.Bearish;
  }

  // 计算信号强度
  let signalStrength = 50; // 中性起点
  const totalWeight = Object.values(timeframeWeights).reduce(
    (sum, weight) => sum + weight,
    0
  );

  if (combinedSignal === PatternDirection.Bullish) {
    signalStrength += 20 * (bullishCount / totalWeight);
    signalStrength +=
      15 *
      (bullishCount > totalWeight / 2 ? 1 : bullishCount / (totalWeight / 2)); // 多个时间周期一致加分

    // 检查短期时间周期
    const hourlyAnalysis = timeframeAnalyses.find(a => a.timeframe === '1hour');
    if (
      hourlyAnalysis &&
      hourlyAnalysis.patternSignal === PatternDirection.Bullish
    ) {
      signalStrength += 10; // 短期看涨加分
    }

    // 检查日线
    const dailyAnalysis = timeframeAnalyses.find(a => a.timeframe === 'daily');
    if (
      dailyAnalysis &&
      dailyAnalysis.patternSignal === PatternDirection.Bullish
    ) {
      signalStrength += 15; // 日线看涨加分
    }
  } else if (combinedSignal === PatternDirection.Bearish) {
    signalStrength += 20 * (bearishCount / totalWeight);
    signalStrength +=
      15 *
      (bearishCount > totalWeight / 2 ? 1 : bearishCount / (totalWeight / 2)); // 多个时间周期一致加分

    // 检查短期时间周期
    const hourlyAnalysis = timeframeAnalyses.find(a => a.timeframe === '1hour');
    if (
      hourlyAnalysis &&
      hourlyAnalysis.patternSignal === PatternDirection.Bearish
    ) {
      signalStrength += 10; // 短期看跌加分
    }

    // 检查日线
    const dailyAnalysis = timeframeAnalyses.find(a => a.timeframe === 'daily');
    if (
      dailyAnalysis &&
      dailyAnalysis.patternSignal === PatternDirection.Bearish
    ) {
      signalStrength += 15; // 日线看跌加分
    }
  }

  // 检查主导形态的可靠性和最近程度
  for (const analysis of timeframeAnalyses) {
    if (analysis.dominantPattern) {
      const pattern = analysis.dominantPattern;
      if (pattern.reliability > 70) {
        signalStrength += 10;
      }

      // 根据形态的最近程度额外加分
      // 获取该时间周期数据的长度（通过分析主导形态的位置估算）
      if (pattern.component) {
        // 计算形态结束位置与当前位置的距离
        const patternEndIndex = pattern.component.endIndex;
        const estimatedDataLength =
          patternEndIndex + (patternEndIndex - pattern.component.startIndex); // 估计数据长度

        // 计算接近程度比率 - 越接近1表示越近期
        const recencyRatio = patternEndIndex / estimatedDataLength;

        if (recencyRatio > 0.8) {
          // 非常近期的形态
          signalStrength += 10;
        } else if (recencyRatio > 0.6) {
          // 较近期的形态
          signalStrength += 5;
        }
      }
    }
  }

  // 确保信号强度在0-100范围内
  signalStrength = Math.max(0, Math.min(100, signalStrength));

  // 生成总体描述
  let description = '';

  if (combinedSignal === PatternDirection.Bullish) {
    description = `综合形态分析显示看涨信号`;
  } else if (combinedSignal === PatternDirection.Bearish) {
    description = `综合形态分析显示看跌信号`;
  } else {
    description = `综合形态分析显示中性信号`;
  }

  description += `，信号强度: ${signalStrength.toFixed(2)}/100。`;

  // 添加短期和长期一致性描述
  const hourlySignal = timeframeAnalyses.find(
    a => a.timeframe === '1hour'
  )?.patternSignal;
  const dailySignal = timeframeAnalyses.find(
    a => a.timeframe === 'daily'
  )?.patternSignal;
  const weeklySignal = timeframeAnalyses.find(
    a => a.timeframe === 'weekly'
  )?.patternSignal;

  if (
    hourlySignal === dailySignal &&
    hourlySignal === weeklySignal &&
    hourlySignal !== PatternDirection.Neutral
  ) {
    description += ` 短期和长期形态分析一致${hourlySignal === PatternDirection.Bullish ? '看涨' : '看跌'}，信号非常可靠。`;
  } else if (
    hourlySignal === dailySignal &&
    hourlySignal !== PatternDirection.Neutral
  ) {
    description += ` 短期和中期形态分析一致${hourlySignal === PatternDirection.Bullish ? '看涨' : '看跌'}，信号较为可靠。`;
  } else if (
    dailySignal === weeklySignal &&
    dailySignal !== PatternDirection.Neutral
  ) {
    description += ` 中期和长期形态分析一致${dailySignal === PatternDirection.Bullish ? '看涨' : '看跌'}，但短期可能有波动。`;
  } else if (hourlySignal !== PatternDirection.Neutral) {
    description += ` 短期形态分析显示${hourlySignal === PatternDirection.Bullish ? '看涨' : '看跌'}，建议关注短线机会。`;
  }

  // 添加主导形态描述，优先展示短期和日线周期的主导形态
  const hourlyDominant = timeframeAnalyses.find(
    a => a.timeframe === '1hour'
  )?.dominantPattern;
  const dailyDominant = timeframeAnalyses.find(
    a => a.timeframe === 'daily'
  )?.dominantPattern;

  if (hourlyDominant) {
    description += ` 小时线主导形态: ${hourlyDominant.patternType} (${hourlyDominant.direction === PatternDirection.Bullish ? '看涨' : '看跌'})，可靠性: ${hourlyDominant.reliability.toFixed(2)}/100。`;
  }

  if (dailyDominant) {
    description += ` 日线主导形态: ${dailyDominant.patternType} (${dailyDominant.direction === PatternDirection.Bullish ? '看涨' : '看跌'})，可靠性: ${dailyDominant.reliability.toFixed(2)}/100。`;
  }

  return {
    timeframeAnalyses,
    combinedSignal,
    signalStrength,
    description,
  };
}

/**
 * 导出的API函数：多时间周期的价格形态分析
 */
async function analyzeMultiTimeframePatterns(
  weeklyData: Candle[],
  dailyData: Candle[],
  hourlyData: Candle[]
): Promise<ComprehensivePatternAnalysis> {
  // 分析各个时间周期的形态
  const weeklyAnalysis = await analyzeAllPatterns(weeklyData, 'weekly');
  const dailyAnalysis = await analyzeAllPatterns(dailyData, 'daily');
  const hourlyAnalysis = await analyzeAllPatterns(hourlyData, '1hour');

  // 综合分析
  return combinePatternAnalyses([
    weeklyAnalysis,
    dailyAnalysis,
    hourlyAnalysis,
  ]);
}

export {
  // 类型和接口
  PatternType,
  PatternStatus,
  PatternDirection,
  PeakValley,
  PatternComponent,
  PatternAnalysisResult,
  MultiTimeframePatternAnalysis,
  ComprehensivePatternAnalysis,

  // 核心分析函数
  analyzeAllPatterns,
  combinePatternAnalyses,
  analyzeMultiTimeframePatterns,
};
