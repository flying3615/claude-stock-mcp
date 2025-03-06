/**
 * 定义股票分析相关的基本类型
 */

// 趋势反转信号类型
export interface TrendReversalSignal {
  smallTimeframe: string;
  largeTimeframe: string;
  direction: number;
  reversalStrength: number;
  entryPrice?: number;
  stopLoss?: number;
  description: string;
}

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

  // 趋势逆转信息
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
