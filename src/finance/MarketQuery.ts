import yahooFinance from 'yahoo-finance2';

import _ from 'lodash';

import { marketQueryConfig, weight } from '../config.js';
import { Conditions } from './Conditions.js';
import { Evaluator } from './Evaluator.js';
import {
  Candle,
  ConditionOptionsWithSrc,
  Interval,
  QuoteSummary,
} from '../types.js';

yahooFinance.setGlobalConfig({
  validation: { _internalThrowOnAdditionalProperties: false, logErrors: false },
});
yahooFinance.suppressNotices(['yahooSurvey']);

export class MarketQuery {
  topGainers: string[] = [];
  topTrending: string[] = [];

  private _innerQuotesSummaries: QuoteSummary[] = [];

  /**
   * Get all quotes summaries
   */
  get innerQuotesSummaries() {
    return this._innerQuotesSummaries;
  }

  /**
   * Get trending stocks
   * @param options
   */
  async getTrendingStocks(options = marketQueryConfig) {
    const symbols = await yahooFinance.trendingSymbols('US', options);
    const quotesSummaries: QuoteSummary[] = [];
    for (const quote of symbols.quotes) {
      // ignore BTC and ETH
      if (quote.symbol === 'BTC-USD' || quote.symbol === 'ETH-USD') {
        continue;
      }

      const quoteSummary = await this.queryDetails(quote.symbol);
      quotesSummaries.push(quoteSummary);
    }

    this.topTrending = symbols.quotes.map(quote => quote.symbol);
    console.log(`Top ${options.count} trending today:`, this.topTrending);
    const trendQuotesSummaries = quotesSummaries.filter(
      quoteSummary => !!quoteSummary
    );
    this._innerQuotesSummaries.push(...trendQuotesSummaries);
    return trendQuotesSummaries;
  }

  /**
   * Query by different scrIds
   * @param scrIds
   * @param defaultConfig
   */
  async queryByScrIds(scrIds: string, defaultConfig = marketQueryConfig) {
    const queryOptions = {
      scrIds: scrIds,
      ...defaultConfig,
    } as any;

    try {
      const result = await yahooFinance.screener(queryOptions, {
        validateResult: false,
      });
      if (result && result.quotes && result.quotes.length > 0) {
        const symbols = result.quotes.map(quote => quote.symbol);
        console.log(`Top ${queryOptions.count} ${scrIds} today:`, symbols);
        return symbols;
      } else {
        console.log(`No ${scrIds} found.`);
      }
    } catch (error) {
      console.error(`Error fetching ${scrIds}:`, error);
    }
  }

  /**
   * Rank the filtered top gainers and trending stocks by sorting them with scores
   */
  async rankTopGainersAndTrending(config: ConditionOptionsWithSrc) {
    const evaluator = new Evaluator();

    await this.getDailyGainers();
    await this.getTrendingStocks();
    await this.scanWholeMarket(config.sourceIds);
    // remove duplicates, by its stock code
    const sortedQuotesSummaries = _.uniqWith(
      this._innerQuotesSummaries,
      (a, b) => a.stockCode === b.stockCode
    );
    const conditions = new Conditions();
    const filteredSummary = await conditions.goThroughConditions(
      config,
      sortedQuotesSummaries
    );
    return evaluator.sortStocks(
      evaluator.calculateScores(filteredSummary, weight)
    );
  }

  /**
   * Rank the whole stocks by sorting them with scores and dump the highlighted stock codes to a file
   * @param config
   */
  async fetchWholeMarketData(
    config: ConditionOptionsWithSrc
  ): Promise<QuoteSummary[]> {
    return await this.rankTopGainersAndTrending(config);
  }

  /**
   * Scan whole market for different types of stock categories
   * @param scrIds
   */
  async scanWholeMarket(scrIds: string[]) {
    const totalSymbols = [];

    for (const scrId of scrIds) {
      try {
        const symbols = await this.queryByScrIds(scrId);
        totalSymbols.push(...symbols);
      } catch (error) {
        console.error(`Error fetching ${scrId}:`, error);
      }
    }

    const noRepeatSymbols = _.uniqWith(totalSymbols, _.isEqual);
    const quotesSummaries: QuoteSummary[] = [];

    for (const symbol of noRepeatSymbols) {
      const quoteSummary = await this.queryDetails(symbol);
      quotesSummaries.push(quoteSummary);
    }
    const summaries = quotesSummaries.filter(quoteSummary => !!quoteSummary);
    this._innerQuotesSummaries.push(...summaries);
    return summaries;
  }

  /**
   * Get daily gainers
   * @param options
   */
  async getDailyGainers(options = marketQueryConfig) {
    let gainers;
    try {
      gainers = await yahooFinance.dailyGainers(options);
    } catch (error) {
      gainers = error.result;
    }

    const quotesSummaries: QuoteSummary[] = [];
    for (const gainer of gainers.quotes) {
      // ignore BTC and ETH
      if (gainer.symbol === 'BTC-USD' || gainer.symbol === 'ETH-USD') {
        continue;
      }

      const quoteSummary = await this.queryDetails(gainer.symbol);
      quotesSummaries.push(quoteSummary);
    }

    this.topGainers = gainers.quotes.map(
      quote => `${quote.symbol} ${quote.regularMarketChangePercent}%`
    );
    console.log(
      `Top ${marketQueryConfig.count} gainers today:`,
      this.topGainers
    );
    const raisedQuotesSummaries = quotesSummaries.filter(
      quoteSummary => !!quoteSummary
    );
    this._innerQuotesSummaries.push(...raisedQuotesSummaries);
    return raisedQuotesSummaries;
  }

  /**
   * Query details for a symbol
   * @param symbol
   */
  async queryDetails(symbol: string): Promise<QuoteSummary> {
    const modules = {
      modules: [
        'price',
        'summaryDetail',
        'defaultKeyStatistics',
        'assetProfile',
        'institutionOwnership',
      ],
    } as any;
    let fullExchangeName = await this.getFullExchangeNameFromQuote(symbol);
    fullExchangeName = fullExchangeName.toLowerCase().includes('nasdaq')
      ? 'NASDAQ'
      : fullExchangeName;

    let result;
    try {
      result = await yahooFinance.quoteSummary(symbol, modules);
    } catch (error) {
      result = error.result;
    }

    if (
      result &&
      result.price &&
      result.summaryDetail &&
      result.defaultKeyStatistics &&
      result.assetProfile &&
      result.institutionOwnership
    ) {
      const volume = result.summaryDetail.volume;
      const marketCap = result.summaryDetail.marketCap;
      const averageVolume = result.summaryDetail.averageVolume;
      const shareOutstanding = result.defaultKeyStatistics.sharesOutstanding;
      const turnoverRate = parseFloat(
        ((volume / shareOutstanding) * 100).toFixed(2)
      );
      const volumeRatio = parseFloat((volume / averageVolume).toFixed(2));
      const epsTrailingTwelveMonths = result.defaultKeyStatistics.trailingEps;
      const epsForward = result.defaultKeyStatistics.forwardEps;
      const regularMarketPrice = result.price.regularMarketPrice;
      const regularMarketChangePercent =
        result.price.regularMarketChangePercent;
      const forwardPE = result.summaryDetail.forwardPE;
      const regularMarketDayHigh = result.price.regularMarketDayHigh;
      const regularMarketDayLow = result.price.regularMarketDayLow;
      const regularMarketOpen = result.price.regularMarketOpen;
      const industry = result.assetProfile.industry;
      const sector = result.assetProfile.sector;
      const ROE = parseFloat(
        (
          epsTrailingTwelveMonths / result.defaultKeyStatistics.bookValue
        ).toFixed(2)
      );
      const sharesOutstanding = result.defaultKeyStatistics.sharesOutstanding;

      const twoHundredDayAverage = result.summaryDetail.twoHundredDayAverage;
      const fiftyDayAverage = result.summaryDetail.fiftyDayAverage;

      return {
        symbol: symbol,
        fullExchangeName: fullExchangeName,
        stockCode: `${fullExchangeName}:${symbol}`,
        price: {
          regularMarketPrice,
          regularMarketDayHigh,
          regularMarketDayLow,
          regularMarketOpen,
          regularMarketChangePercent,
          twoHundredDayAverage,
          fiftyDayAverage,
        },
        summaryDetail: {
          turnoverRate,
          volumeRatio,
          volume,
          marketCap,
          averageVolume,
          ROE,
          sharesOutstanding,
        },
        defaultKeyStatistics: {
          floatShares: shareOutstanding,
          trailingEps: epsTrailingTwelveMonths,
          forwardEps: epsForward,
          forwardPE: forwardPE,
        },
        assetProfile: {
          industry,
          sector,
        },
      };
    } else {
      console.log(`Can't get ${symbol} details`);
      return null;
    }
  }

  /**
   * Get single historical data
   * @param symbol
   * @param startDate
   * @param endDate
   * @param interval
   */
  async getHistoricalData(
    symbol: string,
    startDate: Date,
    endDate: Date,
    interval: Interval
  ): Promise<Candle[]> {
    try {
      const result = await yahooFinance.chart(symbol, {
        period1: startDate,
        period2: endDate,
        interval: interval,
      });

      if (result && result.quotes) {
        return result.quotes
          .filter(quote => quote.volume != 0)
          .map(quote => {
            return {
              symbol: symbol,
              timestamp: quote.date,
              open: quote.open,
              high: quote.high,
              low: quote.low,
              close: quote.close,
              volume: quote.volume,
            } as Candle;
          });
      } else {
        console.log(`未找到 ${interval} 间隔的数据.`);
        return null;
      }
    } catch (error) {
      console.error(`获取 ${interval} 数据时出错:`, error);
      return null;
    }
  }

  /**
   * Get full exchange name from quote
   * @param symbol
   */
  async getFullExchangeNameFromQuote(symbol: string) {
    try {
      const result = await yahooFinance.quote(symbol, {
        fields: ['fullExchangeName'],
      });
      if (result) {
        return result.fullExchangeName; // 返回 fullExchangeName
      } else {
        console.log(`Can't get ${symbol} full exchange name`);
        return ''; // 返回 null 表示未找到
      }
    } catch (e) {
      console.error(
        `Error occurs when getting ${symbol} full exchange name`,
        e.message
      );
      return ''; // 返回 null 表示出错
    }
  }
}
