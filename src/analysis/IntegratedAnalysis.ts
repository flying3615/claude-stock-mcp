import { TrendReversalSignal } from './IntegratedAnalysisTypes.js';
import {
  MultiTimeframeAnalysisResult,
  multiTimeFrameChipDistAnalysis,
} from './chip/multiTimeFrameChipDistributionAnalysis.js';
import {
  EnhancedPatternAnalysis,
  multiTimeframePatternAnalysis,
} from './trendReversal/multiTimeFrameTrendReversal.js';
import {
  ComprehensivePatternAnalysis,
  PatternDirection,
} from './patterns/multiTimeFramePatternAnalysis.js';
import { getStockDataForTimeframe } from '../util/util.js';

/**
 * 综合交易信号强度枚举
 */
export enum SignalStrength {
  Strong = 'strong', // 强信号
  Moderate = 'moderate', // 中等信号
  Weak = 'weak', // 弱信号
  Neutral = 'neutral', // 中性信号
  Conflicting = 'conflicting', // 冲突信号
}

/**
 * 综合交易方向枚举
 */
export enum TradeDirection {
  Long = 'long', // 做多
  Short = 'short', // 做空
  Neutral = 'neutral', // 中性
}

/**
 * 风险等级枚举
 */
export enum RiskLevel {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

/**
 * 时间周期优先级
 */
export enum TimeframePriority {
  Primary = 'primary', // 主要时间周期
  Secondary = 'secondary', // 次要时间周期
  Tertiary = 'tertiary', // 第三时间周期
}

/**
 * 分配时间周期优先级
 * @param timeframes 时间周期
 * @param primaryTimeframe 主要时间周期
 * @returns 带有优先级的时间周期映射
 */
function assignTimeframePriorities(
  timeframes: ('weekly' | 'daily' | '1hour')[],
  primaryTimeframe: 'weekly' | 'daily' | '1hour' = 'daily'
): { [key: string]: TimeframePriority } {
  const priorities: { [key: string]: TimeframePriority } = {};

  // 首先设置主要时间周期
  priorities[primaryTimeframe] = TimeframePriority.Primary;

  // 按照日线>周线>小时线的优先级顺序分配剩余优先级
  const remainingTimeframes = timeframes.filter(tf => tf !== primaryTimeframe);

  if (remainingTimeframes.includes('daily') && primaryTimeframe !== 'daily') {
    priorities['daily'] = TimeframePriority.Secondary;
  } else if (
    remainingTimeframes.includes('weekly') &&
    primaryTimeframe !== 'weekly'
  ) {
    priorities['weekly'] = TimeframePriority.Secondary;
  } else if (
    remainingTimeframes.includes('1hour') &&
    primaryTimeframe !== '1hour'
  ) {
    priorities['1hour'] = TimeframePriority.Secondary;
  }

  // 分配第三优先级
  const assignedTimeframes = Object.keys(priorities);
  const lastTimeframe = remainingTimeframes.find(
    tf => !assignedTimeframes.includes(tf)
  );

  if (lastTimeframe) {
    priorities[lastTimeframe] = TimeframePriority.Tertiary;
  }

  return priorities;
}

/**
 * 关键价位类型
 */
export interface KeyLevel {
  price: number;
  type: 'support' | 'resistance';
  strength: 'strong' | 'moderate' | 'weak';
  source: 'chip' | 'pattern' | 'combined';
  timeframe: 'weekly' | 'daily' | '1hour';
  description: string;
}

/**
 * 交易条件接口
 */
export interface TradeCondition {
  type: 'price' | 'pattern' | 'indicator' | 'volume' | 'time';
  description: string;
  priority: 'critical' | 'important' | 'optional';
}

/**
 * 综合交易计划接口
 */
export interface IntegratedTradePlan {
  symbol: string;
  currentPrice: number;
  date: Date;

  // 综合交易方向和信号强度
  direction: TradeDirection;
  signalStrength: SignalStrength;
  confidenceScore: number; // 0-100

  // 各分析方法的权重与贡献
  chipAnalysisWeight: number;
  patternAnalysisWeight: number;
  chipAnalysisContribution: number; // 0-100
  patternAnalysisContribution: number; // 0-100

  // 总体分析描述
  summary: string;
  primaryRationale: string;
  secondaryRationale: string;
  warnings: string[];

  // 时间周期分析结果
  primaryTimeframe: 'weekly' | 'daily' | '1hour';
  timeframeConsistency: string;
  shortTermOutlook: string;
  mediumTermOutlook: string;
  longTermOutlook: string;

  // 入场计划
  entryStrategy: {
    idealEntryPrice: number;
    alternativeEntryPrice: number;
    entryType: 'immediate' | 'pullback' | 'breakout';
    entryConditions: TradeCondition[];
    priceZones: {
      ideal: [number, number];
      acceptable: [number, number];
    };
    timeWindow: string;
    riskLevel: RiskLevel;
  };

  // 出场计划
  exitStrategy: {
    takeProfitLevels: {
      price: number;
      proportion: number; // 0-1, 表示仓位比例
      reasoning: string;
    }[];
    stopLossLevels: {
      price: number;
      type: 'fixed' | 'trailing';
      reasoning: string;
    }[];
    timeBasedExit: string;
    maximumHoldingPeriod: string;
  };

  // 风险管理
  riskManagement: {
    suggestionPosition: number; // 0-1, 表示账户资金比例
    riskRewardRatio: number;
    maxLoss: string;
    volatilityConsideration: string;
    adjustmentTriggers: string[];
  };

  // 关键价位
  keyLevels: KeyLevel[];

  // 确认信号
  confirmationSignals: TradeCondition[];

  // 无效信号条件
  invalidationConditions: TradeCondition[];

  // 趋势逆转信息 (新增)
  trendReversalInfo?: {
    hasReversalSignal: boolean;
    primaryReversalSignal?: TrendReversalSignal;
    reversalSignalStrength?: number;
    smallTimeframe?: string;
    largeTimeframe?: string;
    reversalDirection?: number;
    entryPrice?: number;
    stopLoss?: number;
    description: string;

    targets?: {
      target1: number; // 目标1 (保守目标)
      target2: number; // 目标2 (标准量度移动目标)
      target3: number; // 目标3 (扩展目标，通常是1.618倍)
      riskRewardRatio1: number; // 目标1的风险回报比
      riskRewardRatio2: number; // 目标2的风险回报比
      riskRewardRatio3: number; // 目标3的风险回报比
    };
  };

  // 综合自筹码和形态分析的关键点
  keyObservations: string[];
}

/**
 * 综合筹码和形态分析结果的方法
 * @param chipAnalysis 筹码分布分析结果
 * @param patternAnalysis 形态分析结果
 * @param customWeights 自定义权重，默认均分
 */
function integrateAnalyses(
  chipAnalysis: MultiTimeframeAnalysisResult,
  patternAnalysis: EnhancedPatternAnalysis,
  customWeights: { chip: number; pattern: number } = { chip: 0.5, pattern: 0.5 }
): IntegratedTradePlan {
  // 确保权重总和为1
  const totalWeight = customWeights.chip + customWeights.pattern;
  const normalizedWeights = {
    chip: customWeights.chip / totalWeight,
    pattern: customWeights.pattern / totalWeight,
  };

  // 确定基本信息
  const symbol = chipAnalysis.symbol;
  const currentPrice = chipAnalysis.currentPrice;
  const date = new Date();

  // 提取筹码分析的信号
  let chipDirection: TradeDirection = TradeDirection.Neutral;
  if (
    chipAnalysis.combinedBuySignalStrength >
    chipAnalysis.combinedShortSignalStrength + 20
  ) {
    chipDirection = TradeDirection.Long;
  } else if (
    chipAnalysis.combinedShortSignalStrength >
    chipAnalysis.combinedBuySignalStrength + 20
  ) {
    chipDirection = TradeDirection.Short;
  }

  // 提取形态分析的信号
  let patternDirection: TradeDirection = TradeDirection.Neutral;
  if (patternAnalysis.combinedSignal === PatternDirection.Bullish) {
    patternDirection = TradeDirection.Long;
  } else if (patternAnalysis.combinedSignal === PatternDirection.Bearish) {
    patternDirection = TradeDirection.Short;
  }

  // 计算各自的贡献分数
  const chipScore = Math.max(
    0,
    Math.min(
      100,
      Math.abs(
        chipAnalysis.combinedBuySignalStrength -
          chipAnalysis.combinedShortSignalStrength
      )
    )
  );
  const patternScore = patternAnalysis.signalStrength;

  // 应用权重计算最终方向和分数
  const chipWeightedScore =
    chipScore *
    normalizedWeights.chip *
    (chipDirection === TradeDirection.Long
      ? 1
      : chipDirection === TradeDirection.Short
        ? -1
        : 0);
  const patternWeightedScore =
    patternScore *
    normalizedWeights.pattern *
    (patternDirection === TradeDirection.Long
      ? 1
      : patternDirection === TradeDirection.Short
        ? -1
        : 0);
  const finalScore = chipWeightedScore + patternWeightedScore;

  // 确定最终交易方向
  let direction = TradeDirection.Neutral;
  if (finalScore > 20) {
    direction = TradeDirection.Long;
  } else if (finalScore < -20) {
    direction = TradeDirection.Short;
  }

  // 确定信号强度
  let signalStrength = SignalStrength.Neutral;
  const absScore = Math.abs(finalScore);

  if (absScore > 60) {
    signalStrength = SignalStrength.Strong;
  } else if (absScore > 40) {
    signalStrength = SignalStrength.Moderate;
  } else if (absScore > 20) {
    signalStrength = SignalStrength.Weak;
  } else if (
    chipDirection !== patternDirection &&
    chipDirection !== TradeDirection.Neutral &&
    patternDirection !== TradeDirection.Neutral
  ) {
    signalStrength = SignalStrength.Conflicting;
  }

  // 计算置信度分数
  const confidenceScore = Math.max(
    0,
    Math.min(
      100,
      absScore +
        (chipDirection === patternDirection &&
        chipDirection !== TradeDirection.Neutral
          ? 20
          : 0) -
        (signalStrength === SignalStrength.Conflicting ? 30 : 0)
    )
  );

  // 提取主要时间周期
  const primaryTimeframe = chipAnalysis.primaryTimeframe || 'daily';

  // 确定时间周期一致性
  const timeframeConsistency = chipAnalysis.timeframeAlignment;
  const timeframeConsistencyStrength = chipAnalysis.alignmentStrength;

  // 整合关键价位
  const keyLevels: KeyLevel[] = [];

  // 从筹码分析添加支撑位
  chipAnalysis.aggregatedSupportLevels.forEach((level, index) => {
    keyLevels.push({
      price: level,
      type: 'support',
      strength: index < 2 ? 'strong' : 'moderate',
      source: 'chip',
      timeframe: primaryTimeframe,
      description: `筹码分析显示的支撑位`,
    });
  });

  // 从筹码分析添加阻力位
  chipAnalysis.aggregatedResistanceLevels.forEach((level, index) => {
    keyLevels.push({
      price: level,
      type: 'resistance',
      strength: index < 2 ? 'strong' : 'moderate',
      source: 'chip',
      timeframe: primaryTimeframe,
      description: `筹码分析显示的阻力位`,
    });
  });

  // 从形态分析添加关键价位
  patternAnalysis.timeframeAnalyses.forEach(tfAnalysis => {
    if (tfAnalysis.dominantPattern) {
      const pattern = tfAnalysis.dominantPattern;

      // 添加突破水平
      keyLevels.push({
        price: pattern.component.breakoutLevel,
        type:
          pattern.direction === PatternDirection.Bullish
            ? 'resistance'
            : 'support',
        strength: pattern.reliability > 70 ? 'strong' : 'moderate',
        source: 'pattern',
        timeframe: tfAnalysis.timeframe,
        description: `${pattern.patternType} 形态的${pattern.direction === PatternDirection.Bullish ? '突破' : '支撑'}位`,
      });

      // 添加目标价
      if (pattern.priceTarget) {
        keyLevels.push({
          price: pattern.priceTarget,
          type:
            pattern.direction === PatternDirection.Bullish
              ? 'resistance'
              : 'support',
          strength: 'moderate',
          source: 'pattern',
          timeframe: tfAnalysis.timeframe,
          description: `${pattern.patternType} 形态的目标价位`,
        });
      }

      // 添加止损位
      if (pattern.stopLoss) {
        keyLevels.push({
          price: pattern.stopLoss,
          type:
            pattern.direction === PatternDirection.Bullish
              ? 'support'
              : 'resistance',
          strength: 'strong',
          source: 'pattern',
          timeframe: tfAnalysis.timeframe,
          description: `${pattern.patternType} 形态的建议止损位`,
        });
      }
    }
  });

  // 按价格排序并合并相近的价位
  keyLevels.sort((a, b) => a.price - b.price);
  const mergedKeyLevels: KeyLevel[] = [];

  for (let i = 0; i < keyLevels.length; i++) {
    if (
      i > 0 &&
      Math.abs(keyLevels[i].price - keyLevels[i - 1].price) / currentPrice <
        0.01
    ) {
      // 合并相近的价位(相差1%以内)
      const prevLevel = mergedKeyLevels[mergedKeyLevels.length - 1];

      // 如果同为支撑或阻力，则合并
      if (prevLevel.type === keyLevels[i].type) {
        // 提升强度
        if (
          keyLevels[i].strength === 'strong' ||
          prevLevel.strength === 'strong'
        ) {
          prevLevel.strength = 'strong';
        }

        // 更新来源
        if (prevLevel.source !== keyLevels[i].source) {
          prevLevel.source = 'combined';
          prevLevel.description += ` + ${keyLevels[i].description}`;
        }
      } else {
        mergedKeyLevels.push(keyLevels[i]);
      }
    } else {
      mergedKeyLevels.push(keyLevels[i]);
    }
  }

  // 生成各时间周期的展望
  const shortTermOutlook = chipAnalysis.shortTermOutlook;
  const mediumTermOutlook = chipAnalysis.mediumTermOutlook;
  const longTermOutlook = chipAnalysis.longTermOutlook;

  // 确定入场策略
  const entryStrategy = determineEntryStrategy(
    direction,
    currentPrice,
    mergedKeyLevels,
    chipAnalysis,
    patternAnalysis,
    confidenceScore
  );

  // 确定出场策略
  const exitStrategy = determineExitStrategy(
    direction,
    currentPrice,
    mergedKeyLevels,
    entryStrategy.idealEntryPrice,
    chipAnalysis,
    patternAnalysis
  );

  // 风险管理策略
  const riskManagement = determineRiskManagement(
    direction,
    entryStrategy,
    exitStrategy,
    confidenceScore,
    signalStrength
  );

  // 生成警告信息
  const warnings = generateWarnings(
    chipAnalysis,
    patternAnalysis,
    direction,
    signalStrength
  );

  // 生成确认信号
  const confirmationSignals = generateConfirmationSignals(
    direction,
    chipAnalysis,
    patternAnalysis
  );

  // 生成无效信号条件
  const invalidationConditions = generateInvalidationConditions(
    direction,
    chipAnalysis,
    patternAnalysis,
    mergedKeyLevels,
    exitStrategy
  );

  // 提取关键观察点
  const keyObservations = generateKeyObservations(
    chipAnalysis,
    patternAnalysis,
    direction,
    mergedKeyLevels
  );

  // 生成理由描述
  const primaryRationale = generatePrimaryRationale(
    direction,
    chipAnalysis,
    patternAnalysis,
    normalizedWeights
  );

  const secondaryRationale = generateSecondaryRationale(
    direction,
    chipAnalysis,
    patternAnalysis,
    timeframeConsistency,
    timeframeConsistencyStrength
  );

  // 生成总结
  const summary = generateSummary(
    symbol,
    direction,
    signalStrength,
    confidenceScore,
    primaryRationale,
    entryStrategy.idealEntryPrice,
    exitStrategy.takeProfitLevels[0]?.price,
    exitStrategy.stopLossLevels[0]?.price
  );

  // 添加趋势逆转信息处理
  let trendReversalInfo = undefined;
  if (
    patternAnalysis.reversalSignals &&
    patternAnalysis.reversalSignals.length > 0
  ) {
    const primaryReversalSignal = patternAnalysis.primaryReversalSignal;

    trendReversalInfo = {
      hasReversalSignal: true,
      primaryReversalSignal,
      reversalSignalStrength: primaryReversalSignal?.reversalStrength || 0,
      smallTimeframe: primaryReversalSignal?.smallTimeframe,
      largeTimeframe: primaryReversalSignal?.largeTimeframe,
      reversalDirection: primaryReversalSignal?.direction,
      entryPrice: primaryReversalSignal?.entryPrice,
      stopLoss: primaryReversalSignal?.stopLoss,
      description: `检测到${primaryReversalSignal?.smallTimeframe}周期从逆势调整转为顺应${primaryReversalSignal?.largeTimeframe}大趋势，${primaryReversalSignal?.direction > 0 ? '做多' : '做空'}信号`,
    };

    // 如果存在强趋势逆转信号，将其添加到警告或关键观察中
    if (primaryReversalSignal && primaryReversalSignal.reversalStrength > 70) {
      keyObservations.unshift(
        `强烈的小周期顺势逆转信号: ${primaryReversalSignal.smallTimeframe}周期趋势逆转并顺从${primaryReversalSignal.largeTimeframe}周期趋势，信号强度: ${primaryReversalSignal.reversalStrength.toFixed(1)}/100`
      );
    }
  } else {
    trendReversalInfo = {
      hasReversalSignal: false,
      description: '未检测到小周期顺势逆转信号',
    };
  }

  // 构建完整的交易计划
  return {
    symbol,
    currentPrice,
    date,

    direction,
    signalStrength,
    confidenceScore,

    chipAnalysisWeight: normalizedWeights.chip,
    patternAnalysisWeight: normalizedWeights.pattern,
    chipAnalysisContribution:
      Math.abs(chipWeightedScore) / normalizedWeights.chip,
    patternAnalysisContribution:
      Math.abs(patternWeightedScore) / normalizedWeights.pattern,

    summary,
    primaryRationale,
    secondaryRationale,
    warnings,

    primaryTimeframe,
    timeframeConsistency,
    shortTermOutlook,
    mediumTermOutlook,
    longTermOutlook,

    entryStrategy,
    exitStrategy,
    riskManagement,
    keyLevels: mergedKeyLevels,
    confirmationSignals,
    invalidationConditions,
    keyObservations,
    trendReversalInfo,
  };
}

/**
 * 确定入场策略
 */
function determineEntryStrategy(
  direction: TradeDirection,
  currentPrice: number,
  keyLevels: KeyLevel[],
  chipAnalysis: MultiTimeframeAnalysisResult,
  patternAnalysis: ComprehensivePatternAnalysis,
  confidenceScore: number
): IntegratedTradePlan['entryStrategy'] {
  // 默认入场策略
  const entryStrategy: IntegratedTradePlan['entryStrategy'] = {
    idealEntryPrice: currentPrice,
    alternativeEntryPrice: currentPrice,
    entryType: 'immediate',
    entryConditions: [],
    priceZones: {
      ideal: [currentPrice * 0.99, currentPrice * 1.01],
      acceptable: [currentPrice * 0.98, currentPrice * 1.02],
    },
    timeWindow: '1-3个交易日内',
    riskLevel: RiskLevel.Medium,
  };

  // 根据交易方向确定入场策略
  if (direction === TradeDirection.Long) {
    // 寻找当前价格下方最近的支撑位
    const supportLevels = keyLevels
      .filter(level => level.type === 'support' && level.price < currentPrice)
      .sort((a, b) => b.price - a.price);

    if (supportLevels.length > 0) {
      // 如果有支撑位，建议在回调至支撑位时入场
      entryStrategy.idealEntryPrice = supportLevels[0].price;
      entryStrategy.entryType = 'pullback';
      entryStrategy.priceZones.ideal = [
        supportLevels[0].price * 0.99,
        supportLevels[0].price * 1.01,
      ];

      if (supportLevels.length > 1) {
        entryStrategy.alternativeEntryPrice = supportLevels[1].price;
        entryStrategy.priceZones.acceptable = [
          supportLevels[1].price * 0.99,
          supportLevels[0].price * 1.01,
        ];
      } else {
        entryStrategy.priceZones.acceptable = [
          supportLevels[0].price * 0.97,
          supportLevels[0].price * 1.02,
        ];
      }
    } else {
      // 如果没有清晰的支撑位，考虑突破当前价格上方的阻力位
      const resistanceLevels = keyLevels
        .filter(
          level => level.type === 'resistance' && level.price > currentPrice
        )
        .sort((a, b) => a.price - b.price);

      if (
        resistanceLevels.length > 0 &&
        (resistanceLevels[0].price - currentPrice) / currentPrice < 0.05
      ) {
        // 如果最近的阻力位不超过当前价格5%，考虑突破入场
        entryStrategy.idealEntryPrice = resistanceLevels[0].price * 1.01;
        entryStrategy.entryType = 'breakout';
        entryStrategy.priceZones.ideal = [
          resistanceLevels[0].price,
          resistanceLevels[0].price * 1.02,
        ];
        entryStrategy.priceZones.acceptable = [
          resistanceLevels[0].price * 0.99,
          resistanceLevels[0].price * 1.03,
        ];
      }
    }

    // 添加入场条件
    entryStrategy.entryConditions = [
      {
        type: 'price',
        description:
          entryStrategy.entryType === 'pullback'
            ? `价格回调至${entryStrategy.idealEntryPrice.toFixed(2)}附近的支撑位`
            : entryStrategy.entryType === 'breakout'
              ? `价格突破${entryStrategy.idealEntryPrice.toFixed(2)}阻力位`
              : `价格接近${entryStrategy.idealEntryPrice.toFixed(2)}`,
        priority: 'critical',
      },
      {
        type: 'volume',
        description:
          entryStrategy.entryType === 'pullback'
            ? '回调时成交量萎缩，反弹时成交量放大'
            : '突破时成交量明显放大',
        priority: 'important',
      },
    ];

    // 添加形态相关条件
    if (
      patternAnalysis.timeframeAnalyses.some(
        tfa =>
          tfa.dominantPattern &&
          tfa.dominantPattern.direction === PatternDirection.Bullish &&
          tfa.dominantPattern.reliability > 70
      )
    ) {
      entryStrategy.entryConditions.push({
        type: 'pattern',
        description: '确认技术形态完成且未出现失败信号',
        priority: 'important',
      });
    }
  } else if (direction === TradeDirection.Short) {
    // 寻找当前价格上方最近的阻力位
    const resistanceLevels = keyLevels
      .filter(
        level => level.type === 'resistance' && level.price > currentPrice
      )
      .sort((a, b) => a.price - b.price);

    if (resistanceLevels.length > 0) {
      // 如果有阻力位，建议在反弹至阻力位时入场
      entryStrategy.idealEntryPrice = resistanceLevels[0].price;
      entryStrategy.entryType = 'pullback';
      entryStrategy.priceZones.ideal = [
        resistanceLevels[0].price * 0.99,
        resistanceLevels[0].price * 1.01,
      ];

      if (resistanceLevels.length > 1) {
        entryStrategy.alternativeEntryPrice = resistanceLevels[1].price;
        entryStrategy.priceZones.acceptable = [
          resistanceLevels[0].price * 0.99,
          resistanceLevels[1].price * 1.01,
        ];
      } else {
        entryStrategy.priceZones.acceptable = [
          resistanceLevels[0].price * 0.98,
          resistanceLevels[0].price * 1.03,
        ];
      }
    } else {
      // 如果没有清晰的阻力位，考虑突破当前价格下方的支撑位
      const supportLevels = keyLevels
        .filter(level => level.type === 'support' && level.price < currentPrice)
        .sort((a, b) => b.price - a.price);

      if (
        supportLevels.length > 0 &&
        (currentPrice - supportLevels[0].price) / currentPrice < 0.05
      ) {
        // 如果最近的支撑位不超过当前价格下方5%，考虑突破入场
        entryStrategy.idealEntryPrice = supportLevels[0].price * 0.99;
        entryStrategy.entryType = 'breakout';
        entryStrategy.priceZones.ideal = [
          supportLevels[0].price * 0.98,
          supportLevels[0].price,
        ];
        entryStrategy.priceZones.acceptable = [
          supportLevels[0].price * 0.97,
          supportLevels[0].price * 1.01,
        ];
      }
    }

    // 添加入场条件
    entryStrategy.entryConditions = [
      {
        type: 'price',
        description:
          entryStrategy.entryType === 'pullback'
            ? `价格反弹至${entryStrategy.idealEntryPrice.toFixed(2)}附近的阻力位`
            : entryStrategy.entryType === 'breakout'
              ? `价格突破${entryStrategy.idealEntryPrice.toFixed(2)}支撑位`
              : `价格接近${entryStrategy.idealEntryPrice.toFixed(2)}`,
        priority: 'critical',
      },
      {
        type: 'volume',
        description:
          entryStrategy.entryType === 'pullback'
            ? '反弹时成交量萎缩，下跌时成交量放大'
            : '突破时成交量明显放大',
        priority: 'important',
      },
    ];

    // 添加形态相关条件
    if (
      patternAnalysis.timeframeAnalyses.some(
        tfa =>
          tfa.dominantPattern &&
          tfa.dominantPattern.direction === PatternDirection.Bearish &&
          tfa.dominantPattern.reliability > 70
      )
    ) {
      entryStrategy.entryConditions.push({
        type: 'pattern',
        description: '确认技术形态完成且未出现失败信号',
        priority: 'important',
      });
    }
  }

  // 根据信号强度和一致性调整入场策略
  if (confidenceScore > 80) {
    // 高度确信的信号可以更积极入场
    if (entryStrategy.entryType === 'immediate') {
      entryStrategy.entryConditions.push({
        type: 'time',
        description: '可以立即入场，不需要额外确认信号',
        priority: 'optional',
      });
    } else {
      entryStrategy.timeWindow = '1-2个交易日内';
    }
    entryStrategy.riskLevel = RiskLevel.Low;
  } else if (confidenceScore < 50) {
    // 低确信度的信号需要更谨慎
    entryStrategy.entryConditions.push({
      type: 'indicator',
      description: '等待其他技术指标确认信号后再入场',
      priority: 'important',
    });
    entryStrategy.timeWindow = '3-5个交易日内耐心等待合适入场点';
    entryStrategy.riskLevel = RiskLevel.High;
  }

  return entryStrategy;
}

/**
 * 确定出场策略
 */
function determineExitStrategy(
  direction: TradeDirection,
  currentPrice: number,
  keyLevels: KeyLevel[],
  entryPrice: number,
  chipAnalysis: MultiTimeframeAnalysisResult,
  patternAnalysis: ComprehensivePatternAnalysis
): IntegratedTradePlan['exitStrategy'] {
  // 默认出场策略
  const exitStrategy: IntegratedTradePlan['exitStrategy'] = {
    takeProfitLevels: [],
    stopLossLevels: [],
    timeBasedExit: '持仓超过30个交易日且没有明显向有利方向发展时考虑退出',
    maximumHoldingPeriod: '45个交易日',
  };

  // 确定止盈位
  if (direction === TradeDirection.Long) {
    // 找出当前价格上方的阻力位
    const resistanceLevels = keyLevels
      .filter(level => level.type === 'resistance' && level.price > entryPrice)
      .sort((a, b) => a.price - b.price);

    // 从形态分析中找出目标价位
    const patternTargets = patternAnalysis.timeframeAnalyses
      .filter(
        tfa =>
          tfa.dominantPattern &&
          tfa.dominantPattern.direction === PatternDirection.Bullish
      )
      .map(tfa => tfa.dominantPattern?.priceTarget)
      .filter(price => price && price > entryPrice)
      .sort((a, b) => (a || 0) - (b || 0));

    // 组合阻力位和目标价位
    const takeProfitCandidates = [
      ...resistanceLevels.map(r => r.price),
      ...patternTargets,
    ]
      .filter(Boolean)
      .sort((a, b) => a - b);

    // 选择1-3个止盈位
    if (takeProfitCandidates.length > 0) {
      // 第一个止盈位（短期）
      const firstTP = takeProfitCandidates[0];
      const firstTPRatio = (firstTP - entryPrice) / entryPrice;

      exitStrategy.takeProfitLevels.push({
        price: firstTP,
        proportion: 0.3, // 30%仓位
        reasoning: `第一个阻力位，约${(firstTPRatio * 100).toFixed(1)}%收益`,
      });

      // 第二个止盈位（中期）
      if (takeProfitCandidates.length > 1) {
        const secondTP = takeProfitCandidates[1];
        const secondTPRatio = (secondTP - entryPrice) / entryPrice;

        exitStrategy.takeProfitLevels.push({
          price: secondTP,
          proportion: 0.4, // 40%仓位
          reasoning: `第二个阻力位/目标价，约${(secondTPRatio * 100).toFixed(1)}%收益`,
        });

        // 第三个止盈位（长期）
        if (takeProfitCandidates.length > 2) {
          const thirdTP = takeProfitCandidates[2];
          const thirdTPRatio = (thirdTP - entryPrice) / entryPrice;

          exitStrategy.takeProfitLevels.push({
            price: thirdTP,
            proportion: 0.3, // 剩余30%仓位
            reasoning: `长期目标价/主要阻力位，约${(thirdTPRatio * 100).toFixed(1)}%收益`,
          });
        } else {
          // 如果没有第三个明确的阻力位，计算一个基于前两个的延伸目标
          const extrapolatedTP = secondTP + (secondTP - firstTP);
          const extrapolatedTPRatio =
            (extrapolatedTP - entryPrice) / entryPrice;

          exitStrategy.takeProfitLevels.push({
            price: extrapolatedTP,
            proportion: 0.3, // 剩余30%仓位
            reasoning: `基于图表投射的延伸目标，约${(extrapolatedTPRatio * 100).toFixed(1)}%收益`,
          });
        }
      } else {
        // 如果只有一个阻力位，根据该位置计算更远的目标
        const projectedTP = firstTP * 1.05; // 简单地增加5%
        const projectedTPRatio = (projectedTP - entryPrice) / entryPrice;

        exitStrategy.takeProfitLevels.push({
          price: projectedTP,
          proportion: 0.7, // 剩余70%仓位
          reasoning: `基于唯一阻力位推算的延伸目标，约${(projectedTPRatio * 100).toFixed(1)}%收益`,
        });
      }
    } else {
      // 如果没有清晰的阻力位，设置百分比目标
      exitStrategy.takeProfitLevels.push({
        price: entryPrice * 1.05, // 5% 利润
        proportion: 0.5, // 50% 仓位
        reasoning: '基于入场价格5%涨幅的初始目标',
      });

      exitStrategy.takeProfitLevels.push({
        price: entryPrice * 1.1, // 10% 利润
        proportion: 0.5, // 剩余50% 仓位
        reasoning: '基于入场价格10%涨幅的延伸目标',
      });
    }
  } else if (direction === TradeDirection.Short) {
    // 找出当前价格下方的支撑位
    const supportLevels = keyLevels
      .filter(level => level.type === 'support' && level.price < entryPrice)
      .sort((a, b) => b.price - a.price);

    // 从形态分析中找出目标价位
    const patternTargets = patternAnalysis.timeframeAnalyses
      .filter(
        tfa =>
          tfa.dominantPattern &&
          tfa.dominantPattern.direction === PatternDirection.Bearish
      )
      .map(tfa => tfa.dominantPattern?.priceTarget)
      .filter(price => price && price < entryPrice)
      .sort((a, b) => (b || 0) - (a || 0));

    // 组合支撑位和目标价位
    const takeProfitCandidates = [
      ...supportLevels.map(r => r.price),
      ...patternTargets,
    ]
      .filter(Boolean)
      .sort((a, b) => b - a); // 降序排列，先找最高的支撑位

    // 选择1-3个止盈位
    if (takeProfitCandidates.length > 0) {
      // 第一个止盈位（短期）
      const firstTP = takeProfitCandidates[0];
      const firstTPRatio = (entryPrice - firstTP) / entryPrice;

      exitStrategy.takeProfitLevels.push({
        price: firstTP,
        proportion: 0.3, // 30% 仓位
        reasoning: `第一个支撑位，约${(firstTPRatio * 100).toFixed(1)}%收益`,
      });

      // 第二个止盈位（中期）
      if (takeProfitCandidates.length > 1) {
        const secondTP = takeProfitCandidates[1];
        const secondTPRatio = (entryPrice - secondTP) / entryPrice;

        exitStrategy.takeProfitLevels.push({
          price: secondTP,
          proportion: 0.4, // 40% 仓位
          reasoning: `第二个支撑位/目标价，约${(secondTPRatio * 100).toFixed(1)}%收益`,
        });

        // 第三个止盈位（长期）
        if (takeProfitCandidates.length > 2) {
          const thirdTP = takeProfitCandidates[2];
          const thirdTPRatio = (entryPrice - thirdTP) / entryPrice;

          exitStrategy.takeProfitLevels.push({
            price: thirdTP,
            proportion: 0.3, // 剩余30% 仓位
            reasoning: `长期目标价/主要支撑位，约${(thirdTPRatio * 100).toFixed(1)}%收益`,
          });
        } else {
          // 如果没有第三个支撑位，计算延伸目标
          const extrapolatedTP = secondTP - (firstTP - secondTP);
          const extrapolatedTPRatio =
            (entryPrice - extrapolatedTP) / entryPrice;

          exitStrategy.takeProfitLevels.push({
            price: extrapolatedTP,
            proportion: 0.3, // 剩余30% 仓位
            reasoning: `基于图表投射的延伸目标，约${(extrapolatedTPRatio * 100).toFixed(1)}%收益`,
          });
        }
      } else {
        // 如果只有一个支撑位，根据该位置计算更远的目标
        const projectedTP = firstTP * 0.95; // 简单地降低5%
        const projectedTPRatio = (entryPrice - projectedTP) / entryPrice;

        exitStrategy.takeProfitLevels.push({
          price: projectedTP,
          proportion: 0.7, // 剩余70% 仓位
          reasoning: `基于唯一支撑位推算的延伸目标，约${(projectedTPRatio * 100).toFixed(1)}%收益`,
        });
      }
    } else {
      // 如果没有清晰的支撑位，设置百分比目标
      exitStrategy.takeProfitLevels.push({
        price: entryPrice * 0.95, // 做空5% 利润
        proportion: 0.5, // 50% 仓位
        reasoning: '基于入场价格5%跌幅的初始目标',
      });

      exitStrategy.takeProfitLevels.push({
        price: entryPrice * 0.9, // 做空10% 利润
        proportion: 0.5, // 剩余50% 仓位
        reasoning: '基于入场价格10%跌幅的延伸目标',
      });
    }
  }

  // 确定止损位置
  if (direction === TradeDirection.Long) {
    // 做多仓位的止损设置
    const potentialStopLevels: number[] = [];

    // 首先查找入场价下方的支撑位
    const supportLevels = keyLevels
      .filter(level => level.type === 'support' && level.price < entryPrice)
      .sort((a, b) => b.price - a.price);

    if (supportLevels.length > 0) {
      // 使用最高的支撑位下方作为止损
      potentialStopLevels.push(supportLevels[0].price * 0.99);

      // 如果有第二个支撑位，也考虑作为备选止损
      if (supportLevels.length > 1) {
        potentialStopLevels.push(supportLevels[1].price * 0.99);
      }
    }

    // 查找形态分析中的止损建议
    const patternStopLoss = findPatternStopLoss(patternAnalysis, direction);
    if (patternStopLoss && patternStopLoss < entryPrice) {
      potentialStopLevels.push(patternStopLoss);
    }

    // 如果没有找到合适的止损位，使用固定百分比止损
    if (potentialStopLevels.length === 0) {
      potentialStopLevels.push(entryPrice * 0.95); // 入场价下方5%
    }

    // 将止损位添加到策略中
    exitStrategy.stopLossLevels = potentialStopLevels.map((price, index) => {
      const stopRatio = (entryPrice - price) / entryPrice;
      return {
        price,
        type: index === 0 ? 'fixed' : 'trailing',
        reasoning:
          index === 0
            ? `主要止损位，风险${(stopRatio * 100).toFixed(1)}%`
            : `次要止损位，风险${(stopRatio * 100).toFixed(1)}%`,
      };
    });
  } else if (direction === TradeDirection.Short) {
    // 做空仓位的止损设置
    const potentialStopLevels: number[] = [];

    // 查找入场价上方的阻力位
    const resistanceLevels = keyLevels
      .filter(level => level.type === 'resistance' && level.price > entryPrice)
      .sort((a, b) => a.price - b.price);

    if (resistanceLevels.length > 0) {
      // 使用最低的阻力位上方作为止损
      potentialStopLevels.push(resistanceLevels[0].price * 1.01);

      // 如果有第二个阻力位，也考虑作为备选止损
      if (resistanceLevels.length > 1) {
        potentialStopLevels.push(resistanceLevels[1].price * 1.01);
      }
    }

    // 查找形态分析中的止损建议
    const patternStopLoss = findPatternStopLoss(patternAnalysis, direction);
    if (patternStopLoss && patternStopLoss > entryPrice) {
      potentialStopLevels.push(patternStopLoss);
    }

    // 如果没有找到合适的止损位，使用固定百分比止损
    if (potentialStopLevels.length === 0) {
      potentialStopLevels.push(entryPrice * 1.05); // 入场价上方5%
    }

    // 将止损位添加到策略中
    exitStrategy.stopLossLevels = potentialStopLevels.map((price, index) => {
      const stopRatio = (price - entryPrice) / entryPrice;
      return {
        price,
        type: index === 0 ? 'fixed' : 'trailing',
        reasoning:
          index === 0
            ? `主要止损位，风险${(stopRatio * 100).toFixed(1)}%`
            : `次要止损位，风险${(stopRatio * 100).toFixed(1)}%`,
      };
    });
  }

  // 设置时间退出策略
  const volatilityAdjustment = isHighVolatility(chipAnalysis, patternAnalysis)
    ? 1.5
    : 1;
  const baseHoldingPeriod = 30;

  exitStrategy.timeBasedExit = `持仓${Math.round(baseHoldingPeriod * volatilityAdjustment)}个交易日后仍未达到第一个止盈位，考虑减仓或退出`;
  exitStrategy.maximumHoldingPeriod = `${Math.round(baseHoldingPeriod * 1.5 * volatilityAdjustment)}个交易日，无论盈亏均考虑清仓`;

  return exitStrategy;
}

/**
 * 从形态分析中找出止损位建议
 */
function findPatternStopLoss(
  patternAnalysis: ComprehensivePatternAnalysis,
  direction: TradeDirection
): number | null {
  // 寻找与交易方向一致且可靠性高的形态
  const relevantPatterns = patternAnalysis.timeframeAnalyses
    .filter(
      tfa =>
        tfa.dominantPattern &&
        ((tfa.dominantPattern.direction === PatternDirection.Bullish &&
          direction === TradeDirection.Long) ||
          (tfa.dominantPattern.direction === PatternDirection.Bearish &&
            direction === TradeDirection.Short)) &&
        tfa.dominantPattern.reliability > 60
    )
    .map(tfa => tfa.dominantPattern);

  // 如果有多个形态，按照可靠性降序排序
  relevantPatterns.sort(
    (a, b) => (b?.reliability || 0) - (a?.reliability || 0)
  );

  // 返回最可靠形态的止损建议
  return relevantPatterns[0]?.stopLoss || null;
}

/**
 * 评估市场波动性
 */
function isHighVolatility(
  chipAnalysis: MultiTimeframeAnalysisResult,
  patternAnalysis: ComprehensivePatternAnalysis
): boolean {
  // 从筹码分析中获取波动性指标
  const hasConflictingSignals = chipAnalysis.timeframeConflicts.length > 0;

  // 从形态分析中获取波动性指标
  const hasVolatilePatterns = patternAnalysis.timeframeAnalyses.some(
    tfa =>
      tfa.dominantPattern &&
      ['rising_wedge', 'falling_wedge', 'flag', 'pennant'].includes(
        tfa.dominantPattern.patternType
      )
  );

  // 如果日线和短线趋势方向相反，也认为是高波动性
  const divergentTimeframes =
    (chipAnalysis.shortTermOutlook.includes('看多') &&
      chipAnalysis.mediumTermOutlook.includes('看空')) ||
    (chipAnalysis.shortTermOutlook.includes('看空') &&
      chipAnalysis.mediumTermOutlook.includes('看多'));

  return hasConflictingSignals || hasVolatilePatterns || divergentTimeframes;
}

/**
 * 确定风险管理策略
 */
function determineRiskManagement(
  direction: TradeDirection,
  entryStrategy: IntegratedTradePlan['entryStrategy'],
  exitStrategy: IntegratedTradePlan['exitStrategy'],
  confidenceScore: number,
  signalStrength: SignalStrength
): IntegratedTradePlan['riskManagement'] {
  // 默认风险管理参数
  const riskManagement: IntegratedTradePlan['riskManagement'] = {
    suggestionPosition: 0.1, // 默认使用10%的账户资金
    riskRewardRatio: 1.0,
    maxLoss: '账户总资金的1%',
    volatilityConsideration: '标准波动性考虑',
    adjustmentTriggers: [],
  };

  // 根据信号强度调整仓位
  if (signalStrength === SignalStrength.Strong) {
    riskManagement.suggestionPosition = 0.2; // 强信号使用20%资金
  } else if (signalStrength === SignalStrength.Moderate) {
    riskManagement.suggestionPosition = 0.15; // 中等信号使用15%资金
  } else if (signalStrength === SignalStrength.Weak) {
    riskManagement.suggestionPosition = 0.1; // 弱信号使用10%资金
  } else if (
    signalStrength === SignalStrength.Neutral ||
    signalStrength === SignalStrength.Conflicting
  ) {
    riskManagement.suggestionPosition = 0.05; // 中性或冲突信号使用5%资金
  }

  // 根据信心分数调整
  riskManagement.suggestionPosition *= 0.5 + confidenceScore / 200; // 增加或减少高达50%的仓位

  // 根据入场策略的风险级别调整
  if (entryStrategy.riskLevel === RiskLevel.High) {
    riskManagement.suggestionPosition *= 0.7; // 高风险入场减少30%仓位
  } else if (entryStrategy.riskLevel === RiskLevel.Low) {
    riskManagement.suggestionPosition *= 1.2; // 低风险入场增加20%仓位
  }

  // 确保仓位在合理范围内
  riskManagement.suggestionPosition = Math.min(
    0.3,
    Math.max(0.05, riskManagement.suggestionPosition)
  );

  // 计算风险回报比
  if (
    exitStrategy.takeProfitLevels.length > 0 &&
    exitStrategy.stopLossLevels.length > 0
  ) {
    const potentialReward = calculateWeightedReward(
      direction,
      entryStrategy.idealEntryPrice,
      exitStrategy.takeProfitLevels
    );
    const potentialRisk = Math.abs(
      entryStrategy.idealEntryPrice - exitStrategy.stopLossLevels[0].price
    );

    riskManagement.riskRewardRatio = potentialReward / potentialRisk;
  }

  // 设置最大损失
  const maxLossPercentage =
    1 - riskManagement.suggestionPosition > 0.95
      ? 1.0 // 如果仓位很小，风险较低
      : 2.0; // 如果仓位较大，可接受更高风险

  riskManagement.maxLoss = `账户总资金的${maxLossPercentage.toFixed(1)}%`;

  // 设置波动性考虑
  if (entryStrategy.riskLevel === RiskLevel.High) {
    riskManagement.volatilityConsideration =
      '高波动性市场，建议使用更紧的止损和分批建仓';
    riskManagement.adjustmentTriggers.push(
      '如果波动性增加超过30%，考虑减少50%仓位'
    );
  } else if (entryStrategy.riskLevel === RiskLevel.Low) {
    riskManagement.volatilityConsideration =
      '低波动性市场，可以稍微放宽止损并一次性建仓';
  } else {
    riskManagement.volatilityConsideration =
      '中等波动性市场，建议分2-3批建仓并设置适中止损';
    riskManagement.adjustmentTriggers.push(
      '如果波动性增加超过50%，考虑减少30%仓位'
    );
  }

  // 设置调整触发条件
  riskManagement.adjustmentTriggers.push(
    '当价格达到第一个止盈位时，将止损上调至成本价'
  );

  if (confidenceScore < 60) {
    riskManagement.adjustmentTriggers.push(
      '如果交易初期出现不利走势，可提前减仓50%'
    );
  }

  return riskManagement;
}

/**
 * 计算加权平均潜在收益
 */
function calculateWeightedReward(
  direction: TradeDirection,
  entryPrice: number,
  takeProfitLevels: Array<{
    price: number;
    proportion: number;
    reasoning: string;
  }>
): number {
  if (takeProfitLevels.length === 0) return 0;

  let weightedReward = 0;
  let totalProportion = 0;

  for (const level of takeProfitLevels) {
    const reward =
      direction === TradeDirection.Long
        ? level.price - entryPrice
        : entryPrice - level.price;

    weightedReward += reward * level.proportion;
    totalProportion += level.proportion;
  }

  return totalProportion > 0 ? weightedReward / totalProportion : 0;
}

/**
 * 生成警告信息
 */
function generateWarnings(
  chipAnalysis: MultiTimeframeAnalysisResult,
  patternAnalysis: ComprehensivePatternAnalysis,
  direction: TradeDirection,
  signalStrength: SignalStrength
): string[] {
  const warnings: string[] = [];

  // 检查信号强度
  if (signalStrength === SignalStrength.Weak) {
    warnings.push('信号强度较弱，建议减小仓位并严格设置止损');
  } else if (signalStrength === SignalStrength.Conflicting) {
    warnings.push('筹码分析与形态分析出现信号冲突，建议额外谨慎');
  }

  // 检查时间周期冲突
  if (chipAnalysis.timeframeConflicts.length > 0) {
    warnings.push(
      `存在时间周期冲突: ${chipAnalysis.timeframeConflicts.join('; ')}`
    );
  }

  // 检查趋势一致性
  if (chipAnalysis.trendConsistency === '弱') {
    warnings.push('趋势一致性较弱，各时间周期走势不明朗');
  }

  // 检查形态分析的可靠性
  if (patternAnalysis.signalStrength < 50) {
    warnings.push('图表形态信号不够明确，请寻求额外确认');
  }

  // 检查方向与多数时间周期的一致性
  if (
    direction === TradeDirection.Long &&
    chipAnalysis.timeframeAlignment.includes('看空')
  ) {
    warnings.push('多数时间周期呈看空状态，与当前交易方向冲突');
  } else if (
    direction === TradeDirection.Short &&
    chipAnalysis.timeframeAlignment.includes('看多')
  ) {
    warnings.push('多数时间周期呈看多状态，与当前交易方向冲突');
  }

  // 检查主要时间周期与长期趋势的一致性
  if (
    direction === TradeDirection.Long &&
    chipAnalysis.longTermOutlook.includes('看空')
  ) {
    warnings.push('长期趋势看空，当前多头操作可能是逆势交易');
  } else if (
    direction === TradeDirection.Short &&
    chipAnalysis.longTermOutlook.includes('看多')
  ) {
    warnings.push('长期趋势看多，当前空头操作可能是逆势交易');
  }

  // 检查获利筹码比例（如果适用）
  const timeframe = chipAnalysis.timeframes.find(
    tf => tf.timeframe === chipAnalysis.primaryTimeframe
  );
  if (
    timeframe &&
    direction === TradeDirection.Long &&
    timeframe.analysis.profitChipsPercentage > 80
  ) {
    warnings.push('获利筹码比例过高，可能面临较大抛压');
  } else if (
    timeframe &&
    direction === TradeDirection.Short &&
    timeframe.analysis.profitChipsPercentage < 20
  ) {
    warnings.push('套牢筹码比例过高，可能面临较强支撑');
  }

  return warnings;
}

/**
 * 生成确认信号条件
 */
function generateConfirmationSignals(
  direction: TradeDirection,
  chipAnalysis: MultiTimeframeAnalysisResult,
  patternAnalysis: ComprehensivePatternAnalysis
): TradeCondition[] {
  const confirmationSignals: TradeCondition[] = [];

  // 添加成交量确认条件
  if (direction === TradeDirection.Long) {
    confirmationSignals.push({
      type: 'volume',
      description: '向上突破时成交量明显放大，至少高于前5日平均成交量的1.5倍',
      priority: 'important',
    });
  } else if (direction === TradeDirection.Short) {
    confirmationSignals.push({
      type: 'volume',
      description: '向下突破时成交量明显放大，至少高于前5日平均成交量的1.5倍',
      priority: 'important',
    });
  }

  // 添加形态确认条件
  const relevantPattern = patternAnalysis.timeframeAnalyses.find(
    tfa => tfa.timeframe === chipAnalysis.primaryTimeframe
  )?.dominantPattern;

  if (relevantPattern && relevantPattern.status === 'completed') {
    confirmationSignals.push({
      type: 'pattern',
      description: `确认${relevantPattern.patternType}形态完成突破，价格站稳颈线/突破位`,
      priority: 'critical',
    });
  }

  // 添加时间周期一致性确认
  if (
    chipAnalysis.timeframeAlignment.includes('中性') ||
    chipAnalysis.alignmentStrength < 70
  ) {
    confirmationSignals.push({
      type: 'indicator',
      description: '多个时间周期指标转向一致，确认交易方向',
      priority: 'important',
    });
  }

  // 添加价格行为确认
  if (direction === TradeDirection.Long) {
    confirmationSignals.push({
      type: 'price',
      description: '价格站稳关键阻力位上方，且收盘价连续2天保持在该位置上方',
      priority: 'important',
    });
  } else if (direction === TradeDirection.Short) {
    confirmationSignals.push({
      type: 'price',
      description: '价格跌破关键支撑位，且收盘价连续2天保持在该位置下方',
      priority: 'important',
    });
  }

  return confirmationSignals;
}

/**
 * 生成无效信号条件
 */
function generateInvalidationConditions(
  direction: TradeDirection,
  chipAnalysis: MultiTimeframeAnalysisResult,
  patternAnalysis: ComprehensivePatternAnalysis,
  keyLevels: KeyLevel[],
  exitStrategy: IntegratedTradePlan['exitStrategy']
): TradeCondition[] {
  const invalidationConditions: TradeCondition[] = [];

  // 添加止损触发条件
  if (exitStrategy.stopLossLevels.length > 0) {
    invalidationConditions.push({
      type: 'price',
      description: `价格触及主要止损位${exitStrategy.stopLossLevels[0].price.toFixed(2)}`,
      priority: 'critical',
    });
  }

  // 添加关键价位失效条件
  if (direction === TradeDirection.Long) {
    // 找出关键支撑位
    const criticalSupport = keyLevels
      .filter(level => level.type === 'support' && level.strength === 'strong')
      .sort((a, b) => b.price - a.price)[0];

    if (criticalSupport) {
      invalidationConditions.push({
        type: 'price',
        description: `价格跌破强支撑位${criticalSupport.price.toFixed(2)}且无法快速收复`,
        priority: 'important',
      });
    }
  } else if (direction === TradeDirection.Short) {
    // 找出关键阻力位
    const criticalResistance = keyLevels
      .filter(
        level => level.type === 'resistance' && level.strength === 'strong'
      )
      .sort((a, b) => a.price - b.price)[0];

    if (criticalResistance) {
      invalidationConditions.push({
        type: 'price',
        description: `价格突破强阻力位${criticalResistance.price.toFixed(2)}且无法快速回落`,
        priority: 'important',
      });
    }
  }

  // 添加形态失效条件
  const dominantPattern = patternAnalysis.timeframeAnalyses.find(
    tfa => tfa.timeframe === chipAnalysis.primaryTimeframe
  )?.dominantPattern;

  if (dominantPattern) {
    invalidationConditions.push({
      type: 'pattern',
      description: `${dominantPattern.patternType}形态失败，出现与预期相反的突破`,
      priority: 'important',
    });
  }

  // 添加时间周期转向条件
  invalidationConditions.push({
    type: 'indicator',
    description: `${chipAnalysis.primaryTimeframe === 'weekly' ? '周线' : chipAnalysis.primaryTimeframe === 'daily' ? '日线' : '小时'}指标发生明显转向，与交易方向相反`,
    priority: 'important',
  });

  // 添加市场环境变化条件
  invalidationConditions.push({
    type: 'time',
    description: '长时间（超过预期持仓时间一半）无法向有利方向发展',
    priority: 'optional',
  });

  return invalidationConditions;
}

/**
 * 生成关键观察点
 */
function generateKeyObservations(
  chipAnalysis: MultiTimeframeAnalysisResult,
  patternAnalysis: ComprehensivePatternAnalysis,
  direction: TradeDirection,
  keyLevels: KeyLevel[]
): string[] {
  const observations: string[] = [];

  // 获取时间周期优先级
  const timeframePriorities = assignTimeframePriorities(
    chipAnalysis.timeframes.map(tf => tf.timeframe),
    chipAnalysis.primaryTimeframe
  );

  // 添加各时间周期优先级信息
  observations.push(
    `时间周期优先级: 主要=${Object.keys(timeframePriorities).find(key => timeframePriorities[key] === TimeframePriority.Primary)}, 次要=${Object.keys(timeframePriorities).find(key => timeframePriorities[key] === TimeframePriority.Secondary)}, 第三=${Object.keys(timeframePriorities).find(key => timeframePriorities[key] === TimeframePriority.Tertiary)}`
  );

  // 添加筹码分布特征
  const primaryTimeframe = chipAnalysis.timeframes.find(
    tf => tf.timeframe === chipAnalysis.primaryTimeframe
  );

  if (primaryTimeframe) {
    observations.push(
      `${chipAnalysis.primaryTimeframe === 'weekly' ? '周线' : chipAnalysis.primaryTimeframe === 'daily' ? '日线' : '小时'}筹码集中度: ${primaryTimeframe.analysis.concentrationLevel}`
    );
    observations.push(`筹码形态: ${primaryTimeframe.analysis.chipShape}`);
    observations.push(
      `获利盘比例: ${primaryTimeframe.analysis.profitChipsPercentage.toFixed(1)}%`
    );
  }

  // 添加趋势特征
  observations.push(
    `趋势方向: ${chipAnalysis.trendDirection}, 一致性: ${chipAnalysis.trendConsistency}`
  );

  // 添加主要形态特征
  const dominantPattern = patternAnalysis.timeframeAnalyses.find(
    tfa => tfa.timeframe === chipAnalysis.primaryTimeframe
  )?.dominantPattern;

  if (dominantPattern) {
    observations.push(
      `主导形态: ${dominantPattern.patternType}, 可靠性: ${dominantPattern.reliability}/100`
    );
    observations.push(`形态描述: ${dominantPattern.description}`);
  }

  // 添加关键价位
  const supports = keyLevels
    .filter(level => level.type === 'support')
    .sort((a, b) => b.price - a.price);

  const resistances = keyLevels
    .filter(level => level.type === 'resistance')
    .sort((a, b) => a.price - b.price);

  if (supports.length > 0) {
    observations.push(
      `主要支撑位: ${supports
        .slice(0, Math.min(3, supports.length))
        .map(s => s.price.toFixed(2))
        .join(', ')}`
    );
  }

  if (resistances.length > 0) {
    observations.push(
      `主要阻力位: ${resistances
        .slice(0, Math.min(3, resistances.length))
        .map(r => r.price.toFixed(2))
        .join(', ')}`
    );
  }

  // 添加时间周期一致性
  observations.push(
    `时间周期一致性: ${chipAnalysis.timeframeAlignment}, 强度: ${chipAnalysis.alignmentStrength}%`
  );

  // 添加短中长期展望
  observations.push(
    `短期展望(小时): ${chipAnalysis.shortTermOutlook}, 中期展望(日线): ${chipAnalysis.mediumTermOutlook}, 长期展望(周线): ${chipAnalysis.longTermOutlook}`
  );

  return observations;
}

/**
 * 生成主要理由描述
 */
function generatePrimaryRationale(
  direction: TradeDirection,
  chipAnalysis: MultiTimeframeAnalysisResult,
  patternAnalysis: ComprehensivePatternAnalysis,
  weights: { chip: number; pattern: number }
): string {
  if (direction === TradeDirection.Neutral) {
    return '综合分析显示市场信号中性，无明确交易方向';
  }

  let rationale =
    direction === TradeDirection.Long ? '做多理由: ' : '做空理由: ';

  // 添加筹码分析理由
  if (direction === TradeDirection.Long) {
    if (chipAnalysis.combinedBuySignalStrength > 60) {
      rationale += `筹码分析显示强烈买入信号(${chipAnalysis.combinedBuySignalStrength}/100)，`;

      // 添加详细理由
      if (chipAnalysis.timeframeAlignment.includes('看多')) {
        rationale += `多个时间周期一致看多(${chipAnalysis.alignmentStrength}%)，`;
      }

      const primaryTimeframe = chipAnalysis.timeframes.find(
        tf => tf.timeframe === chipAnalysis.primaryTimeframe
      );

      if (primaryTimeframe) {
        if (primaryTimeframe.analysis.profitChipsPercentage < 50) {
          rationale += '获利筹码比例较低，抛压有限，';
        }

        if (primaryTimeframe.analysis.concentrationLevel.includes('高')) {
          rationale += '筹码分布集中，支撑强劲，';
        }
      }
    } else {
      rationale += `筹码分析显示中性偏多信号(${chipAnalysis.combinedBuySignalStrength}/100)，`;
    }
  } else {
    if (chipAnalysis.combinedShortSignalStrength > 60) {
      rationale += `筹码分析显示强烈卖出信号(${chipAnalysis.combinedShortSignalStrength}/100)，`;

      // 添加详细理由
      if (chipAnalysis.timeframeAlignment.includes('看空')) {
        rationale += `多个时间周期一致看空(${chipAnalysis.alignmentStrength}%)，`;
      }

      const primaryTimeframe = chipAnalysis.timeframes.find(
        tf => tf.timeframe === chipAnalysis.primaryTimeframe
      );

      if (primaryTimeframe) {
        if (primaryTimeframe.analysis.profitChipsPercentage > 70) {
          rationale += '获利筹码比例较高，抛压巨大，';
        }

        if (primaryTimeframe.analysis.concentrationLevel.includes('分散')) {
          rationale += '筹码分布分散，支撑较弱，';
        }
      }
    } else {
      rationale += `筹码分析显示中性偏空信号(${chipAnalysis.combinedShortSignalStrength}/100)，`;
    }
  }

  // 添加形态分析理由
  if (
    direction === TradeDirection.Long &&
    patternAnalysis.combinedSignal === PatternDirection.Bullish
  ) {
    rationale += `形态分析显示看涨信号(${patternAnalysis.signalStrength}/100)，`;

    // 添加主要形态描述
    const bullishPatterns = patternAnalysis.timeframeAnalyses
      .filter(
        tfa => tfa.dominantPattern?.direction === PatternDirection.Bullish
      )
      .sort(
        (a, b) =>
          (b.dominantPattern?.reliability || 0) -
          (a.dominantPattern?.reliability || 0)
      );

    if (bullishPatterns.length > 0 && bullishPatterns[0].dominantPattern) {
      rationale += `${bullishPatterns[0].timeframe === 'weekly' ? '周线' : bullishPatterns[0].timeframe === 'daily' ? '日线' : '小时'}出现${bullishPatterns[0].dominantPattern.patternType}形态，`;
    }
  } else if (
    direction === TradeDirection.Short &&
    patternAnalysis.combinedSignal === PatternDirection.Bearish
  ) {
    rationale += `形态分析显示看跌信号(${patternAnalysis.signalStrength}/100)，`;

    // 添加主要形态描述
    const bearishPatterns = patternAnalysis.timeframeAnalyses
      .filter(
        tfa => tfa.dominantPattern?.direction === PatternDirection.Bearish
      )
      .sort(
        (a, b) =>
          (b.dominantPattern?.reliability || 0) -
          (a.dominantPattern?.reliability || 0)
      );

    if (bearishPatterns.length > 0 && bearishPatterns[0].dominantPattern) {
      rationale += `${bearishPatterns[0].timeframe === 'weekly' ? '周线' : bearishPatterns[0].timeframe === 'daily' ? '日线' : '小时'}出现${bearishPatterns[0].dominantPattern.patternType}形态，`;
    }
  } else {
    rationale += '形态分析信号不明确，';
  }

  // 添加趋势分析
  rationale += `市场整体处于${chipAnalysis.trendDirection}，趋势一致性${chipAnalysis.trendConsistency}。`;

  return rationale;
}

/**
 * 生成次要理由描述
 */
function generateSecondaryRationale(
  direction: TradeDirection,
  chipAnalysis: MultiTimeframeAnalysisResult,
  patternAnalysis: ComprehensivePatternAnalysis,
  timeframeConsistency: string,
  timeframeConsistencyStrength: number
): string {
  if (direction === TradeDirection.Neutral) {
    return '各时间周期信号混合，建议观望等待更明确方向';
  }

  let rationale = '辅助理由: ';

  // 添加时间周期一致性
  if (timeframeConsistency === '看多' && direction === TradeDirection.Long) {
    rationale += `多个时间周期一致看多(${timeframeConsistencyStrength}%)，`;
  } else if (
    timeframeConsistency === '看空' &&
    direction === TradeDirection.Short
  ) {
    rationale += `多个时间周期一致看空(${timeframeConsistencyStrength}%)，`;
  } else if (timeframeConsistency === '中性') {
    rationale += '各时间周期呈中性状态，';
  } else {
    rationale += `时间周期一致性较弱(${timeframeConsistencyStrength}%)，`;
  }

  // 添加技术指标信号
  const primaryTimeframe = chipAnalysis.timeframes.find(
    tf => tf.timeframe === chipAnalysis.primaryTimeframe
  );

  if (primaryTimeframe) {
    rationale += `${chipAnalysis.primaryTimeframe === 'weekly' ? '周线' : chipAnalysis.primaryTimeframe === 'daily' ? '日线' : '小时'}技术指标: `;

    if (primaryTimeframe.analysis.macdSignal) {
      rationale += `MACD ${primaryTimeframe.analysis.macdSignal}，`;
    }

    if (primaryTimeframe.analysis.rsiLevel) {
      rationale += `RSI ${primaryTimeframe.analysis.rsiLevel}，`;
    }

    if (primaryTimeframe.analysis.bollingerStatus) {
      rationale += `布林带 ${primaryTimeframe.analysis.bollingerStatus}，`;
    }
  }

  // 添加支撑阻力位情况
  if (direction === TradeDirection.Long) {
    if (chipAnalysis.aggregatedSupportLevels.length > 0) {
      rationale += `多个时间周期确认的支撑位: ${chipAnalysis.aggregatedSupportLevels
        .slice(0, 2)
        .map(level => level.toFixed(2))
        .join(', ')}，`;
    }
  } else {
    if (chipAnalysis.aggregatedResistanceLevels.length > 0) {
      rationale += `多个时间周期确认的阻力位: ${chipAnalysis.aggregatedResistanceLevels
        .slice(0, 2)
        .map(level => level.toFixed(2))
        .join(', ')}，`;
    }
  }

  // 添加短中长期展望
  rationale += `短期(小时)${chipAnalysis.shortTermOutlook}，中期(日线)${chipAnalysis.mediumTermOutlook}，长期(周线)${chipAnalysis.longTermOutlook}。`;

  return rationale;
}

/**
 * 生成总结
 */
function generateSummary(
  symbol: string,
  direction: TradeDirection,
  signalStrength: SignalStrength,
  confidenceScore: number,
  primaryRationale: string,
  entryPrice: number,
  takeProfitPrice?: number,
  stopLossPrice?: number
): string {
  if (direction === TradeDirection.Neutral) {
    return `${symbol}当前无明确交易信号，建议观望等待更清晰的市场方向。信号强度: ${signalStrength}，确信度: ${confidenceScore.toFixed(2)}/100。`;
  }

  let summary = `${symbol}${direction === TradeDirection.Long ? '做多' : '做空'}信号，信号强度: ${signalStrength}，确信度: ${confidenceScore.toFixed(2)}/100。建议入场价格: ${entryPrice.toFixed(2)}`;

  if (takeProfitPrice) {
    summary += `，目标价格: ${takeProfitPrice.toFixed(2)}`;
  }

  if (stopLossPrice) {
    summary += `，止损价格: ${stopLossPrice.toFixed(2)}`;
  }

  summary += `。`;

  return summary;
}

/**
 * 执行综合分析并生成格式化输出
 * @param symbol 股票代码
 * @param customWeights 自定义权重设置
 * @returns 综合交易计划对象
 */
async function executeIntegratedAnalysis(
  symbol: string,
  customWeights: { chip: number; pattern: number } = { chip: 0.6, pattern: 0.4 } // 默认筹码分析权重更高
): Promise<IntegratedTradePlan> {
  // 获取不同时间周期的数据
  const today = new Date();

  const startDateWeekly = new Date();
  startDateWeekly.setDate(today.getDate() - 365); // 获取一年的数据

  const startDateDaily = new Date();
  startDateDaily.setDate(today.getDate() - 90); // 获取三个月的数据

  const startDateHourly = new Date();
  startDateHourly.setDate(today.getDate() - 30); // 获取一个月的数据

  // 获取周线、日线和小时线数据
  const weeklyData = await getStockDataForTimeframe(
    symbol,
    startDateWeekly,
    today,
    'weekly'
  );

  const dailyData = await getStockDataForTimeframe(
    symbol,
    startDateDaily,
    today,
    'daily'
  );

  const hourlyData = await getStockDataForTimeframe(
    symbol,
    startDateHourly,
    today,
    '1hour'
  );

  // 执行筹码分析
  const multiTimeframeChipDistResult = await multiTimeFrameChipDistAnalysis(
    symbol,
    'daily', // 主要时间周期
    ['weekly', 'daily', '1hour'],
    { weekly: 0.3, daily: 0.5, '1hour': 0.2 }, // 时间周期权重
    weeklyData,
    dailyData,
    hourlyData
  );

  // 执行形态分析
  const patternAnalysisResult = await multiTimeframePatternAnalysis(
    weeklyData,
    dailyData,
    hourlyData
  );

  // 整合分析结果
  return integrateAnalyses(
    multiTimeframeChipDistResult,
    patternAnalysisResult,
    customWeights
  );
}

// 导出所有主要函数和接口
export {
  integrateAnalyses,
  determineEntryStrategy,
  determineExitStrategy,
  determineRiskManagement,
  generateWarnings,
  generateConfirmationSignals,
  generateInvalidationConditions,
  generateKeyObservations,
  generatePrimaryRationale,
  generateSecondaryRationale,
  generateSummary,
  executeIntegratedAnalysis,
  assignTimeframePriorities,
};
