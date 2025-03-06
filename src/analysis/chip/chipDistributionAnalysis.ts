import { getStockData } from '../../util/util.js';
import { Candle } from '../../types.js';

export interface ChipDistribution {
  price: number;
  weight: number;
  percentage: number;
}

export interface ChipPeak {
  price: number;
  weight: number;
  percentage: number;
  peakType: 'major' | 'secondary' | 'minor';
  distance: number; // 距离当前价格的百分比
}

// 扩展接口，添加卖空相关分析结果
export interface ChipAnalysisResult {
  // 基本信息
  symbol: string;
  currentPrice: number;

  // 筹码集中度分析
  concentrationIndex: number; // 筹码集中指数(0-100)，越高表示越集中
  concentrationLevel: string; // 集中度评级: 高/中/低
  isEasyToPush: boolean; // 是否易于拉升
  concentrationComment: string; // 集中度详细分析
  entropyValue: number; // 筹码分布熵值
  bullBearRatio: number; // 多空比率

  // 上方套牢盘分析
  trappedChipsAbove: number; // 上方套牢筹码百分比
  resistanceLevel: string; // 阻力评级: 强/中/弱
  isPushingDifficult: boolean; // 拉升是否困难
  resistanceComment: string; // 阻力详细分析

  // 获利盘分析
  profitChipsPercentage: number; // 获利筹码百分比
  profitTakingRisk: string; // 获利风险评级: 高/中/低
  isRiskyToChase: boolean; // 追高是否有风险
  profitComment: string; // 获利盘详细分析

  // 筹码峰分析 - 新增
  chipPeaks: ChipPeak[]; // 所有筹码峰
  majorPeaks: ChipPeak[]; // 主要筹码峰
  peakDistribution: string; // 峰值分布特征：左侧集中/右侧集中/双峰/多峰分散
  peakComment: string; // 筹码峰详细分析

  // 筹码形态分析 - 新增
  chipShape: string; // 筹码形态：左高右低/左低右高/均衡分布/双峰分布
  shapeBuySignal: boolean; // 形态是否有利于买入
  shapeComment: string; // 形态详细分析

  // 成交量萎缩与活跃度分析 - 新增
  recentVolumeChange: number; // 近期成交量变化(%)
  volumeTrend: string; // 成交量趋势：放大/萎缩/稳定
  volumeComment: string; // 成交量详细分析

  // 筹码移动趋势分析 - 新增
  chipMigrationDirection: string; // 筹码移动方向：向上/向下/横盘
  chipMigrationSpeed: number; // 筹码移动速度(0-100)
  migrationComment: string; // 筹码移动详细分析

  // 买入建议 - 新增
  buySignalStrength: number; // 买入信号强度(0-100)
  buyRecommendation: string; // 买入建议：强烈推荐/谨慎推荐/不推荐/等待观察
  buyComment: string; // 买入详细分析与建议

  // 卖空建议 - 新增
  shortSignalStrength: number; // 卖空信号强度(0-100)
  shortRecommendation: string; // 卖空建议：强烈推荐/谨慎推荐/不推荐/等待观察
  shortComment: string; // 卖空详细分析与建议
  isShortRecommended: boolean; // 是否推荐卖空

  // 综合交易建议 - 新增
  overallRecommendation: string; // 综合建议：做多/做空/观望
  positionSuggestion: string; // 仓位建议：重仓/中等仓位/轻仓/空仓观望
  overallComment: string; // 综合建议详细分析

  // 附加信息
  majorSupportLevels: number[]; // 主要支撑位
  majorResistanceLevels: number[]; // 主要阻力位
  giniCoefficient: number; // 基尼系数(衡量不平等程度)

  // 关键价格水平分析 - 新增
  strongSupportLevels: number[]; // 强支撑位
  moderateSupportLevels: number[]; // 中等支撑位
  strongResistanceLevels: number[]; // 强阻力位
  moderateResistanceLevels: number[]; // 中等阻力位

  // 累积分布函数 - 新增
  cumulativeDistribution: { price: number; cumulativePercentage: number }[];

  // 技术指标整合 - 新增
  macdSignal: string; // MACD信号：金叉/死叉/背离/中性
  rsiLevel: number; // RSI水平(0-100)
  bollingerStatus: string; // 布林带状态：上轨/中轨/下轨/突破上轨/突破下轨
  technicalSignal: string; // 综合技术信号：强买入/买入/中性/卖出/强卖出
}

/**
 * 计算筹码分布
 */
export function calculateChipDistribution(
  data: Candle[],
  decayFactor: number = 0.95,
  priceSegments: number = 100
): ChipDistribution[] {
  // 找出价格范围
  const allPrices = data.flatMap(d => [d.high, d.low, d.open, d.close]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);

  // 创建价格区间
  const priceStep = (maxPrice - minPrice) / priceSegments;
  const priceRanges: number[] = [];
  for (let i = 0; i <= priceSegments; i++) {
    priceRanges.push(minPrice + i * priceStep);
  }

  // 初始化分布数组
  const distribution: { [price: number]: number } = {};
  priceRanges.forEach(price => {
    distribution[price] = 0;
  });

  // 计算每个交易日的筹码分布并累加
  let totalWeight = 0;
  let weightFactor = 1;

  // 从最近的数据开始计算
  for (let i = data.length - 1; i >= 0; i--) {
    const day = data[i];
    const dayAvgPrice = (day.high + day.low + day.open + day.close) / 4;
    const volume = day.volume;

    // 找到最接近的价格区间
    const closestPrice = priceRanges.reduce((prev, curr) =>
      Math.abs(curr - dayAvgPrice) < Math.abs(prev - dayAvgPrice) ? curr : prev
    );

    // 累加权重后的成交量
    distribution[closestPrice] += volume * weightFactor;
    totalWeight += volume * weightFactor;

    // 应用衰减因子
    weightFactor *= decayFactor;
  }

  // 计算百分比并格式化结果
  const result: ChipDistribution[] = Object.entries(distribution)
    .map(([price, weight]) => ({
      price: parseFloat(price),
      weight,
      percentage: (weight / totalWeight) * 100,
    }))
    .filter(item => item.weight > 0) // 移除权重为0的项
    .sort((a, b) => a.price - b.price); // 按价格排序

  return result;
}
// 辅助函数 - 根据累积百分比找到对应价格
function findPriceAtCumulativePercentage(
  cumulativeDistribution: { price: number; cumulativePercentage: number }[],
  targetPercentage: number
): number {
  // 查找最接近目标累积百分比的项
  for (let i = 0; i < cumulativeDistribution.length; i++) {
    if (cumulativeDistribution[i].cumulativePercentage >= targetPercentage) {
      return cumulativeDistribution[i].price;
    }
  }

  // 如果没有找到，返回最后一项的价格
  return cumulativeDistribution[cumulativeDistribution.length - 1].price;
}

/**
 * 计算基尼系数 - 衡量分布不平等程度
 * 值范围0-1，值越高表示分布越不平等（即筹码越集中）
 */
function calculateGiniCoefficient(
  chipDistribution: ChipDistribution[]
): number {
  const n = chipDistribution.length;
  if (n <= 1) return 0;

  // 按权重排序
  const sortedWeights = chipDistribution
    .map(item => item.weight)
    .sort((a, b) => a - b);

  let sumNumerator = 0;
  for (let i = 0; i < n; i++) {
    sumNumerator += sortedWeights[i] * (i + 1);
  }

  const sumWeights = sortedWeights.reduce((sum, weight) => sum + weight, 0);
  return (2 * sumNumerator) / (n * sumWeights) - (n + 1) / n;
}

/**
 * 识别筹码峰
 * 使用自适应峰值检测算法识别筹码峰
 */
function identifyChipPeaks(
  chipDistribution: ChipDistribution[],
  currentPrice: number
): ChipPeak[] {
  // 过滤掉权重为0的数据点
  const filteredDist = chipDistribution.filter(item => item.weight > 0);

  // 按价格排序
  const sortedDist = [...filteredDist].sort((a, b) => a.price - b.price);

  if (sortedDist.length === 0) return [];

  // 计算统计特性，用于自适应参数
  const weights = sortedDist.map(item => item.percentage);
  const meanWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length;
  const stdDev = Math.sqrt(
    weights.reduce((sum, w) => sum + Math.pow(w - meanWeight, 2), 0) /
      weights.length
  );

  // 自适应窗口大小: 基于数据点数量和分布
  // 数据点越多，窗口越大；分布越均匀，窗口越小
  const dataSparsity = stdDev / meanWeight; // 分布的离散程度
  const baseWindowSize = Math.max(
    3,
    Math.min(7, Math.floor(sortedDist.length / 20))
  );
  const windowSize = Math.max(
    2,
    Math.round(baseWindowSize * (1 - 0.5 * dataSparsity))
  );

  // 自适应峰值类型阈值
  const majorThreshold = Math.max(5, meanWeight + 2 * stdDev);
  const secondaryThreshold = Math.max(2, meanWeight + stdDev);

  // 峰值检测的宽容度，允许接近峰值的点也被视为峰值的一部分
  const peakTolerance = 0.85; // 如果一个点的权重至少是最高点的85%，将其视为同一峰的一部分

  const candidatePeaks: ChipPeak[] = [];
  const minWindowPadding = 1; // 即使在边界附近，我们也至少检查相邻的1个点

  // 处理所有点，包括边界情况
  for (let i = 0; i < sortedDist.length; i++) {
    const current = sortedDist[i];
    let isPeak = true;

    // 确定实际窗口范围（处理边界情况）
    const leftBound = Math.max(0, i - windowSize);
    const rightBound = Math.min(sortedDist.length - 1, i + windowSize);

    // 如果窗口太小，则不考虑此点作为峰值
    if (i - leftBound < minWindowPadding || rightBound - i < minWindowPadding) {
      continue;
    }

    // 记录窗口内的最大值
    let windowMax = current.weight;
    for (let j = leftBound; j <= rightBound; j++) {
      if (j !== i && sortedDist[j].weight > windowMax) {
        windowMax = sortedDist[j].weight;
      }
    }

    // 检查是否是局部最大值，考虑容差
    // 如果当前点至少是窗口最大值的peakTolerance比例，则认为是局部峰值的一部分
    if (current.weight < peakTolerance * windowMax) {
      isPeak = false;
    }

    // 如果是峰值，添加到候选列表
    if (isPeak) {
      const distance = ((current.price - currentPrice) / currentPrice) * 100;

      // 根据相对阈值确定峰值类型
      let peakType: 'major' | 'secondary' | 'minor' = 'minor';
      if (current.percentage >= majorThreshold) {
        peakType = 'major';
      } else if (current.percentage >= secondaryThreshold) {
        peakType = 'secondary';
      }

      candidatePeaks.push({
        price: current.price,
        weight: current.weight,
        percentage: current.percentage,
        peakType,
        distance,
      });
    }
  }

  // 峰值抑制 - 合并相近的峰
  const finalPeaks: ChipPeak[] = [];
  if (candidatePeaks.length > 0) {
    // 按权重排序候选峰值
    candidatePeaks.sort((a, b) => b.weight - a.weight);

    // 使用最小价格间隔来防止过于接近的峰值
    const minPriceGap =
      (sortedDist[sortedDist.length - 1].price - sortedDist[0].price) * 0.02;

    for (const peak of candidatePeaks) {
      // 检查这个峰值是否足够远离已添加的峰值
      const isFarEnough = finalPeaks.every(
        existingPeak => Math.abs(existingPeak.price - peak.price) >= minPriceGap
      );

      if (isFarEnough) {
        finalPeaks.push(peak);
      } else {
        // 如果有一个已存在的峰值接近这个峰值，并且这个峰值更强，则替换它
        const nearbyPeakIndex = finalPeaks.findIndex(
          existingPeak =>
            Math.abs(existingPeak.price - peak.price) < minPriceGap &&
            existingPeak.weight < peak.weight
        );

        if (nearbyPeakIndex !== -1) {
          finalPeaks[nearbyPeakIndex] = peak;
        }
      }
    }
  }

  // 按权重排序
  return finalPeaks.sort((a, b) => b.weight - a.weight);
}

/**
 * 分析筹码峰形态
 * 判断筹码峰的分布特征，用更明确的术语表示价格高低
 */
/**
 * 分析筹码峰形态 - 改进版
 * 判断筹码峰的分布特征，用更明确的术语表示价格高低
 */
function analyzeChipPeakPattern(
  peaks: ChipPeak[],
  currentPrice: number,
  chipDistribution: ChipDistribution[]
): {
  peakDistribution: string;
  chipShape: string;
  shapeBuySignal: boolean;
  peakComment: string;
} {
  // 若没有识别到明显的峰，返回默认值
  if (peaks.length === 0) {
    return {
      peakDistribution: '无明显峰值',
      chipShape: '分散分布',
      shapeBuySignal: false,
      peakComment: '筹码分布较为分散，无明显集中区域。',
    };
  }

  // 计算当前价格下方(低价)和上方(高价)的筹码总量
  const lowerPriceChips = chipDistribution
    .filter(item => item.price < currentPrice)
    .reduce((sum, item) => sum + item.percentage, 0);

  const higherPriceChips = chipDistribution
    .filter(item => item.price > currentPrice)
    .reduce((sum, item) => sum + item.percentage, 0);

  // 计算总筹码百分比和各区域占比
  const totalChips = lowerPriceChips + higherPriceChips;
  const lowerChipRatio = lowerPriceChips / totalChips;
  const higherChipRatio = higherPriceChips / totalChips;

  // 筹码集中度，用于调整判断阈值
  const chipConcentration =
    peaks.reduce((sum, p) => sum + p.percentage, 0) / totalChips;

  // 计算低价区和高价区的峰值，并确保按权重排序
  const lowerPricePeaks = peaks
    .filter(p => p.price < currentPrice)
    .sort((a, b) => b.weight - a.weight);

  const higherPricePeaks = peaks
    .filter(p => p.price > currentPrice)
    .sort((a, b) => b.weight - a.weight);

  // 判断主要峰的相对强度
  const hasLowerPeak = lowerPricePeaks.length > 0;
  const hasHigherPeak = higherPricePeaks.length > 0;

  // 根据市场环境调整的动态阈值
  // 当筹码集中度高时，需要更明显的差异才能判断形态
  const dominanceThreshold = 1.5 + chipConcentration * 0.5;

  // 判断主要筹码区域的极端性
  const extremeImbalance = Math.abs(lowerChipRatio - higherChipRatio) > 0.7;
  const moderateImbalance = Math.abs(lowerChipRatio - higherChipRatio) > 0.3;

  // 判断形态
  let peakDistribution = '';
  let chipShape = '';
  let shapeBuySignal = false;
  let peakComment = '';

  // 判断峰的分布特征
  if (hasLowerPeak && hasHigherPeak) {
    // 存在低价和高价两个区域的峰
    const lowerPeakStrength = lowerPricePeaks[0].weight;
    const higherPeakStrength = higherPricePeaks[0].weight;
    const peakRatio = lowerPeakStrength / higherPeakStrength;

    if (peakRatio > dominanceThreshold && lowerChipRatio > 0.6) {
      // 低价区主峰明显强于高价区，且低价区筹码占比超过60%
      peakDistribution = '低价区集中';
      chipShape = '低价高密度';
      shapeBuySignal = true;
      peakComment =
        '筹码主要集中在当前价格下方，形成强支撑，上方阻力较小，有利于价格上涨。';
    } else if (1 / peakRatio > dominanceThreshold && higherChipRatio > 0.6) {
      // 高价区主峰明显强于低价区，且高价区筹码占比超过60%
      peakDistribution = '高价区集中';
      chipShape = '高价高密度';
      shapeBuySignal = false;
      peakComment =
        '筹码主要集中在当前价格上方，形成较强阻力，建议等待筹码结构改善后再考虑买入。';
    } else if (Math.abs(peakRatio - 1) < 0.3) {
      // 双峰强度接近，真正的双峰分布
      peakDistribution = '双峰分布';
      chipShape = '均衡双峰';

      // 根据当前价格相对于两峰的位置判断信号
      const lowerPeakPrice = lowerPricePeaks[0].price;
      const higherPeakPrice = higherPricePeaks[0].price;
      const isCloserToLowerPeak =
        currentPrice - lowerPeakPrice < higherPeakPrice - currentPrice;

      if (isCloserToLowerPeak) {
        shapeBuySignal = true;
        peakComment =
          '筹码呈双峰均衡分布，当前价格靠近低价区峰值，有一定支撑，可以考虑适量买入。';
      } else {
        shapeBuySignal = false;
        peakComment =
          '筹码呈双峰均衡分布，当前价格靠近高价区峰值，上方阻力较大，建议等待价格回调。';
      }
    } else if (peakRatio > 1) {
      // 低价区峰值略强
      peakDistribution = '低价区略强';
      chipShape = '低峰占优';
      shapeBuySignal = lowerChipRatio > 0.55;
      peakComment = `筹码分布呈现低价区略强形态，${
        lowerChipRatio > 0.55
          ? '形成一定支撑，谨慎买入'
          : '但支撑力度有限，建议观望'
      }。`;
    } else {
      // 高价区峰值略强
      peakDistribution = '高价区略强';
      chipShape = '高峰占优';
      shapeBuySignal = false;
      peakComment =
        '筹码分布呈现高价区略强形态，上方阻力较大，不建议现在买入。';
    }
  } else if (hasLowerPeak) {
    // 只有低价区有明显峰值
    if (extremeImbalance) {
      peakDistribution = '极度低价集中';
      chipShape = '底部密集';
      shapeBuySignal = true;
      peakComment = '筹码极度集中在低价区，几乎无上方阻力，是理想的买入时机。';
    } else if (moderateImbalance) {
      peakDistribution = '低价区集中';
      chipShape = '低价高密度';
      shapeBuySignal = true;
      peakComment =
        '筹码主要集中在当前价格下方，形成较强支撑，上涨阻力较小，适合买入。';
    } else {
      peakDistribution = '低价略占优';
      chipShape = '低价略高密度';
      shapeBuySignal = true;
      peakComment = '筹码略偏向低价区集中，有一定支撑，可以考虑小仓位买入。';
    }
  } else if (hasHigherPeak) {
    // 只有高价区有明显峰值
    if (extremeImbalance) {
      peakDistribution = '极度高价集中';
      chipShape = '顶部密集';
      shapeBuySignal = false;
      peakComment = '筹码极度集中在高价区，上方阻力极强，建议回避。';
    } else if (moderateImbalance) {
      peakDistribution = '高价区集中';
      chipShape = '高价高密度';
      shapeBuySignal = false;
      peakComment =
        '筹码主要集中在当前价格上方，形成较强阻力，不适合现在买入。';
    } else {
      peakDistribution = '高价略占优';
      chipShape = '高价略高密度';
      shapeBuySignal = false;
      peakComment = '筹码略偏向高价区集中，上方存在一定阻力，建议观望。';
    }
  } else {
    // 理论上不应该到达这里，但为了逻辑完整性保留
    // 这种情况可能出现在所有峰值都刚好等于currentPrice的极端情况
    peakDistribution = '均衡分布';
    chipShape = '均衡分布';
    shapeBuySignal = lowerChipRatio >= 0.5;
    peakComment = `筹码分布较为均衡，${
      lowerChipRatio >= 0.5
        ? '支撑略强于阻力，可以考虑小仓位买入'
        : '阻力略强于支撑，建议观望'
    }。`;
  }

  return {
    peakDistribution,
    chipShape,
    shapeBuySignal,
    peakComment,
  };
}

/**
 * 分析成交量趋势 - 新增
 */
function analyzeVolumeTrend(
  data: Candle[],
  lookbackPeriod: number = 20
): {
  recentVolumeChange: number;
  volumeTrend: string;
  volumeComment: string;
} {
  // 确保有足够的数据
  if (data.length < lookbackPeriod + 5) {
    return {
      recentVolumeChange: 0,
      volumeTrend: '数据不足',
      volumeComment: '历史数据不足，无法分析成交量趋势。',
    };
  }

  // 获取近期成交量和前期成交量
  const recentVolumes = data.slice(data.length - lookbackPeriod);
  const previousVolumes = data.slice(
    data.length - lookbackPeriod * 2,
    data.length - lookbackPeriod
  );

  // 计算平均成交量
  const recentAvgVolume =
    recentVolumes.reduce((sum, d) => sum + d.volume, 0) / recentVolumes.length;
  const previousAvgVolume =
    previousVolumes.reduce((sum, d) => sum + d.volume, 0) /
    previousVolumes.length;

  // 计算成交量变化比例
  const volumeChange =
    ((recentAvgVolume - previousAvgVolume) / previousAvgVolume) * 100;

  // 判断成交量趋势
  let volumeTrend = '';
  let volumeComment = '';

  if (volumeChange > 20) {
    volumeTrend = '明显放大';
    volumeComment =
      '近期成交量明显放大，表明市场参与度增强，可能预示重要行情启动。';
  } else if (volumeChange > 5) {
    volumeTrend = '小幅放大';
    volumeComment = '近期成交量小幅放大，市场活跃度有所提升。';
  } else if (volumeChange < -20) {
    volumeTrend = '明显萎缩';
    volumeComment =
      '近期成交量明显萎缩，表明交投清淡，可能是底部构筑过程，主力可能在低位悄悄吸筹。';
  } else if (volumeChange < -5) {
    volumeTrend = '小幅萎缩';
    volumeComment = '近期成交量小幅萎缩，市场活跃度有所下降。';
  } else {
    volumeTrend = '基本稳定';
    volumeComment = '近期成交量基本稳定，市场处于均衡状态。';
  }

  return {
    recentVolumeChange: parseFloat(volumeChange.toFixed(2)),
    volumeTrend,
    volumeComment,
  };
}

/**
 * 分析筹码移动趋势 - 新增
 * 通过比较不同时期的筹码分布来分析筹码迁移方向
 */
/**
 * 分析筹码移动趋势 - 改进版
 * 通过比较不同时期的筹码分布来分析筹码迁移方向
 */
function analyzeChipMigration(
  data: Candle[],
  currentPrice: number
): {
  chipMigrationDirection: string;
  chipMigrationSpeed: number;
  migrationComment: string;
} {
  // 防御性检查：确保有足够的数据进行分析
  if (data.length < 10) {
    return {
      chipMigrationDirection: '数据不足',
      chipMigrationSpeed: 0,
      migrationComment: '历史数据不足，无法分析筹码迁移趋势。',
    };
  }

  // 动态计算期间长度，确保至少有5个数据点
  const recentPeriod = Math.max(5, Math.min(30, Math.floor(data.length / 3)));
  const previousPeriod = Math.max(5, Math.min(30, Math.floor(data.length / 3)));

  // 确保有足够的数据来计算两个周期
  if (data.length < recentPeriod + previousPeriod) {
    return {
      chipMigrationDirection: '数据不足',
      chipMigrationSpeed: 0,
      migrationComment: '历史数据不足，无法完整分析筹码迁移趋势。',
    };
  }

  const recentData = data.slice(data.length - recentPeriod);
  const previousData = data.slice(
    data.length - recentPeriod - previousPeriod,
    data.length - recentPeriod
  );

  // 计算筹码分布
  const recentDistribution = calculateChipDistribution(recentData);
  const previousDistribution = calculateChipDistribution(previousData);

  // 防御性检查：确保分布计算成功
  if (!recentDistribution.length || !previousDistribution.length) {
    return {
      chipMigrationDirection: '计算错误',
      chipMigrationSpeed: 0,
      migrationComment: '筹码分布计算失败，无法分析迁移趋势。',
    };
  }

  // 计算近期和前期的平均价格（加权平均）
  const recentTotalPercentage = recentDistribution.reduce(
    (sum, item) => sum + item.percentage,
    0
  );

  const previousTotalPercentage = previousDistribution.reduce(
    (sum, item) => sum + item.percentage,
    0
  );

  // 防御性检查：确保分母不为零
  const recentAvgPrice =
    recentTotalPercentage > 0
      ? recentDistribution.reduce(
          (sum, item) => sum + item.price * item.percentage,
          0
        ) / recentTotalPercentage
      : 0;

  const previousAvgPrice =
    previousTotalPercentage > 0
      ? previousDistribution.reduce(
          (sum, item) => sum + item.price * item.percentage,
          0
        ) / previousTotalPercentage
      : 0;

  // 防御性检查：确保计算有效
  if (recentAvgPrice === 0 || previousAvgPrice === 0) {
    return {
      chipMigrationDirection: '计算错误',
      chipMigrationSpeed: 0,
      migrationComment: '筹码分布数据异常，无法分析迁移趋势。',
    };
  }

  // 计算价格变化百分比
  const priceChange =
    ((recentAvgPrice - previousAvgPrice) / previousAvgPrice) * 100;

  // 计算市场波动率，用于动态调整阈值
  const priceSeries = data.slice(-30).map(d => d.close);
  const avgPrice =
    priceSeries.reduce((sum, price) => sum + price, 0) / priceSeries.length;
  const volatility =
    (Math.sqrt(
      priceSeries.reduce(
        (sum, price) => sum + Math.pow(price - avgPrice, 2),
        0
      ) / priceSeries.length
    ) /
      avgPrice) *
    100;

  // 动态阈值：在高波动市场中使用更高的阈值
  const significantThreshold = Math.max(2, volatility * 0.5);
  const moderateThreshold = Math.max(0.5, volatility * 0.2);

  // 计算筹码移动速度：考虑时间因素和市场波动性
  const timeNormalization = 30 / recentPeriod; // 标准化为30天周期
  const normalizedChange = Math.abs(priceChange) * timeNormalization;
  const migrationSpeed = Math.min(
    100,
    (normalizedChange / (volatility * 0.1)) * 10
  );

  // 计算不同价格区间的筹码变化
  const calculateChipChangeInRange = (
    recentDist: ChipDistribution[],
    previousDist: ChipDistribution[],
    minPrice: number,
    maxPrice: number
  ): number => {
    const recentTotal = recentDist
      .filter(item => item.price >= minPrice && item.price < maxPrice)
      .reduce((sum, item) => sum + item.percentage, 0);

    const previousTotal = previousDist
      .filter(item => item.price >= minPrice && item.price < maxPrice)
      .reduce((sum, item) => sum + item.percentage, 0);

    return recentTotal - previousTotal;
  };

  const lowPriceChipChange = calculateChipChangeInRange(
    recentDistribution,
    previousDistribution,
    0,
    currentPrice * 0.9
  );

  const midPriceChipChange = calculateChipChangeInRange(
    recentDistribution,
    previousDistribution,
    currentPrice * 0.9,
    currentPrice * 1.1
  );

  const highPriceChipChange = calculateChipChangeInRange(
    recentDistribution,
    previousDistribution,
    currentPrice * 1.1,
    Infinity
  );

  // 计算筹码集中度变化
  const calculateChipConcentration = (
    distribution: ChipDistribution[]
  ): number => {
    const sortedDist = [...distribution].sort(
      (a, b) => b.percentage - a.percentage
    );

    // 前20%的筹码占总筹码的百分比
    const top20Percent = Math.ceil(distribution.length * 0.2);
    if (top20Percent === 0) return 0;

    const top20Weight = sortedDist
      .slice(0, top20Percent)
      .reduce((sum, item) => sum + item.percentage, 0);
    const totalWeight = sortedDist.reduce(
      (sum, item) => sum + item.percentage,
      0
    );

    return totalWeight > 0 ? (top20Weight / totalWeight) * 100 : 0;
  };

  const recentConcentration = calculateChipConcentration(recentDistribution);
  const previousConcentration =
    calculateChipConcentration(previousDistribution);
  const concentrationChange = recentConcentration - previousConcentration;

  // 确定筹码迁移方向
  let migrationDirection = '';
  let migrationComment = '';

  if (priceChange > significantThreshold) {
    migrationDirection = '明显向上';
    migrationComment = '筹码正在明显向上移动，表明持仓成本上移，多头占优势。';
  } else if (priceChange > moderateThreshold) {
    migrationDirection = '缓慢向上';
    migrationComment = '筹码缓慢向上移动，市场温和走强。';
  } else if (priceChange < -significantThreshold) {
    migrationDirection = '明显向下';
    migrationComment = '筹码正在明显向下移动，表明持仓成本下移，空头占优势。';
  } else if (priceChange < -moderateThreshold) {
    migrationDirection = '缓慢向下';
    migrationComment = '筹码缓慢向下移动，市场温和走弱。';
  } else {
    migrationDirection = '基本横盘';
    migrationComment = '筹码基本处于横盘状态，市场处于震荡整理。';
  }

  // 分析筹码聚集趋势
  if (Math.abs(concentrationChange) > 5) {
    migrationComment +=
      concentrationChange > 0
        ? ' 筹码集中度正在提高，可能形成更明确的支撑或阻力位。'
        : ' 筹码集中度正在降低，价格区间可能扩大。';
  }

  // 与当前价格比较，增加更多信息
  const relativePriceRatio = currentPrice / recentAvgPrice;
  if (relativePriceRatio > 1.1) {
    migrationComment +=
      ' 当前价格显著高于主流筹码成本，获利盘较多，注意回调风险。';
  } else if (relativePriceRatio > 1.03) {
    migrationComment +=
      ' 当前价格略高于主流筹码成本，获利筹码增加，可能面临一定抛压。';
  } else if (relativePriceRatio < 0.9) {
    migrationComment +=
      ' 当前价格显著低于主流筹码成本，套牢盘较多，若能放量突破将有较大上涨空间。';
  } else if (relativePriceRatio < 0.97) {
    migrationComment +=
      ' 当前价格略低于主流筹码成本，部分筹码套牢，需要成交量配合才能突破。';
  } else {
    migrationComment += ' 当前价格接近主流筹码成本，多空双方处于相对平衡状态。';
  }

  // 分析筹码区域变化
  if (lowPriceChipChange > 5) {
    migrationComment += ' 低价区筹码明显增加，显示有资金在低位吸筹。';
  } else if (highPriceChipChange > 5) {
    migrationComment += ' 高价区筹码明显增加，显示有获利盘在高位套现的风险。';
  } else if (midPriceChipChange > 5) {
    migrationComment += ' 中间价位筹码增加，市场交投活跃度提升。';
  }

  return {
    chipMigrationDirection: migrationDirection,
    chipMigrationSpeed: parseFloat(migrationSpeed.toFixed(2)),
    migrationComment: migrationComment.trim(),
  };
}

/**
 * 计算简化版技术指标 - 新增
 */
function calculateTechnicalIndicators(data: Candle[]): {
  macdSignal: string;
  rsiLevel: number;
  bollingerStatus: string;
  technicalSignal: string;
  trendStatus?: string; // 新增趋势状态
} {
  // 确保有足够的数据
  if (data.length < 30) {
    return {
      macdSignal: '数据不足',
      rsiLevel: 50,
      bollingerStatus: '数据不足',
      technicalSignal: '中性',
      trendStatus: '数据不足',
    };
  }

  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const currentPrice = closes[closes.length - 1];

  // 计算完整的MACD序列
  const macdData = calculateFullMACD(closes);
  const macdLine = macdData.macdLine[macdData.macdLine.length - 1];
  const signalLine = macdData.signalLine[macdData.signalLine.length - 1];
  const previousMacdLine = macdData.macdLine[macdData.macdLine.length - 2];
  const previousSignalLine =
    macdData.signalLine[macdData.signalLine.length - 2];

  // 计算RSI
  const rsi = calculateStandardRSI(closes, 14);

  // 计算布林带
  const sma20 = calculateSMA(closes, 20);
  const stdDev = calculateStdDev(closes, 20);
  const upperBand = sma20 + stdDev * 2;
  const lowerBand = sma20 - stdDev * 2;

  // 趋势识别
  const trendStatus = identifyTrend(closes);

  // 确定MACD信号
  let macdSignal = '';
  const isMacdCrossOver =
    macdLine > signalLine && previousMacdLine <= previousSignalLine;
  const isMacdCrossUnder =
    macdLine < signalLine && previousMacdLine >= previousSignalLine;

  if (isMacdCrossOver && macdLine > 0) {
    macdSignal = '新金叉向上';
  } else if (isMacdCrossOver && macdLine <= 0) {
    macdSignal = '新金叉但在0轴下';
  } else if (isMacdCrossUnder && macdLine > 0) {
    macdSignal = '新死叉但在0轴上';
  } else if (isMacdCrossUnder && macdLine <= 0) {
    macdSignal = '新死叉向下';
  } else if (macdLine > signalLine && macdLine > previousMacdLine) {
    macdSignal = '金叉并继续向上';
  } else if (macdLine > signalLine && macdLine <= previousMacdLine) {
    macdSignal = '金叉但有回落迹象';
  } else if (macdLine < signalLine && macdLine > previousMacdLine) {
    macdSignal = '死叉但有反弹迹象';
  } else {
    macdSignal = '死叉并继续向下';
  }

  // 确定布林带状态
  let bollingerStatus = '';
  if (currentPrice > upperBand) {
    bollingerStatus = '突破上轨';
  } else if (currentPrice < lowerBand) {
    bollingerStatus = '突破下轨';
  } else if (currentPrice > sma20) {
    bollingerStatus = '运行于上轨道';
  } else {
    bollingerStatus = '运行于下轨道';
  }

  // 计算布林带宽度 - 可用于判断波动性
  const bandWidth = ((upperBand - lowerBand) / sma20) * 100;
  const isBandSqueeze = bandWidth < 3.5; // 带宽较窄，可能即将爆发

  // 综合技术信号
  let buySignals = 0;
  let sellSignals = 0;

  // MACD信号计分
  if (macdSignal.includes('新金叉向上')) buySignals += 3;
  else if (macdSignal.includes('新金叉但在0轴下')) buySignals += 2;
  else if (macdSignal.includes('金叉并继续向上')) buySignals += 2;
  else if (macdSignal.includes('金叉但有回落迹象')) buySignals += 1;
  else if (macdSignal.includes('新死叉向下')) sellSignals += 3;
  else if (macdSignal.includes('新死叉但在0轴上')) sellSignals += 2;
  else if (macdSignal.includes('死叉并继续向下')) sellSignals += 2;
  else if (macdSignal.includes('死叉但有反弹迹象')) sellSignals += 1;

  // RSI信号计分
  if (rsi < 30) buySignals += 2;
  else if (rsi < 40) buySignals += 1;
  else if (rsi > 70) sellSignals += 2;
  else if (rsi > 60) sellSignals += 1;

  // 布林带信号计分
  if (bollingerStatus === '突破下轨') buySignals += 2;
  else if (bollingerStatus === '运行于下轨道') buySignals += 1;
  else if (bollingerStatus === '突破上轨') sellSignals += 2;
  else if (bollingerStatus === '运行于上轨道') sellSignals += 1;

  // 趋势因素计分
  if (trendStatus === '强势上涨趋势') buySignals += 2;
  else if (trendStatus === '中期反弹') buySignals += 1;
  else if (trendStatus === '强势下跌趋势') sellSignals += 2;
  else if (trendStatus === '中期回调') sellSignals += 1;

  // 布林带挤压可能代表即将爆发的行情
  if (isBandSqueeze && macdLine > signalLine) buySignals += 1;
  else if (isBandSqueeze && macdLine < signalLine) sellSignals += 1;

  // 确定综合信号
  let technicalSignal = '';
  if (buySignals >= 6) technicalSignal = '强买入';
  else if (buySignals > sellSignals + 2) technicalSignal = '买入';
  else if (sellSignals >= 6) technicalSignal = '强卖出';
  else if (sellSignals > buySignals + 2) technicalSignal = '卖出';
  else technicalSignal = '中性';

  return {
    macdSignal,
    rsiLevel: parseFloat(rsi.toFixed(2)),
    bollingerStatus,
    technicalSignal,
    trendStatus,
  };
}

// 辅助函数: 计算完整的MACD序列
function calculateFullMACD(prices: number[]): {
  macdLine: number[];
  signalLine: number[];
} {
  const ema12Values = [];
  const ema26Values = [];
  const macdValues = [];

  // 计算所有EMA12和EMA26值
  let ema12 = prices[0];
  let ema26 = prices[0];

  for (let i = 0; i < prices.length; i++) {
    ema12 = prices[i] * (2 / 13) + ema12 * (1 - 2 / 13);
    ema26 = prices[i] * (2 / 27) + ema26 * (1 - 2 / 27);

    ema12Values.push(ema12);
    ema26Values.push(ema26);
    macdValues.push(ema12 - ema26);
  }

  // 计算信号线（MACD的9周期EMA）
  const signalValues = [];

  // 初始化信号线
  if (macdValues.length >= 9) {
    let signal = macdValues.slice(0, 9).reduce((sum, val) => sum + val, 0) / 9;

    for (let i = 0; i < 9; i++) {
      signalValues.push(signal); // 前9个值使用相同的初始值
    }

    // 计算剩余的信号线值
    for (let i = 9; i < macdValues.length; i++) {
      signal = macdValues[i] * (2 / 10) + signal * (1 - 2 / 10);
      signalValues.push(signal);
    }
  } else {
    // 数据不足时填充
    for (let i = 0; i < macdValues.length; i++) {
      signalValues.push(macdValues[i]);
    }
  }

  return {
    macdLine: macdValues,
    signalLine: signalValues,
  };
}

// 辅助函数: 计算标准的RSI
function calculateStandardRSI(prices: number[], period: number): number {
  if (prices.length <= period) return 50;

  let avgGain = 0;
  let avgLoss = 0;

  // 计算首个RSI的平均涨跌幅
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change >= 0) {
      avgGain += change;
    } else {
      avgLoss -= change;
    }
  }

  avgGain /= period;
  avgLoss /= period;

  // 使用Wilder平滑技术计算后续RSI
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change >= 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - change) / period;
    }
  }

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// 辅助函数: 趋势识别
function identifyTrend(prices: number[]): string {
  if (prices.length < 60) return '数据不足';

  const sma5 = calculateSMA(prices, 5);
  const sma10 = calculateSMA(prices, 10);
  const sma20 = calculateSMA(prices, 20);
  const sma60 = calculateSMA(prices, 60);

  // 计算价格与各均线的关系
  const priceVsSma5 = prices[prices.length - 1] > sma5;
  const priceVsSma10 = prices[prices.length - 1] > sma10;
  const priceVsSma20 = prices[prices.length - 1] > sma20;
  const priceVsSma60 = prices[prices.length - 1] > sma60;

  // 计算均线间的关系
  const sma5VsSma10 = sma5 > sma10;
  const sma10VsSma20 = sma10 > sma20;
  const sma20VsSma60 = sma20 > sma60;

  // 判断多周期趋势
  if (
    priceVsSma5 &&
    priceVsSma10 &&
    priceVsSma20 &&
    priceVsSma60 &&
    sma5VsSma10 &&
    sma10VsSma20 &&
    sma20VsSma60
  ) {
    return '强势上涨趋势';
  } else if (
    !priceVsSma5 &&
    !priceVsSma10 &&
    !priceVsSma20 &&
    !priceVsSma60 &&
    !sma5VsSma10 &&
    !sma10VsSma20 &&
    !sma20VsSma60
  ) {
    return '强势下跌趋势';
  } else if (priceVsSma5 && priceVsSma10 && priceVsSma20 && !priceVsSma60) {
    return '中期反弹';
  } else if (!priceVsSma5 && !priceVsSma10 && !priceVsSma20 && priceVsSma60) {
    return '中期回调';
  } else if (priceVsSma5 && priceVsSma10 && !priceVsSma20 && !priceVsSma60) {
    return '短期反弹';
  } else if (!priceVsSma5 && !priceVsSma10 && priceVsSma20 && priceVsSma60) {
    return '短期回调';
  } else {
    return '震荡整理';
  }
}

// 辅助函数 - 计算SMA
function calculateSMA(data: number[], period: number): number {
  const slice = data.slice(-period);
  return slice.reduce((sum, price) => sum + price, 0) / slice.length;
}

// 辅助函数 - 计算标准差
function calculateStdDev(data: number[], period: number): number {
  const slice = data.slice(-period);
  const mean = slice.reduce((sum, val) => sum + val, 0) / slice.length;
  const squaredDiffs = slice.map(val => Math.pow(val - mean, 2));
  const variance =
    squaredDiffs.reduce((sum, val) => sum + val, 0) / slice.length;
  return Math.sqrt(variance);
}

/**
 * 计算筹码分布的熵值 - 新增
 * 熵值可以用来衡量分布的不确定性，熵值越低表示分布越集中
 */
function calculateEntropyOfDistribution(
  chipDistribution: ChipDistribution[]
): number {
  const totalPercentage = chipDistribution.reduce(
    (sum, item) => sum + item.percentage,
    0
  );

  let entropy = 0;
  for (const item of chipDistribution) {
    if (item.percentage > 0) {
      const p = item.percentage / totalPercentage;
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

/**
 * 计算筹码分布的累积分布函数(CDF) - 新增
 * 用于进一步分析筹码分布特征
 */
function calculateCumulativeDistribution(
  chipDistribution: ChipDistribution[]
): { price: number; cumulativePercentage: number }[] {
  // 按价格排序
  const sortedDist = [...chipDistribution].sort((a, b) => a.price - b.price);

  let cumulative = 0;
  return sortedDist.map(item => {
    cumulative += item.percentage;
    return {
      price: item.price,
      cumulativePercentage: cumulative,
    };
  });
}

/**
 * 计算多空比率 - 新增
 * 根据筹码分布计算多空比，用于判断市场情绪
 * 0-1: 极度看空 - 高价筹码占绝对优势，下跌风险极高
 * 1-3: 强势看空 - 高价筹码明显占优，下跌趋势强劲
 * 3-4: 偏空 - 高价筹码略占优势，市场偏向下行
 * 4-6: 中性 - 多空力量基本平衡，市场处于震荡整理
 * 6-7: 偏多 - 低价筹码略占优势，市场偏向上行
 * 7-9: 强势看多 - 低价筹码明显占优，上涨趋势强劲
 * 9-10: 极度看多 - 低价筹码占绝对优势，强势上涨概率高
 */
function calculateBullBearRatio(
  chipDistribution: ChipDistribution[],
  currentPrice: number,
  volatility: number = 0.02 // 增加市场波动率参数
): number {
  // 防御性检查
  if (!chipDistribution || chipDistribution.length === 0) {
    return 1.0; // 返回中性值
  }

  // 动态设置阈值，基于市场波动率
  const bullThreshold = 1 - Math.min(0.1, volatility * 2.5); // 例如波动率2%时为0.95
  const bearThreshold = 1 + Math.min(0.1, volatility * 2.5); // 例如波动率2%时为1.05
  const neutralWeight = 0.5; // 中性区域的权重因子

  // 计算加权筹码量
  const bullChips = chipDistribution
    .filter(item => item.price < currentPrice * bullThreshold)
    .reduce((sum, item) => {
      // 距离当前价格越远，权重越小
      const distanceFactor = Math.max(
        0.5,
        1 - (currentPrice - item.price) / currentPrice
      );
      return sum + item.percentage * distanceFactor;
    }, 0);

  const bearChips = chipDistribution
    .filter(item => item.price > currentPrice * bearThreshold)
    .reduce((sum, item) => {
      // 距离当前价格越远，权重越小
      const distanceFactor = Math.max(
        0.5,
        1 - (item.price - currentPrice) / currentPrice
      );
      return sum + item.percentage * distanceFactor;
    }, 0);

  // 计算中性区域的筹码，并按比例分配给多空双方
  const neutralChips = chipDistribution
    .filter(
      item =>
        item.price >= currentPrice * bullThreshold &&
        item.price <= currentPrice * bearThreshold
    )
    .reduce((sum, item) => sum + item.percentage, 0);

  // 计算最终的多空比率 (规范化到0-10的范围)
  const adjustedBullChips = bullChips + neutralChips * neutralWeight;
  const adjustedBearChips = bearChips + neutralChips * (1 - neutralWeight);

  if (adjustedBearChips === 0 && adjustedBullChips === 0) return 1.0; // 中性
  if (adjustedBearChips === 0) return 10.0; // 极度看多，设置上限
  if (adjustedBullChips === 0) return 0.0; // 极度看空，设置下限

  // 将比率映射到0-10的范围
  const rawRatio = adjustedBullChips / adjustedBearChips;
  return Math.min(10, (rawRatio * 5) / (1 + rawRatio * 4));
}

/**
 * 识别可能的关键价格水平
 * 通过筹码分布识别关键支撑和阻力位
 */
function identifyKeyPriceLevels(
  chipDistribution: ChipDistribution[],
  currentPrice: number,
  volatility: number = 0.02, // 市场波动率参数
  mergeTolerance: number = 0.01 // 合并相近价格水平的容差（占当前价格的百分比）
): {
  strongSupports: number[];
  moderateSupports: number[];
  strongResistances: number[];
  moderateResistances: number[];
} {
  // 计算总筹码分布的标准差作为基准
  const meanWeight =
    chipDistribution.reduce((sum, item) => sum + item.percentage, 0) /
    chipDistribution.length;
  const stdDev = Math.sqrt(
    chipDistribution.reduce(
      (sum, item) => sum + Math.pow(item.percentage - meanWeight, 2),
      0
    ) / chipDistribution.length
  );

  // 动态设置阈值：将波动率纳入计算
  // 高波动市场需要更高的阈值来识别真正重要的水平
  const volatilityFactor = 1 + volatility * 10; // 将0.02的波动率转换为1.2的因子
  const strongThreshold = Math.max(3, stdDev * 2 * volatilityFactor);
  const moderateThreshold = Math.max(1.5, strongThreshold / 2);

  // 按权重排序
  const sortedByWeight = [...chipDistribution].sort(
    (a, b) => b.weight - a.weight
  );

  // 按价格排序（用于后续聚类）
  const sortedByPrice = [...chipDistribution].sort((a, b) => a.price - b.price);

  // 使用动态阈值筛选候选支撑位和阻力位
  let candidateSupports = sortedByWeight
    .filter(
      item => item.price < currentPrice && item.percentage > moderateThreshold
    )
    .map(item => ({
      price: item.price,
      weight: item.weight,
      percentage: item.percentage,
      isStrong: item.percentage > strongThreshold,
    }));

  let candidateResistances = sortedByWeight
    .filter(
      item => item.price > currentPrice && item.percentage > moderateThreshold
    )
    .map(item => ({
      price: item.price,
      weight: item.weight,
      percentage: item.percentage,
      isStrong: item.percentage > strongThreshold,
    }));

  // 计算局部密度：检查每个候选点周围的筹码累计
  const calculateLocalDensity = candidate => {
    // 定义价格窗口（基于当前价格的一定百分比）
    const windowSize = currentPrice * 0.01; // 1%的价格窗口

    // 找到窗口内的所有点
    const nearbyPoints = sortedByPrice.filter(
      item => Math.abs(item.price - candidate.price) <= windowSize
    );

    // 计算窗口内的总权重
    const localDensity = nearbyPoints.reduce(
      (sum, item) => sum + item.percentage,
      0
    );

    return {
      ...candidate,
      localDensity,
    };
  };

  // 计算局部密度
  candidateSupports = candidateSupports.map(calculateLocalDensity);
  candidateResistances = candidateResistances.map(calculateLocalDensity);

  // 按局部密度重新排序
  candidateSupports.sort(
    (a, b) => (b as any).localDensity - (a as any).localDensity
  );
  candidateResistances.sort(
    (a, b) => (b as any).localDensity - (a as any).localDensity
  );

  // 合并相近的价格水平
  const mergeNearbyLevels = levels => {
    if (levels.length <= 1) return levels;

    const mergedLevels = [];
    let currentGroup = [levels[0]];

    for (let i = 1; i < levels.length; i++) {
      const lastLevel = currentGroup[currentGroup.length - 1];
      // 如果当前价格与上一个价格足够接近，合并它们
      if (
        Math.abs(levels[i].price - lastLevel.price) / currentPrice <=
        mergeTolerance
      ) {
        currentGroup.push(levels[i]);
      } else {
        // 处理当前组，添加到结果中，然后开始新的组
        // 选择组中权重最高的价格水平作为代表
        currentGroup.sort((a, b) => b.localDensity - a.localDensity);
        mergedLevels.push(currentGroup[0]);
        currentGroup = [levels[i]];
      }
    }

    // 处理最后一组
    if (currentGroup.length > 0) {
      currentGroup.sort((a, b) => b.localDensity - a.localDensity);
      mergedLevels.push(currentGroup[0]);
    }

    return mergedLevels;
  };

  // 合并相近的水平
  const mergedSupports = mergeNearbyLevels(candidateSupports);
  const mergedResistances = mergeNearbyLevels(candidateResistances);

  // 返回结果
  return {
    strongSupports: mergedSupports
      .filter(item => item.isStrong)
      .map(item => item.price),
    moderateSupports: mergedSupports
      .filter(item => !item.isStrong)
      .map(item => item.price),
    strongResistances: mergedResistances
      .filter(item => item.isStrong)
      .map(item => item.price),
    moderateResistances: mergedResistances
      .filter(item => !item.isStrong)
      .map(item => item.price),
  };
}

/**
 * 分析筹码分布并生成买入建议
 */
export function analyzeChipDistribution(
  symbol: string,
  chipDistribution: ChipDistribution[],
  currentPrice: number,
  data: Candle[]
): ChipAnalysisResult {
  // 1. 基本信息

  // 2. 计算筹码集中度
  // 使用基尼系数、熵值和前N%的筹码占比来衡量集中度
  const giniCoefficient = calculateGiniCoefficient(chipDistribution);

  // 使用熵值作为筹码分散度的另一个衡量指标
  const entropyValue = calculateEntropyOfDistribution(chipDistribution);

  // 计算累积分布函数，用于后续分析
  const cumulativeDistribution =
    calculateCumulativeDistribution(chipDistribution);

  // 计算多空比率，判断市场情绪
  const bullBearRatio = calculateBullBearRatio(chipDistribution, currentPrice);

  // 识别关键价格水平
  const keyPriceLevels = identifyKeyPriceLevels(chipDistribution, currentPrice);

  // 计算Top 20%价格区间的筹码占比
  const sortedByPercentage = [...chipDistribution].sort(
    (a, b) => b.percentage - a.percentage
  );
  const top20Percentage = sortedByPercentage
    .slice(0, Math.ceil(chipDistribution.length * 0.2))
    .reduce((sum, item) => sum + item.percentage, 0);

  // 筹码集中指数 (0-100)
  const concentrationIndex = Math.round(
    (giniCoefficient * 0.5 + (top20Percentage / 100) * 0.5) * 100
  );

  // 集中度评级
  let concentrationLevel = '';
  let isEasyToPush = false;
  if (concentrationIndex > 70) {
    concentrationLevel = '高';
    isEasyToPush = true;
  } else if (concentrationIndex > 40) {
    concentrationLevel = '中';
    isEasyToPush = concentrationIndex > 60;
  } else {
    concentrationLevel = '低';
    isEasyToPush = false;
  }

  // 3. 分析上方套牢盘
  // 计算当前价格上方的筹码比例
  const chipsAbove = chipDistribution
    .filter(item => item.price > currentPrice)
    .reduce((sum, item) => sum + item.percentage, 0);

  // 计算上方筹码密度 - 上方筹码占比/价格区间数量
  const priceRangesAbove = chipDistribution.filter(
    item => item.price > currentPrice
  ).length;
  const chipDensityAbove =
    priceRangesAbove > 0 ? chipsAbove / priceRangesAbove : 0;

  // 阻力评级
  let resistanceLevel = '';
  let isPushingDifficult = false;

  if (chipsAbove > 40) {
    resistanceLevel = '强';
    isPushingDifficult = true;
  } else if (chipsAbove > 20) {
    resistanceLevel = '中';
    isPushingDifficult = chipDensityAbove > 0.8; // 如果上方筹码密度较高，也视为困难
  } else {
    resistanceLevel = '弱';
    isPushingDifficult = false;
  }

  // 4. 分析获利盘比例
  // 计算当前价格下方的筹码比例 (视为获利盘)
  const profitChipsPercentage = chipDistribution
    .filter(item => item.price < currentPrice)
    .reduce((sum, item) => sum + item.percentage, 0);

  // 获利风险评级
  let profitTakingRisk = '';
  let isRiskyToChase = false;

  if (profitChipsPercentage > 60) {
    profitTakingRisk = '高';
    isRiskyToChase = true;
  } else if (profitChipsPercentage > 30) {
    profitTakingRisk = '中';
    isRiskyToChase = currentPrice > sortedByPercentage[0].price * 1.1; // 如果当前价格高于主要筹码峰10%以上
  } else {
    profitTakingRisk = '低';
    isRiskyToChase = false;
  }

  // 5. 识别和分析筹码峰 - 新增功能
  const chipPeaks = identifyChipPeaks(chipDistribution, currentPrice);
  const majorPeaks = chipPeaks.filter(peak => peak.peakType === 'major');

  // 6. 分析筹码峰形态
  const peakAnalysis = analyzeChipPeakPattern(
    chipPeaks,
    currentPrice,
    chipDistribution
  );

  // 7. 分析成交量趋势
  const volumeAnalysis = analyzeVolumeTrend(data);

  // 8. 分析筹码移动趋势
  const migrationAnalysis = analyzeChipMigration(data, currentPrice);

  // 9. 计算技术指标
  const technicalIndicators = calculateTechnicalIndicators(data);

  // 10. 生成买入建议
  // 买入信号强度评分系统 (0-100)
  let buyScore = 0;

  // 集中度评分
  if (concentrationLevel === '高') buyScore += 15;
  else if (concentrationLevel === '中') buyScore += 10;
  else buyScore += 5;

  // 多空比率评分
  if (bullBearRatio > 3)
    buyScore += 15; // 多方占优势
  else if (bullBearRatio > 1.5) buyScore += 10;
  else if (bullBearRatio < 0.5) buyScore -= 10; // 空方占优势

  // 上方阻力评分
  if (resistanceLevel === '弱') buyScore += 20;
  else if (resistanceLevel === '中') buyScore += 10;
  else buyScore += 0;

  // 筹码形态评分
  if (peakAnalysis.shapeBuySignal) buyScore += 20;

  // 成交量评分
  if (volumeAnalysis.volumeTrend === '明显萎缩')
    buyScore += 10; // 底部特征
  else if (volumeAnalysis.volumeTrend === '小幅放大')
    buyScore += 15; // 开始上涨特征
  else if (
    volumeAnalysis.volumeTrend === '明显放大' &&
    profitChipsPercentage < 30
  )
    buyScore += 20; // 突破初期
  else if (
    volumeAnalysis.volumeTrend === '明显放大' &&
    profitChipsPercentage > 60
  )
    buyScore -= 10; // 可能是顶部

  // 筹码迁移评分
  if (migrationAnalysis.chipMigrationDirection === '明显向上') buyScore += 10;
  else if (migrationAnalysis.chipMigrationDirection === '缓慢向上')
    buyScore += 15;
  else if (migrationAnalysis.chipMigrationDirection === '明显向下')
    buyScore -= 10;

  // 技术指标评分
  if (technicalIndicators.technicalSignal === '强买入') buyScore += 15;
  else if (technicalIndicators.technicalSignal === '买入') buyScore += 10;
  else if (technicalIndicators.technicalSignal === '强卖出') buyScore -= 15;
  else if (technicalIndicators.technicalSignal === '卖出') buyScore -= 10;

  // 确保分数在0-100范围内
  buyScore = Math.max(0, Math.min(100, buyScore));

  // 确定买入建议
  let buyRecommendation = '';
  let buyComment = '';

  if (buyScore >= 75) {
    buyRecommendation = '强烈推荐买入';
    buyComment =
      '多项指标显示极佳的买入时机，筹码结构优良，上方阻力小，技术指标支持。';
  } else if (buyScore >= 60) {
    buyRecommendation = '建议买入';
    buyComment = '筹码结构良好，具备上涨条件，可以考虑分批买入。';
  } else if (buyScore >= 40) {
    buyRecommendation = '谨慎买入';
    buyComment =
      '筹码结构一般，存在一定风险，建议小仓位试探性买入或等待更好时机。';
  } else if (buyScore >= 25) {
    buyRecommendation = '暂时观望';
    buyComment = '当前筹码结构不佳，建议等待筹码结构改善后再考虑买入。';
  } else {
    buyRecommendation = '不建议买入';
    buyComment =
      '多项指标显示不适合当前买入，筹码结构差，上方阻力大，技术指标不支持。';
  }

  // 11. 新增：生成卖空建议
  // 卖空信号强度评分系统 (0-100)
  let shortScore = 0;

  // 集中度评分 - 集中度高的情况下卖空风险较大
  if (concentrationLevel === '高') shortScore -= 15;
  else if (concentrationLevel === '中') shortScore -= 5;
  else shortScore += 10; // 分散的筹码结构利于卖空

  // 多空比率评分
  if (bullBearRatio < 0.5)
    shortScore += 20; // 空方明显占优势
  else if (bullBearRatio < 1)
    shortScore += 10; // 空方略占优势
  else if (bullBearRatio > 3) shortScore -= 20; // 多方明显占优势

  // 上方阻力评分 - 阻力越大卖空越有利
  if (resistanceLevel === '强') shortScore += 20;
  else if (resistanceLevel === '中') shortScore += 10;
  else shortScore -= 5;

  // 筹码形态评分
  if (!peakAnalysis.shapeBuySignal) shortScore += 15; // 不利于买入的形态有利于卖空

  // 成交量评分
  if (volumeAnalysis.volumeTrend === '明显放大' && profitChipsPercentage > 60)
    shortScore += 15; // 可能是顶部放量
  else if (volumeAnalysis.volumeTrend === '明显萎缩' && isRiskyToChase)
    shortScore += 10; // 高位萎缩
  else if (
    volumeAnalysis.volumeTrend === '明显放大' &&
    profitChipsPercentage < 30
  )
    shortScore -= 15; // 可能是底部放量，不利于卖空

  // 筹码迁移评分
  if (migrationAnalysis.chipMigrationDirection === '明显向下') shortScore += 20;
  else if (migrationAnalysis.chipMigrationDirection === '缓慢向下')
    shortScore += 10;
  else if (migrationAnalysis.chipMigrationDirection === '明显向上')
    shortScore -= 20;
  else if (migrationAnalysis.chipMigrationDirection === '缓慢向上')
    shortScore -= 10;

  // 技术指标评分
  if (technicalIndicators.technicalSignal === '强卖出') shortScore += 20;
  else if (technicalIndicators.technicalSignal === '卖出') shortScore += 15;
  else if (technicalIndicators.technicalSignal === '强买入') shortScore -= 20;
  else if (technicalIndicators.technicalSignal === '买入') shortScore -= 15;

  // RSI指标对卖空的特殊评分
  if (technicalIndicators.rsiLevel > 70)
    shortScore += 15; // 超买区域
  else if (technicalIndicators.rsiLevel < 30) shortScore -= 15; // 超卖区域

  // 确保分数在0-100范围内
  shortScore = Math.max(0, Math.min(100, shortScore));

  // 确定卖空建议
  let shortRecommendation = '';
  let shortComment = '';
  let isShortRecommended = false;

  if (shortScore >= 75) {
    shortRecommendation = '强烈推荐卖空';
    shortComment =
      '多项指标显示极佳的卖空时机，筹码结构处于高位，下方支撑弱，技术指标支持做空。';
    isShortRecommended = true;
  } else if (shortScore >= 60) {
    shortRecommendation = '建议卖空';
    shortComment = '筹码结构偏弱，具备下跌条件，可以考虑分批做空。';
    isShortRecommended = true;
  } else if (shortScore >= 40) {
    shortRecommendation = '谨慎卖空';
    shortComment =
      '存在一定做空机会，但风险较高，建议小仓位试探性做空或等待更好时机。';
    isShortRecommended = false;
  } else if (shortScore >= 25) {
    shortRecommendation = '暂不建议卖空';
    shortComment = '当前做空条件不成熟，建议等待更好的做空机会。';
    isShortRecommended = false;
  } else {
    shortRecommendation = '不建议卖空';
    shortComment =
      '多项指标显示当前不适合做空，筹码结构健康，支撑较强，技术指标不支持做空。';
    isShortRecommended = false;
  }

  // 12. 制定综合交易建议
  let overallRecommendation = '';
  let positionSuggestion = '';
  let overallComment = '';

  // 综合多空信号对比
  if (buyScore > 60 && shortScore < 30) {
    overallRecommendation = '做多';
    if (buyScore > 80) {
      positionSuggestion = '重仓做多';
      overallComment = '强烈看多信号，建议积极入场做多，可适当加大仓位。';
    } else {
      positionSuggestion = '中等仓位做多';
      overallComment = '看多信号明确，建议择机入场做多，控制好仓位。';
    }
  } else if (shortScore > 60 && buyScore < 30) {
    overallRecommendation = '做空';
    if (shortScore > 80) {
      positionSuggestion = '重仓做空';
      overallComment = '强烈看空信号，建议积极入场做空，可适当加大仓位。';
    } else {
      positionSuggestion = '中等仓位做空';
      overallComment = '看空信号明确，建议择机入场做空，控制好仓位。';
    }
  } else if (
    buyScore >= 40 &&
    buyScore <= 60 &&
    shortScore >= 40 &&
    shortScore <= 60
  ) {
    overallRecommendation = '观望';
    positionSuggestion = '空仓观望';
    overallComment = '多空信号交织，市场方向不明确，建议暂时观望等待明确信号。';
  } else if (buyScore > shortScore + 15) {
    overallRecommendation = '偏多';
    positionSuggestion = '轻仓做多';
    overallComment = '偏向看多，但信号不够强烈，建议小仓位试探性做多。';
  } else if (shortScore > buyScore + 15) {
    overallRecommendation = '偏空';
    positionSuggestion = '轻仓做空';
    overallComment = '偏向看空，但信号不够强烈，建议小仓位试探性做空。';
  } else {
    overallRecommendation = '中性';
    positionSuggestion = '观望为主';
    overallComment =
      '多空双方力量相当，市场处于震荡状态，建议以观望为主，等待明确信号出现。';
  }

  // 增加一些具体细节到建议中
  if (majorPeaks.length > 0) {
    const nearestPeak = majorPeaks.reduce((nearest, peak) =>
      Math.abs(peak.distance) < Math.abs(nearest.distance) ? peak : nearest
    );

    if (nearestPeak.price < currentPrice && nearestPeak.distance > -10) {
      buyComment += ` 当前价格刚刚突破主要筹码峰(${nearestPeak.price.toFixed(2)})，可能是突破买点。`;
      shortComment += ` 注意当前价格刚刚突破主要筹码峰(${nearestPeak.price.toFixed(2)})，做空存在风险。`;
    } else if (nearestPeak.price > currentPrice && nearestPeak.distance < 10) {
      buyComment += ` 注意上方${nearestPeak.distance.toFixed(2)}%处存在主要筹码峰(${nearestPeak.price.toFixed(2)})，可能形成阻力。`;
      shortComment += ` 上方${nearestPeak.distance.toFixed(2)}%处存在主要筹码峰(${nearestPeak.price.toFixed(2)})，可作为做空参考点位。`;
    }
  }

  // 在处理强支撑位的地方保存 closestSupport
  let closestSupport = null;
  if (keyPriceLevels.strongSupports.length > 0) {
    closestSupport = keyPriceLevels.strongSupports.reduce((closest, price) =>
      Math.abs(price - currentPrice) < Math.abs(closest - currentPrice)
        ? price
        : closest
    );
    const supportDistance = (
      ((closestSupport - currentPrice) / currentPrice) *
      100
    ).toFixed(2);

    buyComment += ` 最近的强支撑位在${closestSupport.toFixed(2)}(距当前价格${supportDistance}%)。`;
    shortComment += ` 注意最近的强支撑位在${closestSupport.toFixed(2)}(距当前价格${supportDistance}%)，跌破此位可加仓做空。`;
  }

  // 在处理强阻力位的地方使用已保存的 closestSupport
  let closestResistance = null;
  if (keyPriceLevels.strongResistances.length > 0) {
    closestResistance = keyPriceLevels.strongResistances.reduce(
      (closest, price) =>
        Math.abs(price - currentPrice) < Math.abs(closest - currentPrice)
          ? price
          : closest
    );
    const resistanceDistance = (
      ((closestResistance - currentPrice) / currentPrice) *
      100
    ).toFixed(2);

    buyComment += ` 最近的强阻力位在${closestResistance.toFixed(2)}(距当前价格${resistanceDistance}%)。`;
    shortComment += ` 最近的强阻力位在${closestResistance.toFixed(2)}(距当前价格${resistanceDistance}%)，可作为做空的进场点。`;
  }

  // 在处理完支撑位和阻力位后，添加到 overallComment
  if (closestSupport || closestResistance) {
    overallComment += ' 短期关注';
    if (closestSupport) {
      overallComment += `${closestSupport.toFixed(2)}支撑位`;
      if (closestResistance) {
        overallComment += '和';
      }
    }
    if (closestResistance) {
      overallComment += `${closestResistance.toFixed(2)}阻力位`;
    }
    overallComment += '的表现。';
  }

  if (profitTakingRisk === '高') {
    buyComment += ' 当前获利盘较多，存在回调风险。';
    shortComment += ' 当前获利盘较多，存在获利了结引发下跌的可能，利于做空。';
  }

  if (technicalIndicators.rsiLevel < 30) {
    buyComment += ' RSI处于超卖区域，可能出现技术性反弹。';
    shortComment += ' RSI处于超卖区域，不建议继续做空，注意反弹风险。';
  } else if (technicalIndicators.rsiLevel > 70) {
    buyComment += ' RSI处于超买区域，短期可能面临回调。';
    shortComment += ' RSI处于超买区域，技术上存在回落空间，有利于做空。';
  }

  // 13. 寻找主要支撑位和阻力位 (筹码密集区)
  const majorSupportLevels = chipPeaks
    .filter(peak => peak.price < currentPrice)
    .slice(0, 3)
    .map(peak => peak.price);

  const majorResistanceLevels = chipPeaks
    .filter(peak => peak.price > currentPrice)
    .slice(0, 3)
    .map(peak => peak.price);

  // 14. 生成评论
  const concentrationComment =
    `筹码集中度${concentrationLevel}，筹码集中指数: ${concentrationIndex}。` +
    `前20%价格区间的筹码占比为${top20Percentage.toFixed(2)}%。` +
    (isEasyToPush
      ? '筹码分布相对集中，套牢盘较少，技术上更容易拉升。'
      : '筹码分布分散，不利于短期快速拉升。');

  const resistanceComment =
    `上方套牢盘占比${chipsAbove.toFixed(2)}%，阻力${resistanceLevel}。` +
    (isPushingDifficult
      ? '存在明显上方阻力，拉升难度较大。'
      : '上方阻力较小，技术上拉升较为容易。');

  const profitComment =
    `当前获利筹码占比${profitChipsPercentage.toFixed(2)}%，获利风险${profitTakingRisk}。` +
    (isRiskyToChase
      ? '获利盘较多，追高风险较大，可能面临较大抛压。'
      : '获利盘风险可控，适当追高风险相对较低。');

  // 整合分析结果
  return {
    symbol,
    currentPrice,
    concentrationIndex,
    concentrationLevel,
    isEasyToPush,
    concentrationComment,
    entropyValue,
    bullBearRatio,
    trappedChipsAbove: chipsAbove,
    resistanceLevel,
    isPushingDifficult,
    resistanceComment,
    profitChipsPercentage,
    profitTakingRisk,
    isRiskyToChase,
    profitComment,
    chipPeaks,
    majorPeaks,
    peakDistribution: peakAnalysis.peakDistribution,
    peakComment: peakAnalysis.peakComment,
    chipShape: peakAnalysis.chipShape,
    shapeBuySignal: peakAnalysis.shapeBuySignal,
    shapeComment: peakAnalysis.peakComment,
    recentVolumeChange: volumeAnalysis.recentVolumeChange,
    volumeTrend: volumeAnalysis.volumeTrend,
    volumeComment: volumeAnalysis.volumeComment,
    chipMigrationDirection: migrationAnalysis.chipMigrationDirection,
    chipMigrationSpeed: migrationAnalysis.chipMigrationSpeed,
    migrationComment: migrationAnalysis.migrationComment,
    buySignalStrength: buyScore,
    buyRecommendation,
    buyComment,
    shortSignalStrength: shortScore,
    shortRecommendation,
    shortComment,
    isShortRecommended,
    overallRecommendation,
    positionSuggestion,
    overallComment,
    majorSupportLevels,
    majorResistanceLevels,
    giniCoefficient,
    strongSupportLevels: keyPriceLevels.strongSupports,
    moderateSupportLevels: keyPriceLevels.moderateSupports,
    strongResistanceLevels: keyPriceLevels.strongResistances,
    moderateResistanceLevels: keyPriceLevels.moderateResistances,
    cumulativeDistribution,
    macdSignal: technicalIndicators.macdSignal,
    rsiLevel: technicalIndicators.rsiLevel,
    bollingerStatus: technicalIndicators.bollingerStatus,
    technicalSignal: technicalIndicators.technicalSignal,
  };
}
