import { Candle } from '../../types.js';
import {
  analyzeChipDistribution,
  calculateChipDistribution,
  ChipAnalysisResult,
} from './chipDistributionAnalysis.js';

// 新增的多时间周期分析相关接口
interface TimeframeAnalysis {
  timeframe: 'weekly' | 'daily' | '1hour';
  analysis: ChipAnalysisResult;
  weight: number; // 该时间周期在综合分析中的权重
}

interface MultiTimeframeAnalysisResult {
  symbol: string;
  currentPrice: number;
  timeframes: TimeframeAnalysis[];

  // 综合指标
  combinedBuySignalStrength: number;
  combinedShortSignalStrength: number;

  // 时间周期一致性指标
  timeframeAlignment: string; // '看多', '看空', '混合', '中性'
  alignmentStrength: number; // 0-100

  // 建议
  primaryTimeframeRecommendation: string;
  combinedRecommendation: string;
  recommendationComment: string;

  // 趋势分析
  trendConsistency: string; // '强', '中等', '弱'
  trendDirection: string; // '上升趋势', '下降趋势', '震荡整理'

  // 跨时间周期聚合的关键价格水平
  aggregatedSupportLevels: number[];
  aggregatedResistanceLevels: number[];

  // 策略建议
  entryStrategy: string;
  exitStrategy: string;
  stopLossLevels: number[];
  takeProfitLevels: number[];

  // 时间周期冲突分析
  timeframeConflicts: string[];

  // 短中长期展望
  shortTermOutlook: string;
  mediumTermOutlook: string;
  longTermOutlook: string;

  primaryTimeframe: 'weekly' | 'daily' | '1hour';
}

/**
 * 获取不同时间周期的K线数据
 * @param symbol 股票代码
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @param timeframe 时间周期
 */

/**
 * 分析多个时间周期并生成综合建议
 */
async function multiTimeFrameChipDistAnalysis(
  symbol: string,
  primaryTimeframe: 'weekly' | 'daily' | '1hour' = 'daily',
  includeTimeframes: ('weekly' | 'daily' | '1hour')[] = [
    'weekly',
    'daily',
    '1hour',
  ],
  weights: { [key: string]: number } = {
    weekly: 0.3,
    daily: 0.5,
    '1hour': 0.2,
  },
  weeklyData: Candle[],
  dailyData: Candle[],
  hourlyData: Candle[]
): Promise<MultiTimeframeAnalysisResult> {
  const timeframeAnalyses: TimeframeAnalysis[] = [];
  let candles = [];

  // 为每个时间周期获取数据并分析
  for (const timeframe of includeTimeframes) {
    if (timeframe === 'weekly') {
      candles = weeklyData;
    } else if (timeframe === '1hour') {
      candles = hourlyData;
    } else {
      candles = dailyData;
    }

    // 计算筹码分布
    const chipDistribution = calculateChipDistribution(candles);

    // 分析筹码分布
    const analysis = analyzeChipDistribution(
      symbol,
      chipDistribution,
      candles[candles.length - 1].close,
      candles
    );

    // 添加到时间周期分析结果中，带有权重
    timeframeAnalyses.push({
      timeframe,
      analysis,
      weight: weights[timeframe] || 0.33, // 如果未指定则使用平均权重
    });
  }

  // 组合各时间周期的分析结果，生成综合建议
  const combinedAnalysis = combineTimeframeAnalyses(
    timeframeAnalyses,
    primaryTimeframe
  );

  return combinedAnalysis;
}

/**
 * 组合不同时间周期的分析结果
 */
function combineTimeframeAnalyses(
  timeframeAnalyses: TimeframeAnalysis[],
  primaryTimeframe: 'weekly' | 'daily' | '1hour'
): MultiTimeframeAnalysisResult {
  // 查找主要时间周期的分析结果
  const primaryAnalysis = timeframeAnalyses.find(
    ta => ta.timeframe === primaryTimeframe
  )?.analysis;

  if (!primaryAnalysis) {
    throw new Error(`未找到主要时间周期 ${primaryTimeframe} 的分析结果`);
  }

  // 计算加权的买入和卖空信号强度
  let totalWeight = 0;
  let weightedBuySignal = 0;
  let weightedShortSignal = 0;

  for (const ta of timeframeAnalyses) {
    weightedBuySignal += ta.analysis.buySignalStrength * ta.weight;
    weightedShortSignal += ta.analysis.shortSignalStrength * ta.weight;
    totalWeight += ta.weight;
  }

  const combinedBuySignalStrength = Math.round(weightedBuySignal / totalWeight);
  const combinedShortSignalStrength = Math.round(
    weightedShortSignal / totalWeight
  );

  // 判断时间周期一致性
  const bullishCount = timeframeAnalyses.filter(ta =>
    ta.analysis.overallRecommendation.includes('多')
  ).length;

  const bearishCount = timeframeAnalyses.filter(ta =>
    ta.analysis.overallRecommendation.includes('空')
  ).length;

  const neutralCount = timeframeAnalyses.length - bullishCount - bearishCount;

  let timeframeAlignment = '混合';
  let alignmentStrength = 0;

  if (bullishCount > bearishCount && bullishCount > neutralCount) {
    timeframeAlignment = '看多';
    alignmentStrength = Math.round(
      (bullishCount / timeframeAnalyses.length) * 100
    );
  } else if (bearishCount > bullishCount && bearishCount > neutralCount) {
    timeframeAlignment = '看空';
    alignmentStrength = Math.round(
      (bearishCount / timeframeAnalyses.length) * 100
    );
  } else if (neutralCount >= bullishCount && neutralCount >= bearishCount) {
    timeframeAlignment = '中性';
    alignmentStrength = Math.round(
      (neutralCount / timeframeAnalyses.length) * 100
    );
  }

  // 确定趋势一致性和方向
  const trendDirections = timeframeAnalyses.map(ta => {
    const buyStrength = ta.analysis.buySignalStrength;
    const shortStrength = ta.analysis.shortSignalStrength;

    if (buyStrength > shortStrength + 20) return '上升趋势';
    if (shortStrength > buyStrength + 20) return '下降趋势';
    return '震荡整理';
  });

  const uptrendCount = trendDirections.filter(t => t === '上升趋势').length;
  const downtrendCount = trendDirections.filter(t => t === '下降趋势').length;
  const rangingCount = trendDirections.filter(t => t === '震荡整理').length;

  let trendDirection = '震荡整理';
  if (uptrendCount > downtrendCount && uptrendCount > rangingCount) {
    trendDirection = '上升趋势';
  } else if (downtrendCount > uptrendCount && downtrendCount > rangingCount) {
    trendDirection = '下降趋势';
  }

  // 计算趋势一致性
  const dominantTrendCount = Math.max(
    uptrendCount,
    downtrendCount,
    rangingCount
  );
  const trendConsistencyRatio = dominantTrendCount / timeframeAnalyses.length;

  let trendConsistency = '弱';
  if (trendConsistencyRatio >= 0.8) {
    trendConsistency = '强';
  } else if (trendConsistencyRatio >= 0.5) {
    trendConsistency = '中等';
  }

  // 聚合所有时间周期的关键支撑和阻力位
  const allSupportLevels = timeframeAnalyses.flatMap(ta => [
    ...ta.analysis.strongSupportLevels,
    ...ta.analysis.moderateSupportLevels,
  ]);

  const allResistanceLevels = timeframeAnalyses.flatMap(ta => [
    ...ta.analysis.strongResistanceLevels,
    ...ta.analysis.moderateResistanceLevels,
  ]);

  // 分组相近的价格水平（相差在2%以内）
  const aggregatedSupportLevels = groupNearbyLevels(
    allSupportLevels,
    primaryAnalysis.currentPrice
  );
  const aggregatedResistanceLevels = groupNearbyLevels(
    allResistanceLevels,
    primaryAnalysis.currentPrice
  );

  // 识别时间周期间的冲突
  const timeframeConflicts = identifyTimeframeConflicts(timeframeAnalyses);

  // 生成短中长期展望
  const shortTermOutlook = generateTimeframeOutlook(
    timeframeAnalyses.find(ta => ta.timeframe === '1hour')?.analysis
  );

  const mediumTermOutlook = generateTimeframeOutlook(
    timeframeAnalyses.find(ta => ta.timeframe === 'daily')?.analysis
  );

  const longTermOutlook = generateTimeframeOutlook(
    timeframeAnalyses.find(ta => ta.timeframe === 'weekly')?.analysis
  );

  // 生成综合建议
  let combinedRecommendation = '';
  let recommendationComment = '';
  let entryStrategy = '';
  let exitStrategy = '';

  if (combinedBuySignalStrength > combinedShortSignalStrength + 20) {
    // 强烈的买入信号
    combinedRecommendation = '综合建议：做多';

    if (timeframeAlignment === '看多' && alignmentStrength > 70) {
      recommendationComment = '多个时间周期一致看多，强烈建议买入。';
      entryStrategy = '可积极入场，建议在支撑位附近分批买入。';
    } else if (timeframeAlignment === '看多') {
      recommendationComment = '多个时间周期偏向看多，建议买入。';
      entryStrategy = '建议在回调到支撑位时买入。';
    } else {
      recommendationComment =
        '综合指标偏向看多，但时间周期一致性不强，建议谨慎买入。';
      entryStrategy = '建议小仓位试探性买入，等待更多确认。';
    }

    exitStrategy =
      '可设置在主要阻力位附近，或当短期时间周期出现卖出信号时离场。';
  } else if (combinedShortSignalStrength > combinedBuySignalStrength + 20) {
    // 强烈的卖出信号
    combinedRecommendation = '综合建议：做空';

    if (timeframeAlignment === '看空' && alignmentStrength > 70) {
      recommendationComment = '多个时间周期一致看空，强烈建议卖出/做空。';
      entryStrategy = '可积极入场做空，建议在阻力位附近分批做空。';
    } else if (timeframeAlignment === '看空') {
      recommendationComment = '多个时间周期偏向看空，建议卖出/做空。';
      entryStrategy = '建议在反弹到阻力位时做空。';
    } else {
      recommendationComment =
        '综合指标偏向看空，但时间周期一致性不强，建议谨慎做空。';
      entryStrategy = '建议小仓位试探性做空，等待更多确认。';
    }

    exitStrategy =
      '可设置在主要支撑位附近，或当短期时间周期出现买入信号时离场。';
  } else {
    // 中性或混合信号
    combinedRecommendation = '综合建议：观望';
    recommendationComment = '各时间周期信号不一致或中性，建议暂时观望。';
    entryStrategy = '建议等待更明确的信号出现再入场。';
    exitStrategy = '现有仓位可在小幅盈利时了结，控制风险。';
  }

  // 在评论中添加趋势分析
  recommendationComment += ` 趋势分析显示市场处于${trendDirection}，一致性${trendConsistency}。`;

  // 如果存在时间周期冲突，在建议中提及
  if (timeframeConflicts.length > 0) {
    recommendationComment += ` 注意：${timeframeConflicts.join(' ')}`;
  }

  // 确定止损和止盈位
  const stopLossLevels = determineStopLossLevels(
    combinedRecommendation,
    primaryAnalysis.currentPrice,
    aggregatedSupportLevels,
    aggregatedResistanceLevels
  );

  const takeProfitLevels = determineTakeProfitLevels(
    combinedRecommendation,
    primaryAnalysis.currentPrice,
    aggregatedSupportLevels,
    aggregatedResistanceLevels
  );

  // 将各时间周期的具体见解添加到建议中
  recommendationComment += ` 短期(1小时)${shortTermOutlook}，中期(日线)${mediumTermOutlook}，长期(周线)${longTermOutlook}。`;

  return {
    symbol: primaryAnalysis.symbol,
    currentPrice: primaryAnalysis.currentPrice,
    timeframes: timeframeAnalyses,
    combinedBuySignalStrength,
    combinedShortSignalStrength,
    timeframeAlignment,
    alignmentStrength,
    primaryTimeframe,
    primaryTimeframeRecommendation: primaryAnalysis.overallRecommendation,
    combinedRecommendation,
    recommendationComment,
    trendConsistency,
    trendDirection,
    aggregatedSupportLevels,
    aggregatedResistanceLevels,
    entryStrategy,
    exitStrategy,
    stopLossLevels,
    takeProfitLevels,
    timeframeConflicts,
    shortTermOutlook,
    mediumTermOutlook,
    longTermOutlook,
  };
}

/**
 * 将相近的价格水平分组
 */
function groupNearbyLevels(
  levels: number[],
  currentPrice: number,
  proximityThreshold = 0.02
): number[] {
  if (levels.length === 0) return [];

  // 对价格水平排序
  const sortedLevels = [...levels].sort((a, b) => a - b);

  const groupedLevels: number[] = [];
  let currentGroup: number[] = [sortedLevels[0]];

  for (let i = 1; i < sortedLevels.length; i++) {
    const currentLevel = sortedLevels[i];
    const previousLevel = sortedLevels[i - 1];

    // 如果当前价格水平在阈值范围内，加入当前组
    if ((currentLevel - previousLevel) / currentPrice <= proximityThreshold) {
      currentGroup.push(currentLevel);
    } else {
      // 将当前组的平均价格添加到结果中，并开始新的一组
      groupedLevels.push(
        currentGroup.reduce((sum, val) => sum + val, 0) / currentGroup.length
      );
      currentGroup = [currentLevel];
    }
  }

  // 添加最后一组
  if (currentGroup.length > 0) {
    groupedLevels.push(
      currentGroup.reduce((sum, val) => sum + val, 0) / currentGroup.length
    );
  }

  return groupedLevels;
}

/**
 * 根据建议和价格水平确定止损位
 */
function determineStopLossLevels(
  recommendation: string,
  currentPrice: number,
  supportLevels: number[],
  resistanceLevels: number[]
): number[] {
  if (recommendation.includes('多')) {
    // 做多仓位，寻找当前价格下方的支撑位
    const relevantSupports = supportLevels
      .filter(level => level < currentPrice)
      .sort((a, b) => b - a); // 降序排列，先找最近的

    // 返回1-2个最近的支撑位
    return relevantSupports.slice(0, Math.min(2, relevantSupports.length));
  } else if (recommendation.includes('空')) {
    // 做空仓位，寻找当前价格上方的阻力位
    const relevantResistances = resistanceLevels
      .filter(level => level > currentPrice)
      .sort((a, b) => a - b); // 升序排列，先找最近的

    // 返回1-2个最近的阻力位
    return relevantResistances.slice(
      0,
      Math.min(2, relevantResistances.length)
    );
  }

  // 对于中性建议，返回最近的支撑位和阻力位
  const closestSupport = supportLevels
    .filter(level => level < currentPrice)
    .sort((a, b) => b - a)[0];

  const closestResistance = resistanceLevels
    .filter(level => level > currentPrice)
    .sort((a, b) => a - b)[0];

  return [closestSupport, closestResistance].filter(Boolean);
}

/**
 * 根据建议和价格水平确定止盈位
 */
function determineTakeProfitLevels(
  recommendation: string,
  currentPrice: number,
  supportLevels: number[],
  resistanceLevels: number[]
): number[] {
  if (recommendation.includes('多')) {
    // 做多仓位，寻找当前价格上方的阻力位
    const relevantResistances = resistanceLevels
      .filter(level => level > currentPrice)
      .sort((a, b) => a - b); // 升序排列

    // 返回2-3个阻力位
    return relevantResistances.slice(
      0,
      Math.min(3, relevantResistances.length)
    );
  } else if (recommendation.includes('空')) {
    // 做空仓位，寻找当前价格下方的支撑位
    const relevantSupports = supportLevels
      .filter(level => level < currentPrice)
      .sort((a, b) => b - a); // 降序排列

    // 返回2-3个支撑位
    return relevantSupports.slice(0, Math.min(3, relevantSupports.length));
  }

  // 对于中性建议，返回下一个重要的支撑位和阻力位
  return [];
}

/**
 * 识别时间周期之间的冲突
 */
function identifyTimeframeConflicts(
  timeframeAnalyses: TimeframeAnalysis[]
): string[] {
  const conflicts: string[] = [];

  // 寻找短期与中期的冲突
  const shortTerm = timeframeAnalyses.find(
    ta => ta.timeframe === '1hour'
  )?.analysis;
  const mediumTerm = timeframeAnalyses.find(
    ta => ta.timeframe === 'daily'
  )?.analysis;

  if (shortTerm && mediumTerm) {
    if (
      shortTerm.overallRecommendation.includes('多') &&
      mediumTerm.overallRecommendation.includes('空')
    ) {
      conflicts.push('短期看多但中期看空，存在反转风险');
    } else if (
      shortTerm.overallRecommendation.includes('空') &&
      mediumTerm.overallRecommendation.includes('多')
    ) {
      conflicts.push('短期看空但中期看多，可能是回调机会');
    }
  }

  // 寻找中期与长期的冲突
  const longTerm = timeframeAnalyses.find(
    ta => ta.timeframe === 'weekly'
  )?.analysis;

  if (mediumTerm && longTerm) {
    if (
      mediumTerm.overallRecommendation.includes('多') &&
      longTerm.overallRecommendation.includes('空')
    ) {
      conflicts.push('中期看多但长期看空，注意长期阻力位');
    } else if (
      mediumTerm.overallRecommendation.includes('空') &&
      longTerm.overallRecommendation.includes('多')
    ) {
      conflicts.push('中期看空但长期看多，可能是在长期上升趋势中回调');
    }
  }

  // 检查技术指标与筹码形态的不一致
  for (const ta of timeframeAnalyses) {
    if (
      ta.analysis.technicalSignal.includes('买入') &&
      !ta.analysis.shapeBuySignal
    ) {
      conflicts.push(
        `${ta.timeframe === 'weekly' ? '周线' : ta.timeframe === 'daily' ? '日线' : '1小时'}技术指标看多但筹码形态不支持`
      );
    } else if (
      ta.analysis.technicalSignal.includes('卖出') &&
      ta.analysis.shapeBuySignal
    ) {
      conflicts.push(
        `${ta.timeframe === 'weekly' ? '周线' : ta.timeframe === 'daily' ? '日线' : '1小时'}技术指标看空但筹码形态看多`
      );
    }
  }

  return conflicts;
}

/**
 * 根据单个时间周期的分析生成展望
 */
function generateTimeframeOutlook(analysis?: ChipAnalysisResult): string {
  if (!analysis) {
    return '数据不足，无法分析';
  }

  if (analysis.buySignalStrength > 75) {
    return '强烈看多';
  } else if (analysis.buySignalStrength > 60) {
    return '看多';
  } else if (analysis.shortSignalStrength > 75) {
    return '强烈看空';
  } else if (analysis.shortSignalStrength > 60) {
    return '看空';
  } else if (analysis.buySignalStrength > analysis.shortSignalStrength + 10) {
    return '偏多';
  } else if (analysis.shortSignalStrength > analysis.buySignalStrength + 10) {
    return '偏空';
  } else {
    return '中性';
  }
}

// 导出核心函数，使其可供其他模块使用
export {
  multiTimeFrameChipDistAnalysis,
  MultiTimeframeAnalysisResult,
  TimeframeAnalysis,
};
