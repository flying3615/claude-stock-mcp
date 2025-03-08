import { MarketQuery } from '../finance/MarketQuery.js';
import { fetchConditionForMarket, sourceIds } from '../config.js';
import { checkBullOrBearRecently } from './BullOrBearDetector.js';
import { BreakoutDetector } from './BreakoutDetector.js';
import { executeIntegratedAnalysis } from '../analysis/IntegratedAnalysis.js';
import { isNearLevel } from '../util/util.js';

export class StrategyAnalysisAgent {
  marketQuery = new MarketQuery();

  /**
   * 检查市场中的股票在支撑和阻力位附近是否出现了多空信号
   */
  checkBullBearWithSR = async () => {
    const stockSummaries = await this.marketQuery.fetchWholeMarketData({
      minVolume: 5000000, // 成交量 > 500万
      sourceIds,
    });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 60);

    // 存储分析结果
    const bullOnSupport: {
      symbol: string;
      supportLevel: number;
      signalDate: Date;
      currentPrice: number;
      strength: number;
    }[] = [];
    const bearOnResistance: {
      symbol: string;
      resistanceLevel: number;
      signalDate: Date;
      currentPrice: number;
      strength: number;
    }[] = [];

    // 初始化检测器
    const breakoutDetector = new BreakoutDetector();

    for (const quoteSummary of stockSummaries) {
      try {
        // 1. 获取历史数据
        const prices = await this.marketQuery.getHistoricalData(
          quoteSummary.symbol,
          startDate,
          endDate,
          '1d'
        );

        if (prices.length === 0) continue;

        // 2. 检测多空信号
        const checkResult = checkBullOrBearRecently(prices, 5);

        // 如果没有信号，跳过该股票
        if (
          checkResult.bullishDatesWithinLast5Days.length === 0 &&
          checkResult.bearishDatesWithinLast5Days.length === 0
        ) {
          continue;
        }

        console.log(
          `股票: ${quoteSummary.symbol}，近期看涨信号: ${checkResult.bullishDatesWithinLast5Days.length}，近期看跌信号: ${checkResult.bearishDatesWithinLast5Days.length}`
        );

        // 3. 获取支撑阻力位
        const srResult = await breakoutDetector.run(quoteSummary.symbol);

        // 获取当前价格
        const currentPrice = prices[prices.length - 1].close;

        // 4. 判断最新的信号类型 (看涨或看跌)
        const lastBullishPattern =
          checkResult.bullishPatternsDetails.length > 0
            ? checkResult.bullishPatternsDetails[
                checkResult.bullishPatternsDetails.length - 1
              ]
            : null;

        const lastBearishPattern =
          checkResult.bearishPatternsDetails.length > 0
            ? checkResult.bearishPatternsDetails[
                checkResult.bearishPatternsDetails.length - 1
              ]
            : null;

        // 确定最近的信号类型
        let recentSignalType = '';
        let recentSignalDate: Date | null = null;
        let signalStrength = 0;

        if (!lastBullishPattern && lastBearishPattern) {
          recentSignalType = 'bearish';
          recentSignalDate = lastBearishPattern.date;
          signalStrength = lastBearishPattern.strength;
        } else if (lastBullishPattern && !lastBearishPattern) {
          recentSignalType = 'bullish';
          recentSignalDate = lastBullishPattern.date;
          signalStrength = lastBullishPattern.strength;
        } else if (lastBullishPattern && lastBearishPattern) {
          // 如果两种信号都有，选择最近的
          recentSignalType =
            lastBullishPattern.date > lastBearishPattern.date
              ? 'bullish'
              : 'bearish';
          recentSignalDate =
            recentSignalType === 'bullish'
              ? lastBullishPattern.date
              : lastBearishPattern.date;
          signalStrength =
            recentSignalType === 'bullish'
              ? lastBullishPattern.strength
              : lastBearishPattern.strength;
        } else {
          // 没有信号，跳过
          continue;
        }

        // 5. 检查是否在支撑位附近 (当前价格在支撑位 ±10% 范围内)
        if (recentSignalType === 'bullish' && recentSignalDate) {
          const dynamicSupport = srResult.dynamicSupport;
          if (
            dynamicSupport &&
            isNearLevel(currentPrice, dynamicSupport, 0.1)
          ) {
            bullOnSupport.push({
              symbol: quoteSummary.symbol,
              supportLevel: dynamicSupport,
              signalDate: recentSignalDate,
              currentPrice: currentPrice,
              strength: signalStrength,
            });
          }
        }

        //6. 检查是否在阻力位附近 (当前价格在阻力位 ±10% 范围内)
        if (recentSignalType === 'bearish' && recentSignalDate) {
          const dynamicResistance = srResult.dynamicResistance;
          if (
            dynamicResistance &&
            isNearLevel(currentPrice, dynamicResistance, 0.1)
          ) {
            bearOnResistance.push({
              symbol: quoteSummary.symbol,
              resistanceLevel: dynamicResistance,
              signalDate: recentSignalDate,
              currentPrice: currentPrice,
              strength: signalStrength,
            });
          }
        }
      } catch (error) {
        console.error(`分析 ${quoteSummary.symbol} 时出错:`, error);
      }
    }

    return {
      bullishOnSupport: bullOnSupport,
      bearishOnResistance: bearOnResistance,
    };
  };

  /**
   * 查询市场中强势股票，并获得分析结果
   */
  queryStrongSignalStocks = async () => {
    const gainersWithScore = await this.marketQuery.rankTopGainersAndTrending(
      fetchConditionForMarket
    );

    const strongSignalResult = [];

    for (const quoteSummary of gainersWithScore) {
      const integratedResult = await executeIntegratedAnalysis(
        quoteSummary.symbol
      );
      if (integratedResult.signalStrength === 'strong') {
        strongSignalResult.push(integratedResult);
      }
    }

    return strongSignalResult;
  };
}
