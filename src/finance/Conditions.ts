import { ConditionOptions, QuoteSummary } from '../types.js';
import yahooFinance from 'yahoo-finance2';
import _ from 'lodash';
import { BreakoutDetector } from '../strategy/BreakoutDetector.js';

export class Conditions {
  /**
   * Check if the stock average price is within the threshold
   * @param movingAverages
   * @param threshold
   */
  checkDeviationsWithin(
    movingAverages: { days: number; averagePrice: number }[],
    threshold = 0.1
  ): boolean {
    const calculateAverage = (values: number[]): number => {
      const sum = values.reduce((acc, value) => acc + value, 0);
      return sum / values.length;
    };

    const calculateDeviation = (value: number, average: number): number => {
      return Math.abs(value - average) / average;
    };

    // Calculate the average price of all moving averages
    const averagePrice = calculateAverage(
      movingAverages.map(ma => ma.averagePrice)
    );
    // Calculate the deviation of each moving average from the average price
    const deviations = movingAverages.map(ma => ({
      days: ma.days,
      deviation: calculateDeviation(ma.averagePrice, averagePrice),
    }));

    return deviations.every(dev => dev.deviation < threshold);
  }

  /**
   * Check if the stock is close to its high less than 40% away
   * @param quoteSummary
   * @param thresholdPercentage
   */
  isCloseToHighest(
    quoteSummary: QuoteSummary,
    thresholdPercentage: number = 0.4
  ): boolean {
    if (
      quoteSummary.price.regularMarketPrice <
      quoteSummary.price.regularMarketOpen
    )
      return false;
    return (
      1 -
        (quoteSummary.price.regularMarketPrice -
          quoteSummary.price.regularMarketOpen) /
          (quoteSummary.price.regularMarketDayHigh -
            quoteSummary.price.regularMarketOpen) <
      thresholdPercentage
    );
  }

  /**
   * Check if the stock price is higher than the target price
   * @param quoteSummary
   * @param targetPrice
   * @param thresholdPercentage
   */
  isCloseHigherThan(
    quoteSummary: QuoteSummary,
    targetPrice: number,
    thresholdPercentage: number = 0.2
  ): boolean {
    return (
      quoteSummary.price.regularMarketPrice > targetPrice ||
      Math.abs(quoteSummary.price.regularMarketPrice - targetPrice) /
        targetPrice <
        thresholdPercentage
    );
  }

  /**
   * check turn over rate bigger than 3%
   * @param quoteSummary
   * @param thresholdLow
   * @param thresholdHigh
   */
  turnOverRateFilter(
    quoteSummary: QuoteSummary,
    thresholdLow: number,
    thresholdHigh?: number
  ): boolean {
    if (thresholdHigh) {
      return (
        quoteSummary.summaryDetail.turnoverRate > thresholdLow &&
        quoteSummary.summaryDetail.turnoverRate < thresholdHigh
      );
    } else {
      return quoteSummary.summaryDetail.turnoverRate > thresholdLow;
    }
  }

  /**
   * check volume ratio between 3 and 10
   * @param quoteSummary
   * @param thresholdLow
   * @param thresholdHigh
   */
  volumeRatioFilter(
    quoteSummary: QuoteSummary,
    thresholdLow: number,
    thresholdHigh?: number
  ): boolean {
    if (thresholdHigh) {
      return (
        quoteSummary.summaryDetail.volumeRatio > thresholdLow &&
        quoteSummary.summaryDetail.volumeRatio < thresholdHigh
      );
    } else {
      return quoteSummary.summaryDetail.volumeRatio > thresholdLow;
    }
  }

  volumeBiggerThan(quoteSummary: QuoteSummary, threshold: number): boolean {
    return quoteSummary.summaryDetail.volume > threshold;
  }

  sharesOutstandingSmallerThan(
    quoteSummary: QuoteSummary,
    threshold: number
  ): boolean {
    return quoteSummary.summaryDetail.sharesOutstanding <= threshold;
  }

  isBullish(quoteSummary: QuoteSummary): boolean {
    return (
      quoteSummary.price.fiftyDayAverage >
        quoteSummary.price.twoHundredDayAverage &&
      quoteSummary.price.regularMarketPrice > quoteSummary.price.fiftyDayAverage
    );
  }

  async isHigherThanLast120DaysHighest(
    quoteSummary: QuoteSummary
  ): Promise<boolean> {
    const queryOptions = {
      period1: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
      interval: '1d',
    } as any;

    const symbol = quoteSummary.symbol;

    const chartResult = (await yahooFinance.chart(symbol, queryOptions)) as any;
    if (!chartResult || !chartResult.quotes) {
      console.error('No data found for symbol:', symbol);
      return false;
    }
    const historicalHighPrices = chartResult.quotes.map(quote => quote.high);

    const currentPrice = chartResult.meta.regularMarketPrice;
    const highestHistoricalPrice = Math.max(...historicalHighPrices);

    return currentPrice >= highestHistoricalPrice;
  }

  async getMovingAverage(symbol: string, movingAverages: number[]) {
    const queryMovingAverage = async (days: number) => {
      const today = new Date();
      const startDate = new Date();
      startDate.setDate(today.getDate() - days - 30); //  为了保险多取30天的数据

      const queryOptions = {
        period1: startDate,
        period2: today,
        interval: '1d' as const,
      };

      try {
        const result = await yahooFinance.chart(symbol, queryOptions);
        if (result && result.quotes && result.quotes.length > 0) {
          const quotes = result.quotes.slice(-days); //  取最近days天的数据
          if (quotes.length < days) {
            console.log(
              `Error: Not enough data for ${days}-day moving average.`
            );
            return null;
          }
          const sum = quotes.reduce((acc, quote) => acc + quote.adjclose, 0);
          return sum / days;
        } else {
          console.log('Error: No data found or quotes is empty.');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        return null;
      }
    };

    return await Promise.all(
      movingAverages.map(async days => {
        return {
          days: days,
          averagePrice: await queryMovingAverage(days),
        };
      })
    );
  }

  async checkConditions(
    quoteSummary: QuoteSummary,
    options: Partial<ConditionOptions>
  ) {
    const breakoutDetected = new BreakoutDetector();

    if (options.bullish && !this.isBullish(quoteSummary)) {
      console.log(`Stock is not bullish for ${quoteSummary.symbol}`);
      return null;
    }

    if (options.shouldHigherThanAveragePriceDays) {
      const movingPriceAverages = await this.getMovingAverage(
        quoteSummary.symbol,
        options.shouldHigherThanAveragePriceDays
      );
      const averagePrice =
        movingPriceAverages.reduce((acc, ma) => acc + ma.averagePrice, 0) /
        movingPriceAverages.length;

      if (!this.isCloseHigherThan(quoteSummary, averagePrice)) {
        console.log(
          `Price ${quoteSummary.price.regularMarketPrice} is not higher than ${options.shouldHigherThanAveragePriceDays.join(',')} average price ${averagePrice.toFixed(2)} for ${quoteSummary.symbol}`
        );
        return null;
      }

      if (
        options.priceDeviationWithin &&
        !this.checkDeviationsWithin(
          movingPriceAverages,
          options.priceDeviationWithin
        )
      ) {
        console.log(
          `Price average deviation is too big for ${quoteSummary.symbol}`
        );
        return null;
      }
    }

    if (
      options.closeToHighestWithin &&
      !this.isCloseToHighest(quoteSummary, options.closeToHighestWithin)
    ) {
      console.log(
        `Price is not close to the highest for ${quoteSummary.symbol}`
      );
      return null;
    }

    if (
      options.turnOverRateRange &&
      !this.turnOverRateFilter(
        quoteSummary,
        options.turnOverRateRange[0],
        options.turnOverRateRange[1]
      )
    ) {
      console.log(
        `Turn over is not in the range for ${quoteSummary.symbol}`,
        quoteSummary.summaryDetail.turnoverRate
      );
      return null;
    }

    if (
      options.volumeRatioRange &&
      !this.volumeRatioFilter(
        quoteSummary,
        options.volumeRatioRange[0],
        options.volumeRatioRange[1]
      )
    ) {
      console.log(
        `Volume ratio is not in the range for ${quoteSummary.symbol}`,
        quoteSummary.summaryDetail.volumeRatio
      );
      return null;
    }

    if (
      options.minVolume &&
      !this.volumeBiggerThan(quoteSummary, options.minVolume)
    ) {
      console.log(`Volume is too low for ${quoteSummary.symbol}`);
      return null;
    }

    if (
      options.higherThanLast120DaysHighest &&
      !(await this.isHigherThanLast120DaysHighest(quoteSummary))
    ) {
      console.log(
        `Price is not higher than the highest in past 120 days for ${quoteSummary.symbol}`
      );
      return null;
    }

    if (
      options.maxSharesOutstanding &&
      !this.sharesOutstandingSmallerThan(
        quoteSummary,
        options.maxSharesOutstanding
      )
    ) {
      console.log(`Shares outstanding is too big for ${quoteSummary.symbol}`);
      return null;
    }

    if (options.breakout) {
      const supportResistanceResult = await breakoutDetected.run(
        quoteSummary.symbol
      );
      if (supportResistanceResult.breakSignals.length === 0) {
        console.log(`No breakout detected for ${quoteSummary.symbol}`);
        return null;
      }

      const latestBreakSignal =
        supportResistanceResult.breakSignals[
          supportResistanceResult.breakSignals.length - 1
        ];

      if (latestBreakSignal.type !== 'resistance_break') {
        console.log(`Not a valid breakout for ${quoteSummary.symbol}`);
        return null;
      }

      // check if the breakout is today??
      // const today = new Date();
      // const lastBreakSignalDate = latestBreakSignal.time;
      // if (today.getDate() !== lastBreakSignalDate.getDate()) {
      //   console.log(`Breakout is not today for ${quoteSummary.symbol}`);
      //   return null;
      // }

      quoteSummary.breakSignal = latestBreakSignal;
    }
    return quoteSummary;
  }

  async goThroughConditions(
    options: ConditionOptions,
    quotesSummaries: QuoteSummary[]
  ) {
    const sortedQuotesSummaries: QuoteSummary[] = _.uniqWith(
      quotesSummaries,
      (a, b) => a.stockCode === b.stockCode
    );
    console.log('Total stocks to check:', sortedQuotesSummaries.length);
    const resolvedSummaries = await Promise.all(
      sortedQuotesSummaries.map(async quoteSummary => {
        return await this.checkConditions(quoteSummary, options);
      })
    );
    return resolvedSummaries.filter(quoteSummary => !!quoteSummary);
  }
}
