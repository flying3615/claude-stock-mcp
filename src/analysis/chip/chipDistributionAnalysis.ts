import { Candle } from '../../types.js';
import {
  analyzeChipPeakPattern,
  calculateBullBearRatio,
  calculateCumulativeDistribution,
  calculateEntropyOfDistribution,
  calculateGiniCoefficient,
  identifyChipPeaks,
  identifyKeyPriceLevels,
} from '../../util/chipUtils.js';
import { calculateTechnicalIndicators } from '../../util/taUtil.js';

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
 * 分析筹码移动趋势
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
