import {
  ChipDistribution,
  ChipPeak,
} from '../analysis/chip/chipDistributionAnalysis.js';

/**
 * 计算基尼系数 - 衡量分布不平等程度
 * 值范围0-1，值越高表示分布越不平等（即筹码越集中）
 */
export function calculateGiniCoefficient(
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
export function identifyChipPeaks(
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
export function analyzeChipPeakPattern(
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
 * 计算筹码分布的熵值 - 新增
 * 熵值可以用来衡量分布的不确定性，熵值越低表示分布越集中
 */
export function calculateEntropyOfDistribution(
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
export function calculateCumulativeDistribution(
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
export function calculateBullBearRatio(
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
export function identifyKeyPriceLevels(
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
