import yahooFinance from 'yahoo-finance2';

import _ from 'lodash';
import axios from 'axios';

import { marketQueryConfig, weight } from '../config.js';
import { Conditions } from './Conditions.js';
import { Evaluator } from './Evaluator.js';
import {
  Candle,
  ConditionOptionsWithSrc,
  FearGreedData,
  Interval,
  MarketData,
  QuoteSummary,
} from '../types.js';

yahooFinance.setGlobalConfig({
  validation: { _internalThrowOnAdditionalProperties: false, logErrors: false },
});
yahooFinance.suppressNotices(['yahooSurvey']);

export enum EconomicIndicator {
  GDP = 'GDP',
  Inflation = 'Inflation',
  Unemployment = 'Unemployment',
  FedFundsRate = 'FedFundsRate',
  CPI = 'CPI',
  RetailSales = 'RetailSales',
}

export class MarketQuery {
  topGainers: string[] = [];
  topTrending: string[] = [];

  ALPHA_VANTAGE_URL = 'https://www.alphavantage.co/query';

  private _innerQuotesSummaries: QuoteSummary[] = [];

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
        return [];
      }
    } catch (error) {
      console.error(`获取 ${interval} 数据时出错:`, error);
      return [];
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

  // 1. 获取CNN恐惧贪婪指数
  async getFearGreedIndex(): Promise<FearGreedData | null> {
    try {
      const url =
        'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
      const headers = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      };

      const response = await axios.get(url, { headers });
      const data = response.data;

      return {
        score: data.fear_and_greed.score,
        rating: data.fear_and_greed.rating,
        timestamp: data.fear_and_greed.timestamp,
        historical: data.fear_and_greed_historical,
      };
    } catch (error) {
      console.error(`获取恐惧贪婪指数时出错: ${error}`);
      return null;
    }
  }

  // 3. 获取市场主要指数数据
  async getMarketIndices(): Promise<MarketData[] | null> {
    try {
      const indices = [
        { symbol: '^VIX', name: 'Volatility Index' },
        { symbol: '^GSPC', name: 'S&P 500' },
        { symbol: '^DJI', name: 'Dow Jones' },
        { symbol: '^IXIC', name: 'NASDAQ' },
        { symbol: '^RUT', name: 'Russell 2000' },
      ];

      const indexData: MarketData[] = [];
      for (const index of indices) {
        const quote = await yahooFinance.quote(index.symbol);
        indexData.push({
          symbol: quote.symbol,
          name: index.name,
          price: quote.regularMarketPrice,
          change: quote.regularMarketChange,
          changePercent: `${quote.regularMarketChangePercent.toFixed(2)}%`,
          timestamp: quote.regularMarketTime,
        });
      }

      return indexData;
    } catch (error) {
      console.error(`获取市场指数数据时出错: ${error}`);
      return null;
    }
  }

  // 4. 获取美国国债收益率曲线
  async getTreasuryYields(): Promise<any | null> {
    try {
      const treasuries = [
        { symbol: '^IRX', name: '13-Week' },
        { symbol: '^FVX', name: '5-Year' },
        { symbol: '^TNX', name: '10-Year' },
        { symbol: '^TYX', name: '30-Year' },
      ];

      const result: any = {};
      for (const treasury of treasuries) {
        const quote = await yahooFinance.quote(treasury.symbol);
        result[treasury.name] = {
          yield: quote.regularMarketPrice,
          change: `${quote.regularMarketChange.toFixed(2)}%`,
          timestamp: quote.regularMarketTime,
        };
      }
      return result;
    } catch (error) {
      console.error(`获取国债收益率数据时出错: ${error}`);
      return null;
    }
  }

  // 5. 获取商品市场数据
  async getCommoditiesData(): Promise<any | null> {
    try {
      const commodities = [
        { symbol: 'GC=F', name: 'Gold' },
        { symbol: 'SI=F', name: 'Silver' },
        { symbol: 'CL=F', name: 'Crude Oil' },
        { symbol: 'NG=F', name: 'Natural Gas' },
        { symbol: 'ZC=F', name: 'Corn' },
        { symbol: 'ZW=F', name: 'Wheat' },
        { symbol: 'ZS=F', name: 'Soybeans' },
      ];

      const result: any[] = [];

      for (const commodity of commodities) {
        const quote = await yahooFinance.quote(commodity.symbol);
        result.push({
          symbol: quote.symbol,
          name: commodity.name,
          price: quote.regularMarketPrice,
          change: quote.regularMarketChange,
          changePercent: quote.regularMarketChangePercent,
          timestamp: quote.regularMarketTime,
        });
      }

      return result;
    } catch (error) {
      console.error(`获取商品市场数据时出错: ${error}`);
      return null;
    }
  }

  // 6. 获取加密货币市场数据
  async getCryptoData(): Promise<any | null> {
    try {
      const cryptos = [
        { symbol: 'BTC-USD', name: 'Bitcoin' },
        { symbol: 'ETH-USD', name: 'Ethereum' },
        { symbol: 'SOL-USD', name: 'Solana' },
        { symbol: 'XRP-USD', name: 'Ripple' },
        { symbol: 'ADA-USD', name: 'Cardano' },
        { symbol: 'DOGE-USD', name: 'Dogecoin' },
      ];

      const result: any[] = [];

      for (const crypto of cryptos) {
        const quote = await yahooFinance.quote(crypto.symbol);

        if (quote) {
          result.push({
            symbol: quote.symbol,
            name: crypto.name,
            price: quote.regularMarketPrice,
            change: quote.regularMarketChange,
            changePercent: quote.regularMarketChangePercent,
            timestamp: quote.regularMarketTime,
          });
        }
      }

      return result;
    } catch (error) {
      console.error(`获取加密货币数据时出错: ${error}`);
      return null;
    }
  }

  // 7. 获取外汇汇率数据
  async getForexData(): Promise<any | null> {
    try {
      const pairs = [
        { symbol: 'EURUSD=X', name: 'EUR/USD' },
        { symbol: 'GBPUSD=X', name: 'GBP/USD' },
        { symbol: 'USDJPY=X', name: 'USD/JPY' },
        { symbol: 'USDCNY=X', name: 'USD/CNY' },
        { symbol: 'USDCHF=X', name: 'USD/CHF' },
        { symbol: 'AUDUSD=X', name: 'AUD/USD' },
        { symbol: 'USDRUB=X', name: 'USD/RUB' },
      ];

      const result: any[] = [];

      for (const pair of pairs) {
        const quote = await yahooFinance.quote(pair.symbol);

        if (quote) {
          result.push({
            symbol: quote.symbol,
            name: pair.name,
            price: quote.regularMarketPrice,
            change: quote.regularMarketChange,
            changePercent: quote.regularMarketChangePercent,
            timestamp: quote.regularMarketTime,
          });
        }
      }

      return result;
    } catch (error) {
      console.error(`获取外汇数据时出错: ${error}`);
      return null;
    }
  }
}
