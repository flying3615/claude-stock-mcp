import {
  PatternAnalysisResult,
  PatternDirection,
  PatternStatus,
  PatternType,
  PeakValley,
} from './multiTimeFramePatternAnalysis.js';
import { Candle } from '../../types.js';

/**
 * 增强型峰谷检测函数，更注重最近的价格波动
 * @param data K线数据
 * @param windowSize 用于峰谷检测的窗口大小
 * @param recentEmphasis 最近数据的权重因子
 */
function detectPeaksAndValleys(
  data: Candle[],
  windowSize: number = 5,
  recentEmphasis: boolean = true
): PeakValley[] {
  const result: PeakValley[] = [];

  // 确保有足够的数据
  if (data.length < windowSize * 2 + 1) {
    return result;
  }

  for (let i = windowSize; i < data.length - windowSize; i++) {
    const current = data[i];
    let isPeak = true;
    let isValley = true;

    // 检查是否是峰
    for (let j = i - windowSize; j < i; j++) {
      if (data[j].high >= current.high) {
        isPeak = false;
        break;
      }
    }

    for (let j = i + 1; j <= i + windowSize; j++) {
      if (data[j].high >= current.high) {
        isPeak = false;
        break;
      }
    }

    // 检查是否是谷
    for (let j = i - windowSize; j < i; j++) {
      if (data[j].low <= current.low) {
        isValley = false;
        break;
      }
    }

    for (let j = i + 1; j <= i + windowSize; j++) {
      if (data[j].low <= current.low) {
        isValley = false;
        break;
      }
    }

    if (isPeak) {
      result.push({
        index: i,
        price: current.high,
        date: current.timestamp,
        type: 'peak',
      });
    } else if (isValley) {
      result.push({
        index: i,
        price: current.low,
        date: current.timestamp,
        type: 'valley',
      });
    }
  }

  // 当启用最近数据强调时，对峰谷点按照与当前时间的接近程度进行排序
  if (recentEmphasis && result.length > 0) {
    const lastIndex = data.length - 1;

    // 对每个峰谷点的重要性进行加权
    for (const point of result) {
      // 计算与最后一个K线的距离
      const distance = lastIndex - point.index;

      // 添加一个重要性属性，随着距离增加而降低
      (point as any).importance = Math.exp(-0.01 * distance);
    }

    // 按照新的重要性属性排序
    result.sort((a, b) => (b as any).importance - (a as any).importance);
  }

  return result;
}

/**
 * 寻找头肩顶/头肩底形态
 * @param data K线数据
 * @param peaksValleys 已检测到的峰谷
 * @param lookbackPeriod 回看周期
 */
function findHeadAndShoulders(
  data: Candle[],
  peaksValleys: PeakValley[],
  lookbackPeriod: number = 40
): PatternAnalysisResult[] {
  const patterns: PatternAnalysisResult[] = [];

  // 过滤出最近的峰谷
  const recentPoints = peaksValleys.filter(
    p => p.index >= data.length - lookbackPeriod
  );

  // 排序，确保按时间顺序
  recentPoints.sort((a, b) => a.index - b.index);

  // 分别检测峰和谷
  const peaks = recentPoints.filter(p => p.type === 'peak');
  const valleys = recentPoints.filter(p => p.type === 'valley');

  // 检测头肩顶形态
  for (let i = 0; i < peaks.length - 2; i++) {
    const leftShoulder = peaks[i];
    const head = peaks[i + 1];
    const rightShoulder = peaks[i + 2];

    // 验证头肩顶基本形态（头部高于两肩）
    if (
      head.price > leftShoulder.price &&
      head.price > rightShoulder.price &&
      Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price <
        0.1 // 两肩大致相等
    ) {
      // 寻找颈线的两个谷
      const necklineValleys = valleys.filter(
        v => v.index > leftShoulder.index && v.index < rightShoulder.index
      );

      if (necklineValleys.length >= 2) {
        const leftNeck = necklineValleys[0];
        const rightNeck = necklineValleys[necklineValleys.length - 1];

        // 计算颈线
        const necklineSlope =
          (rightNeck.price - leftNeck.price) /
          (rightNeck.index - leftNeck.index);
        const necklineAtEnd =
          leftNeck.price +
          necklineSlope * (rightShoulder.index - leftNeck.index);

        // 计算当前价格是否已突破颈线
        const currentPrice = data[data.length - 1].close;
        const currentIndex = data.length - 1;
        const projectedNeckline =
          leftNeck.price + necklineSlope * (currentIndex - leftNeck.index);

        // 确定形态状态
        let status = PatternStatus.Forming;
        if (rightShoulder.index < data.length - 1) {
          status =
            currentPrice < projectedNeckline
              ? PatternStatus.Confirmed
              : PatternStatus.Completed;
        }

        // 计算可靠性分数
        const reliability = calculateHSReliability(
          leftShoulder,
          head,
          rightShoulder,
          leftNeck,
          rightNeck,
          data,
          false
        );

        // 形态高度 (头部到颈线的距离)
        const patternHeight =
          head.price - (leftNeck.price + rightNeck.price) / 2;

        // 价格目标 (颈线下方的头部高度)
        const priceTarget = necklineAtEnd - patternHeight;

        // 建议止损
        const stopLoss = head.price;

        patterns.push({
          patternType: PatternType.HeadAndShoulders,
          status,
          direction: PatternDirection.Bearish,
          reliability,
          significance:
            reliability * (patternHeight / data[data.length - 1].close),
          component: {
            startIndex: leftShoulder.index,
            endIndex: rightShoulder.index,
            keyPoints: [leftShoulder, head, rightShoulder, leftNeck, rightNeck],
            patternHeight,
            breakoutLevel: necklineAtEnd,
            volumePattern: analyzeHSVolumePattern(
              data,
              leftShoulder.index,
              rightShoulder.index,
              false
            ),
          },
          priceTarget,
          stopLoss,
          breakoutExpected: status === PatternStatus.Completed,
          breakoutDirection: PatternDirection.Bearish,
          probableBreakoutZone: [necklineAtEnd * 0.98, necklineAtEnd * 1.02],
          description: `头肩顶形态, ${status === PatternStatus.Confirmed ? '已确认突破颈线' : '正在形成中'}, 颈线位置在 ${necklineAtEnd.toFixed(2)}`,
          tradingImplication: `看跌信号, 目标价位: ${priceTarget.toFixed(2)}, 止损位: ${stopLoss.toFixed(2)}`,
        });
      }
    }
  }

  // 检测头肩底形态
  for (let i = 0; i < valleys.length - 2; i++) {
    const leftShoulder = valleys[i];
    const head = valleys[i + 1];
    const rightShoulder = valleys[i + 2];

    // 验证头肩底基本形态（头部低于两肩）
    if (
      head.price < leftShoulder.price &&
      head.price < rightShoulder.price &&
      Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price <
        0.1 // 两肩大致相等
    ) {
      // 寻找颈线的两个峰
      const necklinePeaks = peaks.filter(
        p => p.index > leftShoulder.index && p.index < rightShoulder.index
      );

      if (necklinePeaks.length >= 2) {
        const leftNeck = necklinePeaks[0];
        const rightNeck = necklinePeaks[necklinePeaks.length - 1];

        // 计算颈线
        const necklineSlope =
          (rightNeck.price - leftNeck.price) /
          (rightNeck.index - leftNeck.index);
        const necklineAtEnd =
          leftNeck.price +
          necklineSlope * (rightShoulder.index - leftNeck.index);

        // 计算当前价格是否已突破颈线
        const currentPrice = data[data.length - 1].close;
        const currentIndex = data.length - 1;
        const projectedNeckline =
          leftNeck.price + necklineSlope * (currentIndex - leftNeck.index);

        // 确定形态状态
        let status = PatternStatus.Forming;
        if (rightShoulder.index < data.length - 1) {
          status =
            currentPrice > projectedNeckline
              ? PatternStatus.Confirmed
              : PatternStatus.Completed;
        }

        // 计算可靠性分数
        const reliability = calculateHSReliability(
          leftShoulder,
          head,
          rightShoulder,
          leftNeck,
          rightNeck,
          data,
          true
        );

        // 形态高度 (颈线到头部的距离)
        const patternHeight =
          (leftNeck.price + rightNeck.price) / 2 - head.price;

        // 价格目标 (颈线上方的头部高度)
        const priceTarget = necklineAtEnd + patternHeight;

        // 建议止损
        const stopLoss = head.price;

        patterns.push({
          patternType: PatternType.InverseHeadAndShoulders,
          status,
          direction: PatternDirection.Bullish,
          reliability,
          significance:
            reliability * (patternHeight / data[data.length - 1].close),
          component: {
            startIndex: leftShoulder.index,
            endIndex: rightShoulder.index,
            keyPoints: [leftShoulder, head, rightShoulder, leftNeck, rightNeck],
            patternHeight,
            breakoutLevel: necklineAtEnd,
            volumePattern: analyzeHSVolumePattern(
              data,
              leftShoulder.index,
              rightShoulder.index,
              true
            ),
          },
          priceTarget,
          stopLoss,
          breakoutExpected: status === PatternStatus.Completed,
          breakoutDirection: PatternDirection.Bullish,
          probableBreakoutZone: [necklineAtEnd * 0.98, necklineAtEnd * 1.02],
          description: `头肩底形态, ${status === PatternStatus.Confirmed ? '已确认突破颈线' : '正在形成中'}, 颈线位置在 ${necklineAtEnd.toFixed(2)}`,
          tradingImplication: `看涨信号, 目标价位: ${priceTarget.toFixed(2)}, 止损位: ${stopLoss.toFixed(2)}`,
        });
      }
    }
  }

  return patterns;
}

/**
 * 计算头肩顶/底形态的可靠性
 */
function calculateHSReliability(
  leftShoulder: PeakValley,
  head: PeakValley,
  rightShoulder: PeakValley,
  leftNeck: PeakValley,
  rightNeck: PeakValley,
  data: Candle[],
  isInverse: boolean
): number {
  let score = 50; // 初始可靠性分数

  // 1. 肩部对称性
  const shoulderPriceDiff = Math.abs(leftShoulder.price - rightShoulder.price);
  const shoulderSymmetry =
    1 - shoulderPriceDiff / ((leftShoulder.price + rightShoulder.price) / 2);
  score += shoulderSymmetry * 15; // 最多加15分

  // 2. 时间间隔对称性
  const leftToHeadDuration = head.index - leftShoulder.index;
  const headToRightDuration = rightShoulder.index - head.index;
  const timingRatio =
    Math.min(leftToHeadDuration, headToRightDuration) /
    Math.max(leftToHeadDuration, headToRightDuration);
  score += timingRatio * 10; // 最多加10分

  // 3. 头部突出明显程度
  const shoulderAvgHeight = (leftShoulder.price + rightShoulder.price) / 2;
  const headProminence = isInverse
    ? (shoulderAvgHeight - head.price) / shoulderAvgHeight
    : (head.price - shoulderAvgHeight) / shoulderAvgHeight;

  if (headProminence > 0.05)
    score += 15; // 头部突出明显
  else if (headProminence > 0.02)
    score += 10; // 头部适中突出
  else score += 5; // 头部不够突出

  // 4. 颈线斜率（理想情况下应该接近水平）
  const necklineSlope = Math.abs(
    (rightNeck.price - leftNeck.price) / (rightNeck.index - leftNeck.index)
  );
  const avgPrice = data.reduce((sum, d) => sum + d.close, 0) / data.length;
  const normalizedSlope = necklineSlope / avgPrice;

  if (normalizedSlope < 0.001)
    score += 10; // 颈线几乎水平
  else if (normalizedSlope < 0.003) score += 5; // 颈线略微倾斜

  // 5. 成交量情况
  // 这里只做一个简化检查，实际可以更复杂
  const headVolume = data[head.index].volume;
  const avgVolume =
    data
      .slice(leftShoulder.index, rightShoulder.index)
      .reduce((sum, d) => sum + d.volume, 0) /
    (rightShoulder.index - leftShoulder.index);

  if (headVolume > avgVolume * 1.3)
    score += 10; // 头部成交量较大
  else if (headVolume > avgVolume) score += 5; // 头部成交量一般

  // 最后确保分数在0-100范围内
  return Math.max(0, Math.min(100, score));
}

/**
 * 分析头肩形态的成交量特征
 */
function analyzeHSVolumePattern(
  data: Candle[],
  startIndex: number,
  endIndex: number,
  isInverse: boolean
): string {
  // 简化的成交量分析
  const volumes = data.slice(startIndex, endIndex + 1).map(d => d.volume);
  const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;

  // 头部附近的成交量
  const middleIndex = Math.floor((startIndex + endIndex) / 2);
  const headVolumeRegion = data
    .slice(middleIndex - 2, middleIndex + 3)
    .map(d => d.volume);
  const headAvgVolume =
    headVolumeRegion.reduce((sum, v) => sum + v, 0) / headVolumeRegion.length;

  // 右肩的成交量
  const rightShoulderVolumes = data
    .slice(middleIndex + 3, endIndex + 1)
    .map(d => d.volume);
  const rightShoulderAvgVolume =
    rightShoulderVolumes.length > 0
      ? rightShoulderVolumes.reduce((sum, v) => sum + v, 0) /
        rightShoulderVolumes.length
      : 0;

  if (isInverse) {
    // 头肩底
    if (
      headAvgVolume > avgVolume * 1.2 &&
      rightShoulderAvgVolume > headAvgVolume
    ) {
      return '理想的成交量模式：头部成交量放大，右肩成交量更大，支持看涨形态';
    } else if (
      headAvgVolume > avgVolume &&
      rightShoulderAvgVolume > avgVolume
    ) {
      return '良好的成交量模式：头部和右肩成交量均高于平均，支持形态';
    } else {
      return '非理想的成交量模式：未能在关键点位看到成交量放大，减弱形态可靠性';
    }
  } else {
    // 头肩顶
    if (
      headAvgVolume > avgVolume * 1.2 &&
      rightShoulderAvgVolume < headAvgVolume
    ) {
      return '理想的成交量模式：头部成交量放大，右肩成交量减小，支持看跌形态';
    } else if (rightShoulderAvgVolume < avgVolume * 0.8) {
      return '良好的成交量模式：右肩成交量明显减小，支持形态';
    } else {
      return '非理想的成交量模式：右肩成交量未能明显减小，减弱形态可靠性';
    }
  }
}

/**
 * 改进各个形态检测函数，使其更注重最近的形态
 * 这里以双顶/双底形态为例，其他形态检测函数类似修改
 */
function findDoubleTopsAndBottoms(
  data: Candle[],
  peaksValleys: PeakValley[],
  lookbackPeriod: number = 40
): PatternAnalysisResult[] {
  const patterns: PatternAnalysisResult[] = [];

  // 过滤出最近的峰谷
  const recentPoints = peaksValleys.filter(
    p => p.index >= data.length - lookbackPeriod
  );

  // 排序，确保按时间顺序
  recentPoints.sort((a, b) => a.index - b.index);

  // 分别检测峰和谷
  const peaks = recentPoints.filter(p => p.type === 'peak');
  const valleys = recentPoints.filter(p => p.type === 'valley');

  // 寻找双顶形态 - 从最近的峰开始检查
  for (let i = peaks.length - 2; i >= 0; i--) {
    const secondPeak = peaks[i + 1];
    const firstPeak = peaks[i];

    // 检查两个峰是否接近同一高度
    const heightDiff =
      Math.abs(firstPeak.price - secondPeak.price) / firstPeak.price;

    if (heightDiff < 0.05 && secondPeak.index - firstPeak.index > 5) {
      // 寻找中间的谷
      const middleValleys = valleys.filter(
        v => v.index > firstPeak.index && v.index < secondPeak.index
      );

      if (middleValleys.length > 0) {
        const neckline = middleValleys[0].price;

        // 检查当前是否已突破颈线
        const currentPrice = data[data.length - 1].close;
        let status = PatternStatus.Forming;

        if (secondPeak.index < data.length - 1) {
          status =
            currentPrice < neckline
              ? PatternStatus.Confirmed
              : PatternStatus.Completed;
        }

        // 计算形态高度
        const patternHeight =
          (firstPeak.price + secondPeak.price) / 2 - neckline;

        // 价格目标
        const priceTarget = neckline - patternHeight;

        // 可靠性评分
        const reliability = calculateDoubleTopBottomReliability(
          firstPeak,
          secondPeak,
          middleValleys[0],
          data,
          false
        );

        // 计算形态与当前位置的距离因子
        const recencyFactor = Math.exp(
          -0.03 * (data.length - 1 - secondPeak.index)
        );

        // 根据距离调整重要性
        const adjustedSignificance =
          reliability *
          (patternHeight / data[data.length - 1].close) *
          recencyFactor;

        patterns.push({
          patternType: PatternType.DoubleTop,
          status,
          direction: PatternDirection.Bearish,
          reliability,
          significance: adjustedSignificance,
          component: {
            startIndex: firstPeak.index,
            endIndex: secondPeak.index,
            keyPoints: [firstPeak, secondPeak, middleValleys[0]],
            patternHeight,
            breakoutLevel: neckline,
            volumePattern: analyzeDoubleTopBottomVolume(
              data,
              firstPeak.index,
              secondPeak.index,
              false
            ),
          },
          priceTarget,
          stopLoss: Math.max(firstPeak.price, secondPeak.price),
          breakoutExpected: status === PatternStatus.Completed,
          breakoutDirection: PatternDirection.Bearish,
          probableBreakoutZone: [neckline * 0.98, neckline * 1.02],
          description: `双顶形态, ${status === PatternStatus.Confirmed ? '已确认突破颈线' : '正在形成中'}, 颈线位置在 ${neckline.toFixed(2)}`,
          tradingImplication: `看跌信号, 目标价位: ${priceTarget.toFixed(2)}, 止损位: ${Math.max(firstPeak.price, secondPeak.price).toFixed(2)}`,
        });

        // 找到第一个有效的双顶后就退出循环，优先考虑最近的形态
        break;
      }
    }
  }

  // 寻找双底形态 - 同样从最近的谷开始检查
  for (let i = valleys.length - 2; i >= 0; i--) {
    const secondValley = valleys[i + 1];
    const firstValley = valleys[i];

    // 检查两个谷是否接近同一低点
    const depthDiff =
      Math.abs(firstValley.price - secondValley.price) / firstValley.price;

    if (depthDiff < 0.05 && secondValley.index - firstValley.index > 5) {
      // 寻找中间的峰
      const middlePeaks = peaks.filter(
        p => p.index > firstValley.index && p.index < secondValley.index
      );

      if (middlePeaks.length > 0) {
        const neckline = middlePeaks[0].price;

        // 检查当前是否已突破颈线
        const currentPrice = data[data.length - 1].close;
        let status = PatternStatus.Forming;

        if (secondValley.index < data.length - 1) {
          status =
            currentPrice > neckline
              ? PatternStatus.Confirmed
              : PatternStatus.Completed;
        }

        // 计算形态高度
        const patternHeight =
          neckline - (firstValley.price + secondValley.price) / 2;

        // 价格目标
        const priceTarget = neckline + patternHeight;

        // 可靠性评分
        const reliability = calculateDoubleTopBottomReliability(
          firstValley,
          secondValley,
          middlePeaks[0],
          data,
          true
        );

        // 计算形态与当前位置的距离因子
        const recencyFactor = Math.exp(
          -0.03 * (data.length - 1 - secondValley.index)
        );

        // 根据距离调整重要性
        const adjustedSignificance =
          reliability *
          (patternHeight / data[data.length - 1].close) *
          recencyFactor;

        patterns.push({
          patternType: PatternType.DoubleBottom,
          status,
          direction: PatternDirection.Bullish,
          reliability,
          significance: adjustedSignificance,
          component: {
            startIndex: firstValley.index,
            endIndex: secondValley.index,
            keyPoints: [firstValley, secondValley, middlePeaks[0]],
            patternHeight,
            breakoutLevel: neckline,
            volumePattern: analyzeDoubleTopBottomVolume(
              data,
              firstValley.index,
              secondValley.index,
              true
            ),
          },
          priceTarget,
          stopLoss: Math.min(firstValley.price, secondValley.price),
          breakoutExpected: status === PatternStatus.Completed,
          breakoutDirection: PatternDirection.Bullish,
          probableBreakoutZone: [neckline * 0.98, neckline * 1.02],
          description: `双底形态, ${status === PatternStatus.Confirmed ? '已确认突破颈线' : '正在形成中'}, 颈线位置在 ${neckline.toFixed(2)}`,
          tradingImplication: `看涨信号, 目标价位: ${priceTarget.toFixed(2)}, 止损位: ${Math.min(firstValley.price, secondValley.price).toFixed(2)}`,
        });

        // 找到第一个有效的双底后就退出循环，优先考虑最近的形态
        break;
      }
    }
  }

  return patterns;
}

/**
 * 计算双顶/双底形态的可靠性
 */
function calculateDoubleTopBottomReliability(
  firstPoint: PeakValley,
  secondPoint: PeakValley,
  middlePoint: PeakValley,
  data: Candle[],
  isDoubleBottom: boolean
): number {
  let score = 50; // 初始可靠性分数

  // 1. 两个顶/底的相似度
  const peaksDiff = Math.abs(firstPoint.price - secondPoint.price);
  const similarity =
    1 - peaksDiff / ((firstPoint.price + secondPoint.price) / 2);
  score += similarity * 20; // 最多加20分

  // 2. 时间间隔
  const timeInterval = secondPoint.index - firstPoint.index;
  if (timeInterval > 15)
    score += 10; // 时间间隔明显
  else if (timeInterval > 8) score += 5; // 时间间隔适中

  // 3. 中间点的回调幅度
  let retracementRatio;
  if (isDoubleBottom) {
    retracementRatio =
      (middlePoint.price - firstPoint.price) /
      (secondPoint.price - firstPoint.price);
  } else {
    retracementRatio =
      (firstPoint.price - middlePoint.price) /
      (firstPoint.price - secondPoint.price);
  }

  if (retracementRatio > 0.5)
    score += 15; // 回调超过50%
  else if (retracementRatio > 0.3)
    score += 10; // 回调超过30%
  else score += 5; // 回调幅度较小

  // 4. 成交量确认
  const firstPointVolume = data[firstPoint.index].volume;
  const secondPointVolume = data[secondPoint.index].volume;

  if (isDoubleBottom) {
    // 双底理想情况：第二个底的成交量大于第一个底
    if (secondPointVolume > firstPointVolume * 1.2) score += 15;
    else if (secondPointVolume > firstPointVolume) score += 10;
  } else {
    // 双顶理想情况：第二个顶的成交量小于第一个顶
    if (secondPointVolume < firstPointVolume * 0.8) score += 15;
    else if (secondPointVolume < firstPointVolume) score += 10;
  }

  // 最后确保分数在0-100范围内
  return Math.max(0, Math.min(100, score));
}

/**
 * 分析双顶/双底形态的成交量特征
 */
function analyzeDoubleTopBottomVolume(
  data: Candle[],
  firstPointIndex: number,
  secondPointIndex: number,
  isDoubleBottom: boolean
): string {
  const volumes = data
    .slice(firstPointIndex, secondPointIndex + 1)
    .map(d => d.volume);
  const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;

  const firstPointVolume = data[firstPointIndex].volume;
  const secondPointVolume = data[secondPointIndex].volume;

  if (isDoubleBottom) {
    if (secondPointVolume > firstPointVolume * 1.2) {
      return '理想的成交量模式：第二个底的成交量大于第一个底，强烈支持看涨';
    } else if (secondPointVolume > avgVolume) {
      return '良好的成交量模式：第二个底的成交量高于平均，支持看涨';
    } else {
      return '非理想的成交量模式：第二个底的成交量不够大，减弱形态可靠性';
    }
  } else {
    if (secondPointVolume < firstPointVolume * 0.8) {
      return '理想的成交量模式：第二个顶的成交量小于第一个顶，支持看跌';
    } else if (secondPointVolume < avgVolume) {
      return '良好的成交量模式：第二个顶的成交量低于平均，支持看跌';
    } else {
      return '非理想的成交量模式：第二个顶的成交量偏高，减弱形态可靠性';
    }
  }
}

/**
 * 寻找三角形形态
 */
function findTriangles(
  data: Candle[],
  peaksValleys: PeakValley[],
  lookbackPeriod: number = 30
): PatternAnalysisResult[] {
  const patterns: PatternAnalysisResult[] = [];

  // 确保有足够的数据
  if (data.length < lookbackPeriod) {
    return patterns;
  }

  // 过滤出最近的峰谷
  const recentPoints = peaksValleys.filter(
    p => p.index >= data.length - lookbackPeriod
  );

  // 排序，确保按时间顺序
  recentPoints.sort((a, b) => a.index - b.index);

  // 分别获取峰和谷
  const peaks = recentPoints.filter(p => p.type === 'peak');
  const valleys = recentPoints.filter(p => p.type === 'valley');

  // 需要至少2个峰和2个谷来形成三角形
  if (peaks.length < 2 || valleys.length < 2) {
    return patterns;
  }

  // 检测上升三角形（下降阻力线，水平支撑线）
  // 上升三角形需要至少两个较低的高点和两个相似的低点
  if (peaks.length >= 2 && valleys.length >= 2) {
    // 检查是否存在下降的高点
    const isDescendingHighs =
      peaks[peaks.length - 1].price < peaks[peaks.length - 2].price;

    // 检查是否存在大致水平的低点
    const laterValleys = valleys.slice(-2);
    const isHorizontalLows =
      Math.abs(laterValleys[1].price - laterValleys[0].price) /
        laterValleys[0].price <
      0.03;

    if (isDescendingHighs && isHorizontalLows) {
      // 计算上升三角形的支撑线（水平线）
      const supportLevel = (laterValleys[0].price + laterValleys[1].price) / 2;

      // 计算上升三角形的阻力线（下降线）
      const resistance1 = peaks[peaks.length - 2];
      const resistance2 = peaks[peaks.length - 1];
      const resistanceSlope =
        (resistance2.price - resistance1.price) /
        (resistance2.index - resistance1.index);

      // 确定形态开始和结束的索引
      const startIndex = Math.min(resistance1.index, laterValleys[0].index);
      const endIndex = Math.max(resistance2.index, laterValleys[1].index);

      // 计算当前的预期阻力位置
      const currentIndex = data.length - 1;
      const projectedResistance =
        resistance1.price +
        resistanceSlope * (currentIndex - resistance1.index);

      // 计算三角形收敛点
      let convergenceIndex = resistance1.index;
      if (resistanceSlope !== 0) {
        convergenceIndex =
          resistance1.index +
          (supportLevel - resistance1.price) / resistanceSlope;
      }

      // 计算当前是否接近收敛点
      const proximityToConvergence =
        1 - Math.min(1, Math.abs(currentIndex - convergenceIndex) / 20);

      // 确定当前价格相对于三角形的位置
      const currentPrice = data[data.length - 1].close;
      let status = PatternStatus.Forming;

      if (currentIndex > endIndex) {
        if (currentPrice > projectedResistance) {
          status = PatternStatus.Confirmed; // 已突破上方
        } else if (currentPrice < supportLevel) {
          status = PatternStatus.Failed; // 向下突破（失败）
        } else {
          status = PatternStatus.Completed; // 形成但未突破
        }
      }

      // 计算形态高度
      const patternHeight = resistance1.price - supportLevel;

      // 计算价格目标（向上突破的目标）
      const priceTarget = supportLevel + patternHeight;

      // 计算可靠性分数
      const reliability = calculateTriangleReliability(
        data,
        startIndex,
        endIndex,
        patternHeight,
        proximityToConvergence,
        status === PatternStatus.Confirmed,
        PatternType.AscendingTriangle
      );

      patterns.push({
        patternType: PatternType.AscendingTriangle,
        status,
        direction: PatternDirection.Bullish,
        reliability,
        significance: reliability * (patternHeight / currentPrice),
        component: {
          startIndex,
          endIndex,
          keyPoints: [
            resistance1,
            resistance2,
            laterValleys[0],
            laterValleys[1],
          ],
          patternHeight,
          breakoutLevel: projectedResistance,
          volumePattern: analyzeTriangleVolume(
            data,
            startIndex,
            endIndex,
            status
          ),
        },
        priceTarget,
        stopLoss: supportLevel * 0.98, // 支撑线下方3%
        breakoutExpected:
          status === PatternStatus.Completed && proximityToConvergence > 0.7,
        breakoutDirection: PatternDirection.Bullish,
        probableBreakoutZone: [
          projectedResistance * 0.98,
          projectedResistance * 1.02,
        ],
        description: `上升三角形, ${getStatusDescription(status)}, 支撑位在 ${supportLevel.toFixed(2)}, 阻力趋势线当前在 ${projectedResistance.toFixed(2)}`,
        tradingImplication: `看涨信号, 突破目标价位: ${priceTarget.toFixed(2)}, 止损位: ${(supportLevel * 0.98).toFixed(2)}`,
      });
    }
  }

  // 检测下降三角形（水平阻力线，上升支撑线）
  if (peaks.length >= 2 && valleys.length >= 2) {
    // 检查是否存在上升的低点
    const isAscendingLows =
      valleys[valleys.length - 1].price > valleys[valleys.length - 2].price;

    // 检查是否存在大致水平的高点
    const laterPeaks = peaks.slice(-2);
    const isHorizontalHighs =
      Math.abs(laterPeaks[1].price - laterPeaks[0].price) /
        laterPeaks[0].price <
      0.03;

    if (isAscendingLows && isHorizontalHighs) {
      // 计算下降三角形的阻力线（水平线）
      const resistanceLevel = (laterPeaks[0].price + laterPeaks[1].price) / 2;

      // 计算下降三角形的支撑线（上升线）
      const support1 = valleys[valleys.length - 2];
      const support2 = valleys[valleys.length - 1];
      const supportSlope =
        (support2.price - support1.price) / (support2.index - support1.index);

      // 确定形态开始和结束的索引
      const startIndex = Math.min(support1.index, laterPeaks[0].index);
      const endIndex = Math.max(support2.index, laterPeaks[1].index);

      // 计算当前的预期支撑位置
      const currentIndex = data.length - 1;
      const projectedSupport =
        support1.price + supportSlope * (currentIndex - support1.index);

      // 计算三角形收敛点
      let convergenceIndex = support1.index;
      if (supportSlope !== 0) {
        convergenceIndex =
          support1.index + (resistanceLevel - support1.price) / supportSlope;
      }

      // 计算当前是否接近收敛点
      const proximityToConvergence =
        1 - Math.min(1, Math.abs(currentIndex - convergenceIndex) / 20);

      // 确定当前价格相对于三角形的位置
      const currentPrice = data[data.length - 1].close;
      let status = PatternStatus.Forming;

      if (currentIndex > endIndex) {
        if (currentPrice < projectedSupport) {
          status = PatternStatus.Confirmed; // 已突破下方
        } else if (currentPrice > resistanceLevel) {
          status = PatternStatus.Failed; // 向上突破（失败）
        } else {
          status = PatternStatus.Completed; // 形成但未突破
        }
      }

      // 计算形态高度
      const patternHeight = resistanceLevel - support1.price;

      // 计算价格目标（向下突破的目标）
      const priceTarget = resistanceLevel - patternHeight;

      // 计算可靠性分数
      const reliability = calculateTriangleReliability(
        data,
        startIndex,
        endIndex,
        patternHeight,
        proximityToConvergence,
        status === PatternStatus.Confirmed,
        PatternType.DescendingTriangle
      );

      patterns.push({
        patternType: PatternType.DescendingTriangle,
        status,
        direction: PatternDirection.Bearish,
        reliability,
        significance: reliability * (patternHeight / currentPrice),
        component: {
          startIndex,
          endIndex,
          keyPoints: [support1, support2, laterPeaks[0], laterPeaks[1]],
          patternHeight,
          breakoutLevel: projectedSupport,
          volumePattern: analyzeTriangleVolume(
            data,
            startIndex,
            endIndex,
            status
          ),
        },
        priceTarget,
        stopLoss: resistanceLevel * 1.02, // 阻力线上方2%
        breakoutExpected:
          status === PatternStatus.Completed && proximityToConvergence > 0.7,
        breakoutDirection: PatternDirection.Bearish,
        probableBreakoutZone: [
          projectedSupport * 0.98,
          projectedSupport * 1.02,
        ],
        description: `下降三角形, ${getStatusDescription(status)}, 阻力位在 ${resistanceLevel.toFixed(2)}, 支撑趋势线当前在 ${projectedSupport.toFixed(2)}`,
        tradingImplication: `看跌信号, 突破目标价位: ${priceTarget.toFixed(2)}, 止损位: ${(resistanceLevel * 1.02).toFixed(2)}`,
      });
    }
  }

  // 检测对称三角形（同时有下降阻力线和上升支撑线）
  if (peaks.length >= 2 && valleys.length >= 2) {
    // 检查是否存在下降的高点
    const isDescendingHighs =
      peaks[peaks.length - 1].price < peaks[peaks.length - 2].price;

    // 检查是否存在上升的低点
    const isAscendingLows =
      valleys[valleys.length - 1].price > valleys[valleys.length - 2].price;

    if (isDescendingHighs && isAscendingLows) {
      // 计算对称三角形的阻力线（下降线）
      const resistance1 = peaks[peaks.length - 2];
      const resistance2 = peaks[peaks.length - 1];
      const resistanceSlope =
        (resistance2.price - resistance1.price) /
        (resistance2.index - resistance1.index);

      // 计算对称三角形的支撑线（上升线）
      const support1 = valleys[valleys.length - 2];
      const support2 = valleys[valleys.length - 1];
      const supportSlope =
        (support2.price - support1.price) / (support2.index - support1.index);

      // 确定形态开始和结束的索引
      const startIndex = Math.min(resistance1.index, support1.index);
      const endIndex = Math.max(resistance2.index, support2.index);

      // 计算当前的预期阻力和支撑位置
      const currentIndex = data.length - 1;
      const projectedResistance =
        resistance1.price +
        resistanceSlope * (currentIndex - resistance1.index);
      const projectedSupport =
        support1.price + supportSlope * (currentIndex - support1.index);

      // 计算三角形收敛点
      let convergenceIndex = startIndex;
      if (resistanceSlope !== supportSlope) {
        convergenceIndex =
          startIndex +
          (support1.price - resistance1.price) /
            (resistanceSlope - supportSlope);
      }

      // 计算当前是否接近收敛点
      const proximityToConvergence =
        1 - Math.min(1, Math.abs(currentIndex - convergenceIndex) / 20);

      // 确定当前价格相对于三角形的位置
      const currentPrice = data[data.length - 1].close;
      let status = PatternStatus.Forming;
      let breakoutDirection = PatternDirection.Neutral;

      if (currentIndex > endIndex) {
        if (currentPrice > projectedResistance) {
          status = PatternStatus.Confirmed;
          breakoutDirection = PatternDirection.Bullish;
        } else if (currentPrice < projectedSupport) {
          status = PatternStatus.Confirmed;
          breakoutDirection = PatternDirection.Bearish;
        } else {
          status = PatternStatus.Completed;
        }
      }

      // 计算形态高度
      const patternHeight = resistance1.price - support1.price;

      // 计算价格目标
      let priceTarget = currentPrice;
      if (breakoutDirection === PatternDirection.Bullish) {
        priceTarget = projectedResistance + patternHeight;
      } else if (breakoutDirection === PatternDirection.Bearish) {
        priceTarget = projectedSupport - patternHeight;
      }

      // 计算可靠性分数
      const reliability = calculateTriangleReliability(
        data,
        startIndex,
        endIndex,
        patternHeight,
        proximityToConvergence,
        status === PatternStatus.Confirmed,
        PatternType.SymmetricalTriangle
      );

      patterns.push({
        patternType: PatternType.SymmetricalTriangle,
        status,
        direction: breakoutDirection,
        reliability,
        significance: reliability * (patternHeight / currentPrice),
        component: {
          startIndex,
          endIndex,
          keyPoints: [resistance1, resistance2, support1, support2],
          patternHeight,
          breakoutLevel:
            breakoutDirection === PatternDirection.Bullish
              ? projectedResistance
              : projectedSupport,
          volumePattern: analyzeTriangleVolume(
            data,
            startIndex,
            endIndex,
            status
          ),
        },
        priceTarget,
        stopLoss:
          breakoutDirection === PatternDirection.Bullish
            ? projectedSupport
            : projectedResistance,
        breakoutExpected:
          status === PatternStatus.Completed && proximityToConvergence > 0.7,
        breakoutDirection,
        probableBreakoutZone: [projectedSupport, projectedResistance],
        description: `对称三角形, ${getStatusDescription(status)}${breakoutDirection !== PatternDirection.Neutral ? ', ' + (breakoutDirection === PatternDirection.Bullish ? '向上' : '向下') + '突破' : ''}, 阻力趋势线当前在 ${projectedResistance.toFixed(2)}, 支撑趋势线当前在 ${projectedSupport.toFixed(2)}`,
        tradingImplication:
          status === PatternStatus.Confirmed
            ? `${breakoutDirection === PatternDirection.Bullish ? '看涨' : '看跌'}信号, 目标价位: ${priceTarget.toFixed(2)}, 止损位: ${(breakoutDirection === PatternDirection.Bullish ? projectedSupport : projectedResistance).toFixed(2)}`
            : '等待突破确认，突破方向将决定交易信号',
      });
    }
  }

  return patterns;
}

/**
 * 加权计算形态可靠性，考虑时间因素
 * 这里以三角形形态为例
 */
function calculateTriangleReliability(
  data: Candle[],
  startIndex: number,
  endIndex: number,
  patternHeight: number,
  proximityToConvergence: number,
  isBreakoutConfirmed: boolean,
  patternType: PatternType
): number {
  let score = 50; // 初始可靠性分数

  // 1. 形态持续时间（通常越长越好）
  const duration = endIndex - startIndex;
  if (duration > 20) score += 15;
  else if (duration > 10) score += 10;
  else score += 5;

  // 2. 形态高度（相对于价格的百分比）
  const avgPrice =
    data.slice(startIndex, endIndex + 1).reduce((sum, d) => sum + d.close, 0) /
    (endIndex - startIndex + 1);
  const heightRatio = patternHeight / avgPrice;

  if (heightRatio > 0.05)
    score += 10; // 形态高度超过5%
  else if (heightRatio > 0.02) score += 5; // 形态高度超过2%

  // 3. 收敛点的接近程度
  score += proximityToConvergence * 15;

  // 4. 确认突破
  if (isBreakoutConfirmed) score += 15;

  // 5. 形态中的触摸点数量
  // 简化处理，假设至少有4个触点
  score += 5;

  // 6. 根据形态类型的不同特性评分
  if (patternType === PatternType.AscendingTriangle) {
    // 检查上升三角形的方向是否符合大趋势
    score += 5;
  } else if (patternType === PatternType.DescendingTriangle) {
    // 检查下降三角形的方向是否符合大趋势
    score += 5;
  }

  // 7. 新增：形态的最近程度评分
  // 计算形态结束点与数据末尾的距离
  const recencyDistance = data.length - 1 - endIndex;

  // 根据形态的近期性加分，距离越近分数越高
  // 最近的形态额外加分，使用衰减函数
  if (recencyDistance <= 5) {
    score += 15; // 非常近期的形态
  } else if (recencyDistance <= 15) {
    score += 10; // 近期形态
  } else if (recencyDistance <= 30) {
    score += 5; // 较近期形态
  }

  // 最后确保分数在0-100范围内
  return Math.max(0, Math.min(100, score));
}

/**
 * 分析三角形形态的成交量特征
 */
function analyzeTriangleVolume(
  data: Candle[],
  startIndex: number,
  endIndex: number,
  status: PatternStatus
): string {
  const volumes = data.slice(startIndex, endIndex + 1).map(d => d.volume);
  const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;

  // 检查成交量趋势
  let volumeTrend = 0;
  for (let i = 1; i < volumes.length; i++) {
    volumeTrend += volumes[i] > volumes[i - 1] ? 1 : -1;
  }

  // 检查突破时的成交量
  let breakoutVolume = 0;
  if (status === PatternStatus.Confirmed && endIndex + 1 < data.length) {
    breakoutVolume = data[endIndex + 1].volume;
  }

  if (volumeTrend < 0) {
    // 成交量收缩是三角形形态的理想情况
    if (
      status === PatternStatus.Confirmed &&
      breakoutVolume > avgVolume * 1.5
    ) {
      return '理想的成交量模式：形态期间成交量收缩，突破时成交量明显放大';
    } else if (status === PatternStatus.Confirmed) {
      return '良好的成交量模式：形态期间成交量收缩，但突破时成交量增幅不明显';
    } else {
      return '形态期间成交量收缩，等待突破时的成交量确认';
    }
  } else if (volumeTrend > 0) {
    // 成交量扩大不是三角形的理想情况
    return '非理想的成交量模式：形态期间成交量未收缩，降低形态可靠性';
  } else {
    return '成交量模式中性，无明显趋势';
  }
}

/**
 * 寻找楔形形态
 */
function findWedges(
  data: Candle[],
  peaksValleys: PeakValley[],
  lookbackPeriod: number = 30
): PatternAnalysisResult[] {
  const patterns: PatternAnalysisResult[] = [];

  // 过滤出最近的峰谷
  const recentPoints = peaksValleys.filter(
    p => p.index >= data.length - lookbackPeriod
  );

  // 排序，确保按时间顺序
  recentPoints.sort((a, b) => a.index - b.index);

  // 分别获取峰和谷
  const peaks = recentPoints.filter(p => p.type === 'peak');
  const valleys = recentPoints.filter(p => p.type === 'valley');

  // 需要至少2个峰和2个谷来形成楔形
  if (peaks.length < 2 || valleys.length < 2) {
    return patterns;
  }

  // 寻找上升楔形（看跌）
  // 上升楔形：上部边界和下部边界都向上倾斜，但下部边界倾斜更陡
  if (peaks.length >= 2 && valleys.length >= 2) {
    const peakSlope =
      (peaks[peaks.length - 1].price - peaks[peaks.length - 2].price) /
      (peaks[peaks.length - 1].index - peaks[peaks.length - 2].index);

    const valleySlope =
      (valleys[valleys.length - 1].price - valleys[valleys.length - 2].price) /
      (valleys[valleys.length - 1].index - valleys[valleys.length - 2].index);

    // 检查两条边界线是否都向上倾斜，且下部边界倾斜更陡
    if (peakSlope > 0 && valleySlope > 0 && valleySlope > peakSlope) {
      // 计算上升楔形的上部边界
      const upperBoundary1 = peaks[peaks.length - 2];
      const upperBoundary2 = peaks[peaks.length - 1];

      // 计算上升楔形的下部边界
      const lowerBoundary1 = valleys[valleys.length - 2];
      const lowerBoundary2 = valleys[valleys.length - 1];

      // 确定形态开始和结束的索引
      const startIndex = Math.min(upperBoundary1.index, lowerBoundary1.index);
      const endIndex = Math.max(upperBoundary2.index, lowerBoundary2.index);

      // 计算当前的预期边界位置
      const currentIndex = data.length - 1;
      const projectedUpperBoundary =
        upperBoundary1.price +
        peakSlope * (currentIndex - upperBoundary1.index);
      const projectedLowerBoundary =
        lowerBoundary1.price +
        valleySlope * (currentIndex - lowerBoundary1.index);

      // 计算收敛点
      let convergenceIndex = upperBoundary1.index;

      if (peakSlope !== valleySlope) {
        const interceptDiff =
          lowerBoundary1.price -
          upperBoundary1.price -
          (lowerBoundary1.index - upperBoundary1.index) *
            (valleySlope - peakSlope);
        convergenceIndex =
          upperBoundary1.index + interceptDiff / (valleySlope - peakSlope);
      }

      // 计算当前是否接近收敛点
      const proximityToConvergence =
        1 - Math.min(1, Math.abs(currentIndex - convergenceIndex) / 20);

      // 确定当前价格相对于楔形的位置
      const currentPrice = data[data.length - 1].close;
      let status = PatternStatus.Forming;

      if (currentIndex > endIndex) {
        if (currentPrice < projectedLowerBoundary) {
          status = PatternStatus.Confirmed; // 已突破下方
        } else if (currentPrice > projectedUpperBoundary) {
          status = PatternStatus.Failed; // 意外向上突破
        } else {
          status = PatternStatus.Completed; // 形成但未突破
        }
      }

      // 计算形态高度（在结束点的高度）
      const patternHeight = projectedUpperBoundary - projectedLowerBoundary;

      // 计算价格目标（向下突破的目标，通常是形态起始点的价格）
      const startHeight = upperBoundary1.price - lowerBoundary1.price;
      const priceTarget = lowerBoundary1.price - startHeight;

      // 计算可靠性分数
      const reliability = calculateWedgeReliability(
        data,
        startIndex,
        endIndex,
        patternHeight,
        proximityToConvergence,
        status === PatternStatus.Confirmed,
        PatternType.RisingWedge
      );

      patterns.push({
        patternType: PatternType.RisingWedge,
        status,
        direction: PatternDirection.Bearish,
        reliability,
        significance: reliability * (patternHeight / currentPrice),
        component: {
          startIndex,
          endIndex,
          keyPoints: [
            upperBoundary1,
            upperBoundary2,
            lowerBoundary1,
            lowerBoundary2,
          ],
          patternHeight,
          breakoutLevel: projectedLowerBoundary,
          volumePattern: analyzeWedgeVolume(data, startIndex, endIndex, status),
        },
        priceTarget,
        stopLoss: projectedUpperBoundary * 1.02, // 上边界上方2%
        breakoutExpected:
          status === PatternStatus.Completed && proximityToConvergence > 0.7,
        breakoutDirection: PatternDirection.Bearish,
        probableBreakoutZone: [
          projectedLowerBoundary * 0.98,
          projectedLowerBoundary * 1.02,
        ],
        description: `上升楔形, ${getStatusDescription(status)}, 上边界当前在 ${projectedUpperBoundary.toFixed(2)}, 下边界当前在 ${projectedLowerBoundary.toFixed(2)}`,
        tradingImplication: `看跌信号, 目标价位: ${priceTarget.toFixed(2)}, 止损位: ${(projectedUpperBoundary * 1.02).toFixed(2)}`,
      });
    }
  }

  // 寻找下降楔形（看涨）
  // 下降楔形：上部边界和下部边界都向下倾斜，但下部边界倾斜更缓
  if (peaks.length >= 2 && valleys.length >= 2) {
    const peakSlope =
      (peaks[peaks.length - 1].price - peaks[peaks.length - 2].price) /
      (peaks[peaks.length - 1].index - peaks[peaks.length - 2].index);

    const valleySlope =
      (valleys[valleys.length - 1].price - valleys[valleys.length - 2].price) /
      (valleys[valleys.length - 1].index - valleys[valleys.length - 2].index);

    // 检查两条边界线是否都向下倾斜，且下部边界倾斜更缓
    if (peakSlope < 0 && valleySlope < 0 && valleySlope > peakSlope) {
      // 计算下降楔形的上部边界
      const upperBoundary1 = peaks[peaks.length - 2];
      const upperBoundary2 = peaks[peaks.length - 1];

      // 计算下降楔形的下部边界
      const lowerBoundary1 = valleys[valleys.length - 2];
      const lowerBoundary2 = valleys[valleys.length - 1];

      // 确定形态开始和结束的索引
      const startIndex = Math.min(upperBoundary1.index, lowerBoundary1.index);
      const endIndex = Math.max(upperBoundary2.index, lowerBoundary2.index);

      // 计算当前的预期边界位置
      const currentIndex = data.length - 1;
      const projectedUpperBoundary =
        upperBoundary1.price +
        peakSlope * (currentIndex - upperBoundary1.index);
      const projectedLowerBoundary =
        lowerBoundary1.price +
        valleySlope * (currentIndex - lowerBoundary1.index);

      // 计算收敛点
      let convergenceIndex = upperBoundary1.index;

      if (peakSlope !== valleySlope) {
        const interceptDiff =
          lowerBoundary1.price -
          upperBoundary1.price -
          (lowerBoundary1.index - upperBoundary1.index) *
            (valleySlope - peakSlope);
        convergenceIndex =
          upperBoundary1.index + interceptDiff / (valleySlope - peakSlope);
      }

      // 计算当前是否接近收敛点
      const proximityToConvergence =
        1 - Math.min(1, Math.abs(currentIndex - convergenceIndex) / 20);

      // 确定当前价格相对于楔形的位置
      const currentPrice = data[data.length - 1].close;
      let status = PatternStatus.Forming;

      if (currentIndex > endIndex) {
        if (currentPrice > projectedUpperBoundary) {
          status = PatternStatus.Confirmed; // 已突破上方
        } else if (currentPrice < projectedLowerBoundary) {
          status = PatternStatus.Failed; // 意外向下突破
        } else {
          status = PatternStatus.Completed; // 形成但未突破
        }
      }

      // 计算形态高度（在结束点的高度）
      const patternHeight = projectedUpperBoundary - projectedLowerBoundary;

      // 计算价格目标（向上突破的目标，通常是形态起始点的价格）
      const startHeight = upperBoundary1.price - lowerBoundary1.price;
      const priceTarget = upperBoundary1.price + startHeight;

      // 计算可靠性分数
      const reliability = calculateWedgeReliability(
        data,
        startIndex,
        endIndex,
        patternHeight,
        proximityToConvergence,
        status === PatternStatus.Confirmed,
        PatternType.FallingWedge
      );

      patterns.push({
        patternType: PatternType.FallingWedge,
        status,
        direction: PatternDirection.Bullish,
        reliability,
        significance: reliability * (patternHeight / currentPrice),
        component: {
          startIndex,
          endIndex,
          keyPoints: [
            upperBoundary1,
            upperBoundary2,
            lowerBoundary1,
            lowerBoundary2,
          ],
          patternHeight,
          breakoutLevel: projectedUpperBoundary,
          volumePattern: analyzeWedgeVolume(data, startIndex, endIndex, status),
        },
        priceTarget,
        stopLoss: projectedLowerBoundary * 0.98, // 下边界下方2%
        breakoutExpected:
          status === PatternStatus.Completed && proximityToConvergence > 0.7,
        breakoutDirection: PatternDirection.Bullish,
        probableBreakoutZone: [
          projectedUpperBoundary * 0.98,
          projectedUpperBoundary * 1.02,
        ],
        description: `下降楔形, ${getStatusDescription(status)}, 上边界当前在 ${projectedUpperBoundary.toFixed(2)}, 下边界当前在 ${projectedLowerBoundary.toFixed(2)}`,
        tradingImplication: `看涨信号, 目标价位: ${priceTarget.toFixed(2)}, 止损位: ${(projectedLowerBoundary * 0.98).toFixed(2)}`,
      });
    }
  }

  return patterns;
}

/**
 * 计算楔形形态的可靠性
 */
function calculateWedgeReliability(
  data: Candle[],
  startIndex: number,
  endIndex: number,
  patternHeight: number,
  proximityToConvergence: number,
  isBreakoutConfirmed: boolean,
  patternType: PatternType
): number {
  let score = 50; // 初始可靠性分数

  // 1. 形态持续时间（通常越长越好）
  const duration = endIndex - startIndex;
  if (duration > 20) score += 15;
  else if (duration > 10) score += 10;
  else score += 5;

  // 2. 形态收敛程度
  score += proximityToConvergence * 15;

  // 3. 确认突破
  if (isBreakoutConfirmed) score += 15;

  // 4. 形态与趋势的关系
  if (patternType === PatternType.RisingWedge) {
    // 上升楔形在上升趋势末期更可靠
    // 这里简化处理，实际应考虑趋势
    score += 5;
  } else if (patternType === PatternType.FallingWedge) {
    // 下降楔形在下降趋势末期更可靠
    score += 5;
  }

  // 5. 楔形角度（越窄越好）
  // 简化处理，假设已经是合理的楔形
  score += 5;

  // 最后确保分数在0-100范围内
  return Math.max(0, Math.min(100, score));
}

/**
 * 分析楔形形态的成交量特征
 */
function analyzeWedgeVolume(
  data: Candle[],
  startIndex: number,
  endIndex: number,
  status: PatternStatus
): string {
  const volumes = data.slice(startIndex, endIndex + 1).map(d => d.volume);
  const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;

  // 检查突破时的成交量
  let breakoutVolume = 0;
  if (status === PatternStatus.Confirmed && endIndex + 1 < data.length) {
    breakoutVolume = data[endIndex + 1].volume;
  }

  // 检查形态过程中的成交量趋势
  const firstHalfAvg =
    volumes
      .slice(0, Math.ceil(volumes.length / 2))
      .reduce((sum, v) => sum + v, 0) / Math.ceil(volumes.length / 2);

  const secondHalfAvg =
    volumes
      .slice(Math.ceil(volumes.length / 2))
      .reduce((sum, v) => sum + v, 0) /
    (volumes.length - Math.ceil(volumes.length / 2));

  const volumeTrendRatio = secondHalfAvg / firstHalfAvg;

  if (volumeTrendRatio < 0.8) {
    // 成交量减少是楔形形态的理想情况
    if (
      status === PatternStatus.Confirmed &&
      breakoutVolume > avgVolume * 1.5
    ) {
      return '理想的成交量模式：形态期间成交量逐渐减少，突破时成交量明显放大';
    } else {
      return '良好的成交量模式：形态期间成交量逐渐减少';
    }
  } else if (volumeTrendRatio > 1.2) {
    return '非典型的成交量模式：形态期间成交量增加而非减少，降低形态可靠性';
  } else {
    return '成交量模式中性，无明显趋势';
  }
}

/**
 * 寻找旗形和三角旗形态
 */
function findFlagsAndPennants(
  data: Candle[],
  peaksValleys: PeakValley[],
  lookbackPeriod: number = 30
): PatternAnalysisResult[] {
  const patterns: PatternAnalysisResult[] = [];

  // 确保有足够的数据
  if (data.length < lookbackPeriod) {
    return patterns;
  }

  // 检测之前的趋势
  const trendDetectionPeriod = Math.min(lookbackPeriod, 20);
  const priorCandles = data.slice(
    data.length - lookbackPeriod,
    data.length - lookbackPeriod + trendDetectionPeriod
  );

  // 计算趋势强度
  let upMoves = 0;
  let downMoves = 0;

  for (let i = 1; i < priorCandles.length; i++) {
    if (priorCandles[i].close > priorCandles[i - 1].close) upMoves++;
    else if (priorCandles[i].close < priorCandles[i - 1].close) downMoves++;
  }

  const isBullishTrend = upMoves > downMoves * 1.5;
  const isBearishTrend = downMoves > upMoves * 1.5;

  // 如果没有明显趋势，直接返回
  if (!isBullishTrend && !isBearishTrend) {
    return patterns;
  }

  // 用于旗形的最小和最大天数
  const minDuration = 5;
  const maxDuration = 20;

  // 旗杆的最小移动百分比
  const minFlagpoleMove = 0.05; // 5%

  // 寻找潜在的旗杆
  let flagpoleStartIndex = -1;
  let flagpoleEndIndex = -1;
  let flagpolePrice = 0;

  if (isBullishTrend) {
    // 在看涨趋势中寻找向上的旗杆
    for (
      let i = data.length - lookbackPeriod;
      i < data.length - maxDuration;
      i++
    ) {
      const moveEnd = Math.min(i + 10, data.length - maxDuration);
      const lowPrice = data[i].low;
      const highPrice = Math.max(...data.slice(i, moveEnd).map(d => d.high));

      if ((highPrice - lowPrice) / lowPrice > minFlagpoleMove) {
        flagpoleStartIndex = i;
        // 找出旗杆结束的点
        for (let j = i + 1; j < moveEnd; j++) {
          if (data[j].high >= highPrice * 0.98) {
            flagpoleEndIndex = j;
            flagpolePrice = highPrice;
            break;
          }
        }

        if (flagpoleEndIndex > flagpoleStartIndex) break;
      }
    }

    // 旗杆后寻找旗形或三角旗
    if (flagpoleEndIndex > flagpoleStartIndex) {
      const consolidationStart = flagpoleEndIndex;
      const consolidationEnd = Math.min(
        consolidationStart + maxDuration,
        data.length - 1
      );

      // 检查是否形成了旗形（向下倾斜的通道）
      let isFlag = true;
      let upperSlope = 0;
      let lowerSlope = 0;

      // 寻找旗形的上下边界
      const upper = [];
      const lower = [];

      for (let i = consolidationStart; i < consolidationEnd; i++) {
        upper.push(data[i].high);
        lower.push(data[i].low);
      }

      // 简化的线性回归
      upperSlope = (upper[upper.length - 1] - upper[0]) / upper.length;
      lowerSlope = (lower[lower.length - 1] - lower[0]) / lower.length;

      // 旗形通常是平行通道，且在上升趋势后向下倾斜
      isFlag =
        upperSlope < 0 &&
        lowerSlope < 0 &&
        Math.abs(upperSlope - lowerSlope) / Math.abs(upperSlope) < 0.3;

      if (isFlag && consolidationEnd - consolidationStart >= minDuration) {
        // 计算旗形的特性
        const flagDuration = consolidationEnd - consolidationStart;
        const flagHeight = upper[0] - lower[0];
        const flagpoleMagnitude = flagpolePrice - data[flagpoleStartIndex].low;

        // 计算价格目标（通常是旗杆的高度加到突破点）
        const breakoutPrice = upper[upper.length - 1];
        const priceTarget = breakoutPrice + flagpoleMagnitude;

        // 检查当前状态
        const currentPrice = data[data.length - 1].close;
        let status = PatternStatus.Forming;

        if (currentPrice > breakoutPrice) {
          status = PatternStatus.Confirmed;
        } else if (flagDuration > maxDuration) {
          status = PatternStatus.Failed;
        } else {
          status = PatternStatus.Completed;
        }

        // 计算可靠性
        const reliability = calculateFlagReliability(
          data,
          flagpoleStartIndex,
          flagpoleEndIndex,
          consolidationStart,
          consolidationEnd,
          flagpoleMagnitude,
          flagHeight,
          status === PatternStatus.Confirmed
        );

        patterns.push({
          patternType: PatternType.Flag,
          status,
          direction: PatternDirection.Bullish,
          reliability,
          significance: reliability * (flagpoleMagnitude / currentPrice),
          component: {
            startIndex: flagpoleStartIndex,
            endIndex: consolidationEnd,
            keyPoints: [], // 简化，不详细指定关键点
            patternHeight: flagHeight,
            breakoutLevel: breakoutPrice,
            volumePattern: analyzeFlagVolume(
              data,
              flagpoleStartIndex,
              flagpoleEndIndex,
              consolidationStart,
              consolidationEnd
            ),
          },
          priceTarget,
          stopLoss: lower[lower.length - 1],
          breakoutExpected: status === PatternStatus.Completed,
          breakoutDirection: PatternDirection.Bullish,
          probableBreakoutZone: [breakoutPrice * 0.99, breakoutPrice * 1.01],
          description: `看涨旗形, ${getStatusDescription(status)}, 旗杆高度: ${flagpoleMagnitude.toFixed(2)}, 突破位: ${breakoutPrice.toFixed(2)}`,
          tradingImplication: `看涨信号, 目标价位: ${priceTarget.toFixed(2)}, 止损位: ${lower[lower.length - 1].toFixed(2)}`,
        });
      } else {
        // 检查是否形成了三角旗（收敛的边界）
        const isPennant = upperSlope < 0 && lowerSlope > 0;

        if (isPennant && consolidationEnd - consolidationStart >= minDuration) {
          // 三角旗的特性
          const pennantDuration = consolidationEnd - consolidationStart;
          const pennantHeight = upper[0] - lower[0];
          const flagpoleMagnitude =
            flagpolePrice - data[flagpoleStartIndex].low;

          // 计算收敛点
          const upperStartPrice = upper[0];
          const lowerStartPrice = lower[0];

          // 简化的计算
          const convergenceIndex =
            consolidationStart +
            (upperStartPrice - lowerStartPrice) / (lowerSlope - upperSlope);

          // 检查当前价格相对于三角旗的位置
          const currentPrice = data[data.length - 1].close;
          const currentIndex = data.length - 1;

          const projectedUpper =
            upperStartPrice + upperSlope * (currentIndex - consolidationStart);
          const projectedLower =
            lowerStartPrice + lowerSlope * (currentIndex - consolidationStart);

          let status = PatternStatus.Forming;

          if (currentPrice > projectedUpper) {
            status = PatternStatus.Confirmed;
          } else if (pennantDuration > maxDuration) {
            status = PatternStatus.Failed;
          } else {
            status = PatternStatus.Completed;
          }

          // 计算价格目标
          const breakoutPrice = projectedUpper;
          const priceTarget = breakoutPrice + flagpoleMagnitude;

          // 计算可靠性
          const reliability = calculatePennantReliability(
            data,
            flagpoleStartIndex,
            flagpoleEndIndex,
            consolidationStart,
            consolidationEnd,
            flagpoleMagnitude,
            pennantHeight,
            convergenceIndex,
            currentIndex,
            status === PatternStatus.Confirmed
          );

          patterns.push({
            patternType: PatternType.Pennant,
            status,
            direction: PatternDirection.Bullish,
            reliability,
            significance: reliability * (flagpoleMagnitude / currentPrice),
            component: {
              startIndex: flagpoleStartIndex,
              endIndex: consolidationEnd,
              keyPoints: [], // 简化，不详细指定关键点
              patternHeight: pennantHeight,
              breakoutLevel: breakoutPrice,
              volumePattern: analyzeFlagVolume(
                data,
                flagpoleStartIndex,
                flagpoleEndIndex,
                consolidationStart,
                consolidationEnd
              ),
            },
            priceTarget,
            stopLoss: projectedLower,
            breakoutExpected: status === PatternStatus.Completed,
            breakoutDirection: PatternDirection.Bullish,
            probableBreakoutZone: [breakoutPrice * 0.99, breakoutPrice * 1.01],
            description: `看涨三角旗, ${getStatusDescription(status)}, 旗杆高度: ${flagpoleMagnitude.toFixed(2)}, 突破位: ${breakoutPrice.toFixed(2)}`,
            tradingImplication: `看涨信号, 目标价位: ${priceTarget.toFixed(2)}, 止损位: ${projectedLower.toFixed(2)}`,
          });
        }
      }
    }
  } else if (isBearishTrend) {
    // 在看跌趋势中寻找向下的旗杆
    for (
      let i = data.length - lookbackPeriod;
      i < data.length - maxDuration;
      i++
    ) {
      const moveEnd = Math.min(i + 10, data.length - maxDuration);
      const highPrice = data[i].high;
      const lowPrice = Math.min(...data.slice(i, moveEnd).map(d => d.low));

      if ((highPrice - lowPrice) / highPrice > minFlagpoleMove) {
        flagpoleStartIndex = i;
        // 找出旗杆结束的点
        for (let j = i + 1; j < moveEnd; j++) {
          if (data[j].low <= lowPrice * 1.02) {
            flagpoleEndIndex = j;
            flagpolePrice = lowPrice;
            break;
          }
        }

        if (flagpoleEndIndex > flagpoleStartIndex) break;
      }
    }

    // 旗杆后寻找旗形或三角旗
    if (flagpoleEndIndex > flagpoleStartIndex) {
      const consolidationStart = flagpoleEndIndex;
      const consolidationEnd = Math.min(
        consolidationStart + maxDuration,
        data.length - 1
      );

      // 检查是否形成了旗形（向上倾斜的通道）
      let isFlag = true;
      let upperSlope = 0;
      let lowerSlope = 0;

      // 寻找旗形的上下边界
      const upper = [];
      const lower = [];

      for (let i = consolidationStart; i < consolidationEnd; i++) {
        upper.push(data[i].high);
        lower.push(data[i].low);
      }

      // 简化的线性回归
      upperSlope = (upper[upper.length - 1] - upper[0]) / upper.length;
      lowerSlope = (lower[lower.length - 1] - lower[0]) / lower.length;

      // 旗形通常是平行通道，且在下降趋势后向上倾斜
      isFlag =
        upperSlope > 0 &&
        lowerSlope > 0 &&
        Math.abs(upperSlope - lowerSlope) / Math.abs(upperSlope) < 0.3;

      if (isFlag && consolidationEnd - consolidationStart >= minDuration) {
        // 计算旗形的特性
        const flagDuration = consolidationEnd - consolidationStart;
        const flagHeight = upper[0] - lower[0];
        const flagpoleMagnitude = data[flagpoleStartIndex].high - flagpolePrice;

        // 计算价格目标（通常是旗杆的高度减去突破点）
        const breakoutPrice = lower[lower.length - 1];
        const priceTarget = breakoutPrice - flagpoleMagnitude;

        // 检查当前状态
        const currentPrice = data[data.length - 1].close;
        let status = PatternStatus.Forming;

        if (currentPrice < breakoutPrice) {
          status = PatternStatus.Confirmed;
        } else if (flagDuration > maxDuration) {
          status = PatternStatus.Failed;
        } else {
          status = PatternStatus.Completed;
        }

        // 计算可靠性
        const reliability = calculateFlagReliability(
          data,
          flagpoleStartIndex,
          flagpoleEndIndex,
          consolidationStart,
          consolidationEnd,
          flagpoleMagnitude,
          flagHeight,
          status === PatternStatus.Confirmed
        );

        patterns.push({
          patternType: PatternType.Flag,
          status,
          direction: PatternDirection.Bearish,
          reliability,
          significance: reliability * (flagpoleMagnitude / currentPrice),
          component: {
            startIndex: flagpoleStartIndex,
            endIndex: consolidationEnd,
            keyPoints: [], // 简化，不详细指定关键点
            patternHeight: flagHeight,
            breakoutLevel: breakoutPrice,
            volumePattern: analyzeFlagVolume(
              data,
              flagpoleStartIndex,
              flagpoleEndIndex,
              consolidationStart,
              consolidationEnd
            ),
          },
          priceTarget,
          stopLoss: upper[upper.length - 1],
          breakoutExpected: status === PatternStatus.Completed,
          breakoutDirection: PatternDirection.Bearish,
          probableBreakoutZone: [breakoutPrice * 0.99, breakoutPrice * 1.01],
          description: `看跌旗形, ${getStatusDescription(status)}, 旗杆高度: ${flagpoleMagnitude.toFixed(2)}, 突破位: ${breakoutPrice.toFixed(2)}`,
          tradingImplication: `看跌信号, 目标价位: ${priceTarget.toFixed(2)}, 止损位: ${upper[upper.length - 1].toFixed(2)}`,
        });
      } else {
        // 检查是否形成了三角旗（收敛的边界）
        const isPennant = upperSlope > 0 && lowerSlope < 0;

        if (isPennant && consolidationEnd - consolidationStart >= minDuration) {
          // 三角旗的特性
          const pennantDuration = consolidationEnd - consolidationStart;
          const pennantHeight = upper[0] - lower[0];
          const flagpoleMagnitude =
            data[flagpoleStartIndex].high - flagpolePrice;

          // 计算收敛点
          const upperStartPrice = upper[0];
          const lowerStartPrice = lower[0];

          // 简化的计算
          const convergenceIndex =
            consolidationStart +
            (upperStartPrice - lowerStartPrice) / (lowerSlope - upperSlope);

          // 检查当前价格相对于三角旗的位置
          const currentPrice = data[data.length - 1].close;
          const currentIndex = data.length - 1;

          const projectedUpper =
            upperStartPrice + upperSlope * (currentIndex - consolidationStart);
          const projectedLower =
            lowerStartPrice + lowerSlope * (currentIndex - consolidationStart);

          let status = PatternStatus.Forming;

          if (currentPrice < projectedLower) {
            status = PatternStatus.Confirmed;
          } else if (pennantDuration > maxDuration) {
            status = PatternStatus.Failed;
          } else {
            status = PatternStatus.Completed;
          }

          // 计算价格目标
          const breakoutPrice = projectedLower;
          const priceTarget = breakoutPrice - flagpoleMagnitude;

          // 计算可靠性
          const reliability = calculatePennantReliability(
            data,
            flagpoleStartIndex,
            flagpoleEndIndex,
            consolidationStart,
            consolidationEnd,
            flagpoleMagnitude,
            pennantHeight,
            convergenceIndex,
            currentIndex,
            status === PatternStatus.Confirmed
          );

          patterns.push({
            patternType: PatternType.Pennant,
            status,
            direction: PatternDirection.Bearish,
            reliability,
            significance: reliability * (flagpoleMagnitude / currentPrice),
            component: {
              startIndex: flagpoleStartIndex,
              endIndex: consolidationEnd,
              keyPoints: [], // 简化，不详细指定关键点
              patternHeight: pennantHeight,
              breakoutLevel: breakoutPrice,
              volumePattern: analyzeFlagVolume(
                data,
                flagpoleStartIndex,
                flagpoleEndIndex,
                consolidationStart,
                consolidationEnd
              ),
            },
            priceTarget,
            stopLoss: projectedUpper,
            breakoutExpected: status === PatternStatus.Completed,
            breakoutDirection: PatternDirection.Bearish,
            probableBreakoutZone: [breakoutPrice * 0.99, breakoutPrice * 1.01],
            description: `看跌三角旗, ${getStatusDescription(status)}, 旗杆高度: ${flagpoleMagnitude.toFixed(2)}, 突破位: ${breakoutPrice.toFixed(2)}`,
            tradingImplication: `看跌信号, 目标价位: ${priceTarget.toFixed(2)}, 止损位: ${projectedUpper.toFixed(2)}`,
          });
        }
      }
    }
  }

  return patterns;
}
/**
 * 计算旗形的可靠性
 */
function calculateFlagReliability(
  data: Candle[],
  flagpoleStartIndex: number,
  flagpoleEndIndex: number,
  consolidationStartIndex: number,
  consolidationEndIndex: number,
  flagpoleMagnitude: number,
  flagHeight: number,
  isBreakoutConfirmed: boolean
): number {
  let score = 50; // 初始可靠性分数

  // 1. 旗杆强度
  const avgPrice =
    data
      .slice(flagpoleStartIndex, flagpoleEndIndex + 1)
      .reduce((sum, d) => sum + d.close, 0) /
    (flagpoleEndIndex - flagpoleStartIndex + 1);
  const flagpoleStrength = flagpoleMagnitude / avgPrice;

  if (flagpoleStrength > 0.1)
    score += 15; // 旗杆移动超过10%
  else if (flagpoleStrength > 0.05)
    score += 10; // 旗杆移动超过5%
  else score += 5; // 旗杆移动较小

  // 2. 旗形持续时间（应该在合理范围内）
  const flagDuration = consolidationEndIndex - consolidationStartIndex;
  if (flagDuration >= 5 && flagDuration <= 15)
    score += 10; // 理想的持续时间
  else if (flagDuration > 15) score += 5; // 持续时间略长

  // 3. 旗形高度（相对于旗杆的高度）
  const heightRatio = flagHeight / flagpoleMagnitude;
  if (heightRatio <= 0.5)
    score += 15; // 旗形不超过旗杆一半高度，理想情况
  else if (heightRatio <= 0.7)
    score += 10; // 旗形高度适中
  else score += 5; // 旗形高度较大

  // 4. 旗杆成交量
  const flagpoleVolume =
    data
      .slice(flagpoleStartIndex, flagpoleEndIndex + 1)
      .reduce((sum, d) => sum + d.volume, 0) /
    (flagpoleEndIndex - flagpoleStartIndex + 1);
  const priorVolume =
    flagpoleStartIndex > 10
      ? data
          .slice(flagpoleStartIndex - 10, flagpoleStartIndex)
          .reduce((sum, d) => sum + d.volume, 0) / 10
      : flagpoleVolume;

  if (flagpoleVolume > priorVolume * 1.5)
    score += 10; // 旗杆期间成交量明显放大
  else if (flagpoleVolume > priorVolume * 1.2) score += 5; // 旗杆期间成交量稍微放大

  // 5. 确认突破
  if (isBreakoutConfirmed) score += 10;

  // 最后确保分数在0-100范围内
  return Math.max(0, Math.min(100, score));
}

/**
 * 计算三角旗的可靠性
 */
function calculatePennantReliability(
  data: Candle[],
  flagpoleStartIndex: number,
  flagpoleEndIndex: number,
  consolidationStartIndex: number,
  consolidationEndIndex: number,
  flagpoleMagnitude: number,
  pennantHeight: number,
  convergenceIndex: number,
  currentIndex: number,
  isBreakoutConfirmed: boolean
): number {
  let score = 50; // 初始可靠性分数

  // 1. 旗杆强度
  const avgPrice =
    data
      .slice(flagpoleStartIndex, flagpoleEndIndex + 1)
      .reduce((sum, d) => sum + d.close, 0) /
    (flagpoleEndIndex - flagpoleStartIndex + 1);
  const flagpoleStrength = flagpoleMagnitude / avgPrice;

  if (flagpoleStrength > 0.1)
    score += 15; // 旗杆移动超过10%
  else if (flagpoleStrength > 0.05)
    score += 10; // 旗杆移动超过5%
  else score += 5; // 旗杆移动较小

  // 2. 三角旗持续时间（应该在合理范围内）
  const pennantDuration = consolidationEndIndex - consolidationStartIndex;
  if (pennantDuration >= 5 && pennantDuration <= 15)
    score += 10; // 理想的持续时间
  else if (pennantDuration > 15) score += 5; // 持续时间略长

  // 3. 收敛点的接近程度
  const proximityToConvergence =
    1 - Math.min(1, Math.abs(currentIndex - convergenceIndex) / 20);
  score += proximityToConvergence * 10;

  // 4. 旗杆成交量
  const flagpoleVolume =
    data
      .slice(flagpoleStartIndex, flagpoleEndIndex + 1)
      .reduce((sum, d) => sum + d.volume, 0) /
    (flagpoleEndIndex - flagpoleStartIndex + 1);
  const priorVolume =
    flagpoleStartIndex > 10
      ? data
          .slice(flagpoleStartIndex - 10, flagpoleStartIndex)
          .reduce((sum, d) => sum + d.volume, 0) / 10
      : flagpoleVolume;

  if (flagpoleVolume > priorVolume * 1.5)
    score += 10; // 旗杆期间成交量明显放大
  else if (flagpoleVolume > priorVolume * 1.2) score += 5; // 旗杆期间成交量稍微放大

  // 5. 确认突破
  if (isBreakoutConfirmed) score += 10;

  // 最后确保分数在0-100范围内
  return Math.max(0, Math.min(100, score));
}

/**
 * 分析旗形和三角旗的成交量特征
 */
function analyzeFlagVolume(
  data: Candle[],
  flagpoleStartIndex: number,
  flagpoleEndIndex: number,
  consolidationStartIndex: number,
  consolidationEndIndex: number
): string {
  // 计算旗杆成交量
  const flagpoleVolumes = data
    .slice(flagpoleStartIndex, flagpoleEndIndex + 1)
    .map(d => d.volume);
  const avgFlagpoleVolume =
    flagpoleVolumes.reduce((sum, v) => sum + v, 0) / flagpoleVolumes.length;

  // 计算整理期成交量
  const consolidationVolumes = data
    .slice(consolidationStartIndex, consolidationEndIndex + 1)
    .map(d => d.volume);
  const avgConsolidationVolume =
    consolidationVolumes.reduce((sum, v) => sum + v, 0) /
    consolidationVolumes.length;

  // 计算整理期内的成交量趋势
  let volumeTrend = 0;
  for (let i = 1; i < consolidationVolumes.length; i++) {
    volumeTrend +=
      consolidationVolumes[i] > consolidationVolumes[i - 1] ? 1 : -1;
  }

  // 检查突破时的成交量
  let breakoutVolume = 0;
  if (consolidationEndIndex + 1 < data.length) {
    breakoutVolume = data[consolidationEndIndex + 1].volume;
  }

  if (avgConsolidationVolume < avgFlagpoleVolume * 0.7) {
    // 理想情况：整理期间成交量萎缩
    if (breakoutVolume > avgConsolidationVolume * 1.5) {
      return '理想的成交量模式：旗杆成交量大，整理期成交量萎缩，突破时成交量放大';
    } else {
      return '良好的成交量模式：旗杆成交量大，整理期成交量萎缩';
    }
  } else if (volumeTrend < 0) {
    return '可接受的成交量模式：整理期内成交量逐渐减少';
  } else {
    return '非理想的成交量模式：整理期内成交量没有明显萎缩，降低形态可靠性';
  }
}

/**
 * 寻找杯柄形态 (Cup and Handle)
 */
function findCupAndHandle(
  data: Candle[],
  peaksValleys: PeakValley[],
  lookbackPeriod: number = 60
): PatternAnalysisResult[] {
  const patterns: PatternAnalysisResult[] = [];

  // 确保有足够的数据
  if (data.length < lookbackPeriod) {
    return patterns;
  }

  // 过滤出最近的峰谷
  const recentPoints = peaksValleys.filter(
    p => p.index >= data.length - lookbackPeriod
  );

  // 排序，确保按时间顺序
  recentPoints.sort((a, b) => a.index - b.index);

  // 分别获取峰和谷
  const peaks = recentPoints.filter(p => p.type === 'peak');
  const valleys = recentPoints.filter(p => p.type === 'valley');

  // 杯柄形态需要一定的峰谷结构
  if (peaks.length < 2 || valleys.length < 1) {
    return patterns;
  }

  // 寻找潜在的杯部分
  for (let i = 0; i < peaks.length - 1; i++) {
    const leftPeak = peaks[i];

    // 寻找杯底
    const cupBottomCandidates = valleys.filter(
      v => v.index > leftPeak.index && v.index < peaks[i + 1].index
    );

    if (cupBottomCandidates.length > 0) {
      const cupBottom = cupBottomCandidates.reduce((deepest, current) =>
        current.price < deepest.price ? current : deepest
      );

      const rightPeak = peaks[i + 1];

      // 验证杯的形状：两侧的高点应该大致相等，且明显高于杯底
      const peaksDiff =
        Math.abs(rightPeak.price - leftPeak.price) / leftPeak.price;
      const cupDepth =
        ((leftPeak.price + rightPeak.price) / 2 - cupBottom.price) /
        ((leftPeak.price + rightPeak.price) / 2);

      if (peaksDiff < 0.05 && cupDepth > 0.1) {
        // 杯的时间跨度应该合理
        const cupDuration = rightPeak.index - leftPeak.index;

        if (cupDuration >= 15 && cupDuration <= lookbackPeriod) {
          // 寻找杯后的柄部分
          // 柄通常是一个较小的回调，形成小的旗形或三角旗
          const handleStartIndex = rightPeak.index;
          const handleEndIndex = Math.min(
            handleStartIndex + 15,
            data.length - 1
          );

          // 检查柄的形状：应该是一个小的回调，不超过杯深度的一半
          let hasValidHandle = false;
          let handleLow = rightPeak.price;
          let handleEndPrice = rightPeak.price;

          for (let j = handleStartIndex + 1; j <= handleEndIndex; j++) {
            if (data[j].low < handleLow) {
              handleLow = data[j].low;
            }

            handleEndPrice = data[j].close;
          }

          const handleDepth = (rightPeak.price - handleLow) / rightPeak.price;

          if (handleDepth <= cupDepth / 2 && handleDepth > 0.03) {
            hasValidHandle = true;
          }

          if (hasValidHandle) {
            // 计算颈线位置：通常是杯的顶部
            const necklinePrice = Math.max(leftPeak.price, rightPeak.price);

            // 当前价格相对于颈线的位置
            const currentPrice = data[data.length - 1].close;
            let status = PatternStatus.Forming;

            if (currentPrice > necklinePrice * 1.01) {
              status = PatternStatus.Confirmed; // 已突破颈线
            } else if (handleEndIndex < data.length - 1) {
              status = PatternStatus.Completed; // 形态完成但未突破
            }

            // 计算价格目标：通常是杯的深度加到颈线上
            const cupHeight = necklinePrice - cupBottom.price;
            const priceTarget = necklinePrice + cupHeight;

            // 计算可靠性分数
            const reliability = calculateCupAndHandleReliability(
              data,
              leftPeak.index,
              cupBottom.index,
              rightPeak.index,
              handleEndIndex,
              cupDepth,
              handleDepth,
              status === PatternStatus.Confirmed
            );

            patterns.push({
              patternType: PatternType.CupAndHandle,
              status,
              direction: PatternDirection.Bullish,
              reliability,
              significance: reliability * (cupHeight / currentPrice),
              component: {
                startIndex: leftPeak.index,
                endIndex: handleEndIndex,
                keyPoints: [leftPeak, cupBottom, rightPeak],
                patternHeight: cupHeight,
                breakoutLevel: necklinePrice,
                volumePattern: analyzeCupAndHandleVolume(
                  data,
                  leftPeak.index,
                  cupBottom.index,
                  rightPeak.index,
                  handleEndIndex
                ),
              },
              priceTarget,
              stopLoss: handleLow,
              breakoutExpected: status === PatternStatus.Completed,
              breakoutDirection: PatternDirection.Bullish,
              probableBreakoutZone: [
                necklinePrice * 0.99,
                necklinePrice * 1.02,
              ],
              description: `杯柄形态, ${getStatusDescription(status)}, 杯深度: ${(cupDepth * 100).toFixed(1)}%, 颈线位置在 ${necklinePrice.toFixed(2)}`,
              tradingImplication: `看涨信号, 目标价位: ${priceTarget.toFixed(2)}, 止损位: ${handleLow.toFixed(2)}`,
            });
          }
        }
      }
    }
  }

  return patterns;
}

/**
 * 计算杯柄形态的可靠性
 */
function calculateCupAndHandleReliability(
  data: Candle[],
  leftPeakIndex: number,
  cupBottomIndex: number,
  rightPeakIndex: number,
  handleEndIndex: number,
  cupDepth: number,
  handleDepth: number,
  isBreakoutConfirmed: boolean
): number {
  let score = 50; // 初始可靠性分数

  // 1. 杯的对称性
  const leftSideLength = cupBottomIndex - leftPeakIndex;
  const rightSideLength = rightPeakIndex - cupBottomIndex;
  const symmetryRatio =
    Math.min(leftSideLength, rightSideLength) /
    Math.max(leftSideLength, rightSideLength);

  if (symmetryRatio > 0.8)
    score += 15; // 高度对称
  else if (symmetryRatio > 0.6)
    score += 10; // 中等对称
  else score += 5; // 较低对称

  // 2. 杯的深度
  if (cupDepth >= 0.15 && cupDepth <= 0.3)
    score += 15; // 理想的深度
  else if (cupDepth > 0.3)
    score += 10; // 深度较大
  else score += 5; // 深度较浅

  // 3. 杯的时间跨度
  const cupDuration = rightPeakIndex - leftPeakIndex;
  if (cupDuration >= 20 && cupDuration <= 50)
    score += 10; // 理想的时间跨度
  else if (cupDuration > 50) score += 5; // 时间跨度较长

  // 4. 柄的形状和深度
  if (handleDepth >= 0.05 && handleDepth <= 0.15)
    score += 10; // 理想的柄深度
  else score += 5; // 柄深度不理想

  // 5. 确认突破
  if (isBreakoutConfirmed) score += 15;

  // 最后确保分数在0-100范围内
  return Math.max(0, Math.min(100, score));
}

/**
 * 分析杯柄形态的成交量特征
 */
function analyzeCupAndHandleVolume(
  data: Candle[],
  leftPeakIndex: number,
  cupBottomIndex: number,
  rightPeakIndex: number,
  handleEndIndex: number
): string {
  // 计算杯左侧成交量
  const leftSideVolumes = data
    .slice(leftPeakIndex, cupBottomIndex + 1)
    .map(d => d.volume);
  const avgLeftSideVolume =
    leftSideVolumes.reduce((sum, v) => sum + v, 0) / leftSideVolumes.length;

  // 计算杯右侧成交量
  const rightSideVolumes = data
    .slice(cupBottomIndex, rightPeakIndex + 1)
    .map(d => d.volume);
  const avgRightSideVolume =
    rightSideVolumes.reduce((sum, v) => sum + v, 0) / rightSideVolumes.length;

  // 计算柄部分成交量
  const handleVolumes = data
    .slice(rightPeakIndex, handleEndIndex + 1)
    .map(d => d.volume);
  const avgHandleVolume =
    handleVolumes.reduce((sum, v) => sum + v, 0) / handleVolumes.length;

  // 检查突破时的成交量
  let breakoutVolume = 0;
  if (handleEndIndex + 1 < data.length) {
    breakoutVolume = data[handleEndIndex + 1].volume;
  }

  // 理想的成交量模式：右侧成交量大于左侧，柄部分成交量萎缩，突破时放量
  if (
    avgRightSideVolume > avgLeftSideVolume * 1.2 &&
    avgHandleVolume < avgRightSideVolume * 0.7
  ) {
    if (breakoutVolume > avgHandleVolume * 1.5) {
      return '理想的成交量模式：右侧成交量大于左侧，柄部成交量萎缩，突破时成交量明显放大';
    } else {
      return '良好的成交量模式：右侧成交量大于左侧，柄部成交量萎缩';
    }
  } else if (avgHandleVolume < avgRightSideVolume * 0.8) {
    return '可接受的成交量模式：柄部成交量萎缩';
  } else {
    return '非理想的成交量模式：成交量特征不符合典型杯柄形态要求，降低形态可靠性';
  }
}

/**
 * 寻找圆底/圆顶形态
 */
function findRoundingPatterns(
  data: Candle[],
  peaksValleys: PeakValley[],
  lookbackPeriod: number = 60
): PatternAnalysisResult[] {
  const patterns: PatternAnalysisResult[] = [];

  // 确保有足够的数据
  if (data.length < lookbackPeriod) {
    return patterns;
  }

  // 检测圆底形态 (看涨)
  const potentialRoundingBottom = true;
  let roundBottomStart = -1;
  let roundBottomEnd = -1;
  let lowestPoint = -1;

  // 简化的圆底检测：通过检查价格序列是否呈现U形
  const recentData = data.slice(data.length - lookbackPeriod);
  const smoothedPrices = [];

  // 使用简单的移动平均来平滑价格
  const smoothingPeriod = 5;
  for (let i = smoothingPeriod - 1; i < recentData.length; i++) {
    const avgPrice =
      recentData
        .slice(i - (smoothingPeriod - 1), i + 1)
        .reduce((sum, d) => sum + d.close, 0) / smoothingPeriod;
    smoothedPrices.push(avgPrice);
  }

  // 寻找最低点
  let minPrice = Number.MAX_VALUE;
  let minIndex = -1;

  for (let i = 0; i < smoothedPrices.length; i++) {
    if (smoothedPrices[i] < minPrice) {
      minPrice = smoothedPrices[i];
      minIndex = i;
    }
  }

  // 如果最低点不在序列的开始或结束附近
  if (
    minIndex > smoothedPrices.length * 0.2 &&
    minIndex < smoothedPrices.length * 0.8
  ) {
    // 检查左侧是否大致下降
    let leftSideRising = false;
    for (let i = 1; i <= Math.min(10, minIndex); i++) {
      if (smoothedPrices[minIndex - i] < smoothedPrices[minIndex - i + 1]) {
        leftSideRising = true;
        break;
      }
    }

    // 检查右侧是否大致上升
    let rightSideFalling = false;
    for (
      let i = 1;
      i <= Math.min(10, smoothedPrices.length - minIndex - 1);
      i++
    ) {
      if (smoothedPrices[minIndex + i] < smoothedPrices[minIndex + i - 1]) {
        rightSideFalling = true;
        break;
      }
    }

    if (!leftSideRising && !rightSideFalling) {
      // 可能是圆底形态
      roundBottomStart = data.length - lookbackPeriod + minIndex - 10;
      lowestPoint = data.length - lookbackPeriod + minIndex;
      roundBottomEnd = data.length - lookbackPeriod + minIndex + 10;

      // 计算形态特性
      const roundingStartPrice = data[roundBottomStart].close;
      const roundingBottomPrice = data[lowestPoint].low;
      const roundingEndPrice = data[roundBottomEnd].close;
      const roundingHeight =
        Math.min(roundingStartPrice, roundingEndPrice) - roundingBottomPrice;

      // 计算颈线
      const necklinePrice = Math.max(roundingStartPrice, roundingEndPrice);

      // 检查当前状态
      const currentPrice = data[data.length - 1].close;
      let status = PatternStatus.Forming;

      if (roundBottomEnd < data.length - 1) {
        if (currentPrice > necklinePrice) {
          status = PatternStatus.Confirmed;
        } else {
          status = PatternStatus.Completed;
        }
      }

      // 价格目标
      const priceTarget = necklinePrice + roundingHeight;

      // 计算可靠性
      const reliability = calculateRoundingPatternReliability(
        data,
        roundBottomStart,
        lowestPoint,
        roundBottomEnd,
        roundingHeight,
        true,
        status === PatternStatus.Confirmed
      );

      patterns.push({
        patternType: PatternType.RoundingBottom,
        status,
        direction: PatternDirection.Bullish,
        reliability,
        significance: reliability * (roundingHeight / currentPrice),
        component: {
          startIndex: roundBottomStart,
          endIndex: roundBottomEnd,
          keyPoints: [], // 简化，不详细指定关键点
          patternHeight: roundingHeight,
          breakoutLevel: necklinePrice,
          volumePattern: analyzeRoundingPatternVolume(
            data,
            roundBottomStart,
            lowestPoint,
            roundBottomEnd,
            true
          ),
        },
        priceTarget,
        stopLoss: roundingBottomPrice,
        breakoutExpected: status === PatternStatus.Completed,
        breakoutDirection: PatternDirection.Bullish,
        probableBreakoutZone: [necklinePrice * 0.99, necklinePrice * 1.02],
        description: `圆底形态, ${getStatusDescription(status)}, 形态高度: ${roundingHeight.toFixed(2)}, 颈线位置在 ${necklinePrice.toFixed(2)}`,
        tradingImplication: `看涨信号, 目标价位: ${priceTarget.toFixed(2)}, 止损位: ${roundingBottomPrice.toFixed(2)}`,
      });
    }
  }

  // 检测圆顶形态 (看跌)
  const potentialRoundingTop = true;
  let roundTopStart = -1;
  let roundTopEnd = -1;
  let highestPoint = -1;

  // 重置平滑价格数组
  smoothedPrices.length = 0;

  // 再次平滑价格
  for (let i = smoothingPeriod - 1; i < recentData.length; i++) {
    const avgPrice =
      recentData
        .slice(i - (smoothingPeriod - 1), i + 1)
        .reduce((sum, d) => sum + d.close, 0) / smoothingPeriod;
    smoothedPrices.push(avgPrice);
  }

  // 寻找最高点
  let maxPrice = -Number.MAX_VALUE;
  let maxIndex = -1;

  for (let i = 0; i < smoothedPrices.length; i++) {
    if (smoothedPrices[i] > maxPrice) {
      maxPrice = smoothedPrices[i];
      maxIndex = i;
    }
  }

  // 如果最高点不在序列的开始或结束附近
  if (
    maxIndex > smoothedPrices.length * 0.2 &&
    maxIndex < smoothedPrices.length * 0.8
  ) {
    // 检查左侧是否大致上升
    let leftSideFalling = false;
    for (let i = 1; i <= Math.min(10, maxIndex); i++) {
      if (smoothedPrices[maxIndex - i] > smoothedPrices[maxIndex - i + 1]) {
        leftSideFalling = true;
        break;
      }
    }

    // 检查右侧是否大致下降
    let rightSideRising = false;
    for (
      let i = 1;
      i <= Math.min(10, smoothedPrices.length - maxIndex - 1);
      i++
    ) {
      if (smoothedPrices[maxIndex + i] > smoothedPrices[maxIndex + i - 1]) {
        rightSideRising = true;
        break;
      }
    }

    if (!leftSideFalling && !rightSideRising) {
      // 可能是圆顶形态
      roundTopStart = data.length - lookbackPeriod + maxIndex - 10;
      highestPoint = data.length - lookbackPeriod + maxIndex;
      roundTopEnd = data.length - lookbackPeriod + maxIndex + 10;

      // 计算形态特性
      const roundingStartPrice = data[roundTopStart].close;
      const roundingTopPrice = data[highestPoint].high;
      const roundingEndPrice = data[roundTopEnd].close;
      const roundingHeight =
        roundingTopPrice - Math.max(roundingStartPrice, roundingEndPrice);

      // 计算颈线
      const necklinePrice = Math.min(roundingStartPrice, roundingEndPrice);

      // 检查当前状态
      const currentPrice = data[data.length - 1].close;
      let status = PatternStatus.Forming;

      if (roundTopEnd < data.length - 1) {
        if (currentPrice < necklinePrice) {
          status = PatternStatus.Confirmed;
        } else {
          status = PatternStatus.Completed;
        }
      }

      // 价格目标
      const priceTarget = necklinePrice - roundingHeight;

      // 计算可靠性
      const reliability = calculateRoundingPatternReliability(
        data,
        roundTopStart,
        highestPoint,
        roundTopEnd,
        roundingHeight,
        false,
        status === PatternStatus.Confirmed
      );

      patterns.push({
        patternType: PatternType.RoundingTop,
        status,
        direction: PatternDirection.Bearish,
        reliability,
        significance: reliability * (roundingHeight / currentPrice),
        component: {
          startIndex: roundTopStart,
          endIndex: roundTopEnd,
          keyPoints: [], // 简化，不详细指定关键点
          patternHeight: roundingHeight,
          breakoutLevel: necklinePrice,
          volumePattern: analyzeRoundingPatternVolume(
            data,
            roundTopStart,
            highestPoint,
            roundTopEnd,
            false
          ),
        },
        priceTarget,
        stopLoss: roundingTopPrice,
        breakoutExpected: status === PatternStatus.Completed,
        breakoutDirection: PatternDirection.Bearish,
        probableBreakoutZone: [necklinePrice * 0.98, necklinePrice * 1.01],
        description: `圆顶形态, ${getStatusDescription(status)}, 形态高度: ${roundingHeight.toFixed(2)}, 颈线位置在 ${necklinePrice.toFixed(2)}`,
        tradingImplication: `看跌信号, 目标价位: ${priceTarget.toFixed(2)}, 止损位: ${roundingTopPrice.toFixed(2)}`,
      });
    }
  }

  return patterns;
}

/**
 * 计算圆底/圆顶形态的可靠性
 */
function calculateRoundingPatternReliability(
  data: Candle[],
  startIndex: number,
  peakValleyIndex: number,
  endIndex: number,
  patternHeight: number,
  isRoundingBottom: boolean,
  isBreakoutConfirmed: boolean
): number {
  let score = 50; // 初始可靠性分数

  // 1. 形态持续时间
  const duration = endIndex - startIndex;
  if (duration > 30)
    score += 15; // 持续时间较长
  else if (duration > 15)
    score += 10; // 持续时间中等
  else score += 5; // 持续时间较短

  // 2. 形态高度（相对于价格的百分比）
  const avgPrice =
    data.slice(startIndex, endIndex + 1).reduce((sum, d) => sum + d.close, 0) /
    (endIndex - startIndex + 1);
  const heightRatio = patternHeight / avgPrice;

  if (heightRatio > 0.1)
    score += 10; // 形态高度明显
  else if (heightRatio > 0.05) score += 5; // 形态高度适中

  // 3. 形态对称性
  const leftSideDuration = peakValleyIndex - startIndex;
  const rightSideDuration = endIndex - peakValleyIndex;
  const symmetryRatio =
    Math.min(leftSideDuration, rightSideDuration) /
    Math.max(leftSideDuration, rightSideDuration);

  if (symmetryRatio > 0.8)
    score += 15; // 高度对称
  else if (symmetryRatio > 0.6)
    score += 10; // 中等对称
  else score += 5; // 较低对称

  // 4. 确认突破
  if (isBreakoutConfirmed) score += 15;

  // 最后确保分数在0-100范围内
  return Math.max(0, Math.min(100, score));
}

/**
 * 分析圆底/圆顶形态的成交量特征
 */
function analyzeRoundingPatternVolume(
  data: Candle[],
  startIndex: number,
  peakValleyIndex: number,
  endIndex: number,
  isRoundingBottom: boolean
): string {
  // 计算左侧成交量
  const leftSideVolumes = data
    .slice(startIndex, peakValleyIndex + 1)
    .map(d => d.volume);
  const avgLeftSideVolume =
    leftSideVolumes.reduce((sum, v) => sum + v, 0) / leftSideVolumes.length;

  // 计算右侧成交量
  const rightSideVolumes = data
    .slice(peakValleyIndex, endIndex + 1)
    .map(d => d.volume);
  const avgRightSideVolume =
    rightSideVolumes.reduce((sum, v) => sum + v, 0) / rightSideVolumes.length;

  // 检查突破时的成交量
  let breakoutVolume = 0;
  if (endIndex + 1 < data.length) {
    breakoutVolume = data[endIndex + 1].volume;
  }

  if (isRoundingBottom) {
    // 圆底理想的成交量模式：左侧成交量递减，底部成交量低，右侧成交量递增
    if (avgRightSideVolume > avgLeftSideVolume * 1.3) {
      if (breakoutVolume > avgRightSideVolume * 1.5) {
        return '理想的成交量模式：右侧成交量明显大于左侧，突破时成交量放大';
      } else {
        return '良好的成交量模式：右侧成交量大于左侧';
      }
    } else if (avgRightSideVolume > avgLeftSideVolume) {
      return '可接受的成交量模式：右侧成交量略大于左侧';
    } else {
      return '非理想的成交量模式：右侧成交量未能明显放大，降低形态可靠性';
    }
  } else {
    // 圆顶理想的成交量模式：左侧成交量递增，顶部成交量高，右侧成交量递减
    if (avgRightSideVolume < avgLeftSideVolume * 0.7) {
      if (breakoutVolume > avgRightSideVolume * 1.3) {
        return '理想的成交量模式：右侧成交量明显小于左侧，突破时成交量放大';
      } else {
        return '良好的成交量模式：右侧成交量小于左侧';
      }
    } else if (avgRightSideVolume < avgLeftSideVolume) {
      return '可接受的成交量模式：右侧成交量略小于左侧';
    } else {
      return '非理想的成交量模式：右侧成交量未能明显萎缩，降低形态可靠性';
    }
  }
}

/**
 * 获取形态状态描述
 */
function getStatusDescription(status: PatternStatus): string {
  switch (status) {
    case PatternStatus.Forming:
      return '正在形成中';
    case PatternStatus.Completed:
      return '已完成但未突破';
    case PatternStatus.Confirmed:
      return '已确认突破';
    case PatternStatus.Failed:
      return '形成后失败';
    default:
      return '未知状态';
  }
}

export {
  detectPeaksAndValleys,
  findHeadAndShoulders,
  findTriangles,
  findWedges,
  findFlagsAndPennants,
  findDoubleTopsAndBottoms,
  findCupAndHandle,
  findRoundingPatterns,
};
