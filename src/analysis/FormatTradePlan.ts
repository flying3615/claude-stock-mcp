import { IntegratedTradePlan } from './IntegratedAnalysis.js';

/**
 * 格式化交易计划输出结果
 * 将IntegratedTradePlan对象转换为更简洁高效的格式化字符串输出
 * @param tradePlan 综合交易计划对象
 * @returns 格式化的输出字符串
 */
function formatTradePlanOutput(tradePlan: IntegratedTradePlan): string {
  // 创建分隔线和标题行样式
  const separator = '='.repeat(80);
  const sectionSeparator = '-'.repeat(80);

  // 初始化输出字符串
  let output = '';

  // 1. 标题和基本信息 - 简洁显示
  output += `${separator}\n`;
  output += `交易计划 | ${tradePlan.symbol} | ${new Date(tradePlan.date).toLocaleString()}\n`;
  output += `${separator}\n\n`;

  // 2. 核心信息 - 信号、方向和总结
  output += `【综合信号】\n`;
  output += `方向: ${formatDirection(tradePlan.direction)} | 强度: ${formatSignalStrength(tradePlan.signalStrength)} | 确信度: ${tradePlan.confidenceScore.toFixed(1)}/100\n`;
  output += `${tradePlan.summary}\n\n`;

  // 3. 入场策略 - 合并为简洁格式
  output += `【入场策略】\n`;
  output += `价格: ${tradePlan.currentPrice.toFixed(2)} ➔ ${tradePlan.entryStrategy.idealEntryPrice.toFixed(2)} (${formatEntryType(tradePlan.entryStrategy.entryType)})\n`;
  output += `区间: ${tradePlan.entryStrategy.priceZones.ideal[0].toFixed(2)}-${tradePlan.entryStrategy.priceZones.ideal[1].toFixed(2)} | 风险: ${formatRiskLevel(tradePlan.entryStrategy.riskLevel)}\n`;

  // 关键入场条件 - 只显示重要的
  const criticalConditions = tradePlan.entryStrategy.entryConditions
    .filter(c => c.priority === 'critical' || c.priority === 'important')
    .map((c, i) => `${formatPriority(c.priority)} ${c.description}`)
    .join('\n  ');
  output += `条件:\n  ${criticalConditions}\n\n`;

  // 4. 出场策略 - 合并为简洁格式
  output += `【出场策略】\n`;

  // 止盈设置 - 简化为表格式格式
  output += `止盈目标:\n`;
  tradePlan.exitStrategy.takeProfitLevels.forEach((level, i) => {
    const percent = (
      ((level.price - tradePlan.entryStrategy.idealEntryPrice) /
        tradePlan.entryStrategy.idealEntryPrice) *
      100
    ).toFixed(1);
    const sign =
      level.price > tradePlan.entryStrategy.idealEntryPrice ? '+' : '';
    output += `  ${i + 1}. ${level.price.toFixed(2)} (${sign}${percent}%) | ${(level.proportion * 100).toFixed(0)}%仓位\n`;
  });

  // 止损设置 - 简化为表格式格式
  output += `止损位置:\n`;
  tradePlan.exitStrategy.stopLossLevels.forEach((level, i) => {
    const percent = (
      ((level.price - tradePlan.entryStrategy.idealEntryPrice) /
        tradePlan.entryStrategy.idealEntryPrice) *
      100
    ).toFixed(1);
    const sign =
      level.price > tradePlan.entryStrategy.idealEntryPrice ? '+' : '';
    output += `  ${i + 1}. ${level.price.toFixed(2)} (${sign}${percent}%) | ${level.type === 'fixed' ? '固定' : '追踪'}\n`;
  });

  output += `退出时间: ${tradePlan.exitStrategy.maximumHoldingPeriod}\n\n`;

  // 5. 风险管理 - 更简洁的布局
  output += `【风险管理】\n`;
  output += `建议仓位: ${(tradePlan.riskManagement.suggestionPosition * 100).toFixed(1)}% | 风险回报比: ${tradePlan.riskManagement.riskRewardRatio.toFixed(2)}\n`;
  output += `最大损失: ${tradePlan.riskManagement.maxLoss} | 波动性: ${tradePlan.riskManagement.volatilityConsideration}\n`;

  // 6. 关键价位 - 分为支撑和阻力两组
  output += `\n【关键价位】\n`;

  // 筛选强支撑位和强阻力位
  const strongSupportLevels = tradePlan.keyLevels
    .filter(level => level.type === 'support' && level.strength === 'strong')
    .sort((a, b) => b.price - a.price);

  const strongResistanceLevels = tradePlan.keyLevels
    .filter(level => level.type === 'resistance' && level.strength === 'strong')
    .sort((a, b) => a.price - b.price);

  // 支撑位
  output += `支撑位:\n`;
  if (strongSupportLevels.length > 0) {
    strongSupportLevels.slice(0, 3).forEach((level, i) => {
      output += `  ${level.price.toFixed(2)} | ${formatLevelSource(level.source)}\n`;
    });
  } else {
    output += `  未检测到强支撑位\n`;
  }

  // 阻力位
  output += `阻力位:\n`;
  if (strongResistanceLevels.length > 0) {
    strongResistanceLevels.slice(0, 3).forEach((level, i) => {
      output += `  ${level.price.toFixed(2)} | ${formatLevelSource(level.source)}\n`;
    });
  } else {
    output += `  未检测到强阻力位\n`;
  }

  // 7. 时间周期分析
  output += `\n【时间周期分析】\n`;
  output += `主要周期: ${formatTimeframe(tradePlan.primaryTimeframe)} | 一致性: ${tradePlan.timeframeConsistency}\n`;
  output += `短期: ${tradePlan.shortTermOutlook} | 中期: ${tradePlan.mediumTermOutlook} | 长期: ${tradePlan.longTermOutlook}\n`;

  // 8. 趋势逆转信号 (如果存在)
  if (
    tradePlan.trendReversalInfo &&
    tradePlan.trendReversalInfo.hasReversalSignal
  ) {
    output += `\n【趋势逆转信号】\n`;

    if (tradePlan.trendReversalInfo.primaryReversalSignal) {
      const signal = tradePlan.trendReversalInfo.primaryReversalSignal;
      const direction = signal.direction > 0 ? '上涨' : '下跌';

      output += `检测到${formatTimeframe(signal.smallTimeframe)}对${formatTimeframe(signal.largeTimeframe)}的顺势逆转\n`;
      output += `方向: ${direction} | 强度: ${signal.reversalStrength.toFixed(1)}/100\n`;

      if (signal.entryPrice && signal.stopLoss) {
        output += `入场价: ${signal.entryPrice.toFixed(2)} | 止损价: ${signal.stopLoss.toFixed(2)}\n`;
      }

      if (signal.reversalStrength > 70) {
        output += `评价: ✓ 强烈逆转信号，适合介入\n`;
      } else if (signal.reversalStrength > 50) {
        output += `评价: ✓ 中等强度逆转信号，可以考虑\n`;
      } else {
        output += `评价: ⚠ 弱逆转信号，建议等待确认\n`;
      }
    } else {
      output += `${tradePlan.trendReversalInfo.description}\n`;
    }
  }

  // 9. 关键理由
  output += `\n【交易理由】\n`;
  output += `${tradePlan.primaryRationale}\n`;
  output += `${tradePlan.secondaryRationale}\n`;

  // 10. 无效信号条件
  output += `\n【无效信号条件】\n`;
  tradePlan.invalidationConditions
    .filter(c => c.priority === 'critical' || c.priority === 'important')
    .forEach((condition, i) => {
      output += `  ${formatPriority(condition.priority)} ${condition.description}\n`;
    });

  // 11. 警告信息
  if (tradePlan.warnings.length > 0) {
    output += `\n【警告信息】\n`;
    tradePlan.warnings.forEach((warning, i) => {
      output += `  ⚠️ ${warning}\n`;
    });
  }

  // 添加分析权重信息
  output += `\n【分析构成】\n`;
  output += `筹码分析: ${(tradePlan.chipAnalysisWeight * 100).toFixed(0)}% (得分:${tradePlan.chipAnalysisContribution.toFixed(1)}/100)\n`;
  output += `形态分析: ${(tradePlan.patternAnalysisWeight * 100).toFixed(0)}% (得分:${tradePlan.patternAnalysisContribution.toFixed(1)}/100)\n`;

  // 结尾分隔线
  output += `\n${separator}\n`;

  return output;
}

/**
 * 格式化交易方向
 */
function formatDirection(direction: string): string {
  switch (direction) {
    case 'long':
      return '📈 做多';
    case 'short':
      return '📉 做空';
    case 'neutral':
      return '⚖️ 中性';
    default:
      return direction;
  }
}

/**
 * 格式化信号强度
 */
function formatSignalStrength(strength: string): string {
  switch (strength) {
    case 'strong':
      return '🔥 强';
    case 'moderate':
      return '✅ 中等';
    case 'weak':
      return '⚡ 弱';
    case 'neutral':
      return '⚖️ 中性';
    case 'conflicting':
      return '⚠️ 冲突';
    default:
      return strength;
  }
}

/**
 * 格式化时间周期
 */
function formatTimeframe(timeframe: string): string {
  switch (timeframe) {
    case 'weekly':
      return '周线';
    case 'daily':
      return '日线';
    case '1hour':
      return '小时线';
    default:
      return timeframe;
  }
}

/**
 * 格式化入场类型
 */
function formatEntryType(entryType: string): string {
  switch (entryType) {
    case 'immediate':
      return '立即入场';
    case 'pullback':
      return '回调入场';
    case 'breakout':
      return '突破入场';
    default:
      return entryType;
  }
}

/**
 * 格式化风险等级
 */
function formatRiskLevel(riskLevel: string): string {
  switch (riskLevel) {
    case 'high':
      return '🔴 高';
    case 'medium':
      return '🟠 中';
    case 'low':
      return '🟢 低';
    default:
      return riskLevel;
  }
}

/**
 * 格式化优先级
 */
function formatPriority(priority: string): string {
  switch (priority) {
    case 'critical':
      return '[必要]';
    case 'important':
      return '[重要]';
    case 'optional':
      return '[可选]';
    default:
      return priority;
  }
}

/**
 * 格式化价位来源
 */
function formatLevelSource(source: string): string {
  switch (source) {
    case 'chip':
      return '筹码分析';
    case 'pattern':
      return '形态分析';
    case 'combined':
      return '综合分析';
    default:
      return source;
  }
}

export { formatTradePlanOutput };
