/**
 * 蜡烛图数据
 */
export interface Candle {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
}

export type QuoteSummary = {
  symbol: string;
  fullExchangeName: string;
  stockCode: string;
  price: {
    regularMarketPrice: number;
    regularMarketDayHigh: number;
    regularMarketDayLow: number;
    regularMarketOpen: number;
    regularMarketChangePercent: number;
    twoHundredDayAverage: number;
    fiftyDayAverage: number;
  };
  summaryDetail: {
    turnoverRate: number;
    volumeRatio: number;
    volume: number;
    marketCap: number;
    averageVolume: number;
    ROE: number;
    sharesOutstanding: number;
  };
  defaultKeyStatistics: {
    floatShares: number;
    trailingEps: number;
    forwardEps: number;
    forwardPE: number;
  };
  assetProfile: {
    industry: string;
    sector: string;
  };
  score?: number;
  breakSignal?: BreakSignal;
};

export interface BreakSignal {
  time: Date;
  type: 'support_break' | 'resistance_break' | 'bull_wick' | 'bear_wick';
  price: number;
  strength: number; // 0-100 based on volume and other factors
  breakPriceLevel: number;
}

export type Interval =
  | '1m'
  | '2m'
  | '5m'
  | '15m'
  | '30m'
  | '60m'
  | '90m'
  | '1h'
  | '1d'
  | '5d'
  | '1wk'
  | '1mo'
  | '3mo';

export interface SupportResistanceResult {
  symbol: string;
  supportLevels: number[];
  resistanceLevels: number[];
  dynamicSupport: number | null;
  dynamicResistance: number | null;
  breakSignals: BreakSignal[];
}

export type Weight = {
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  volumeRatio: number;
  sharesOutstanding: number;
  breakoutStrength: number;
};

export type ConditionOptions = {
  shouldHigherThanAveragePriceDays?: number[];
  priceDeviationWithin?: number;
  closeToHighestWithin?: number;
  turnOverRateRange?: [min: number, max?: number];
  volumeRatioRange?: [min: number, max?: number];
  minVolume?: number;
  higherThanLast120DaysHighest?: boolean;
  maxSharesOutstanding?: number;
  bullish?: boolean;
  breakout?: boolean;
};

export type ConditionOptionsWithSrc = ConditionOptions & {
  sourceIds: string[];
};

export interface Strategy<T> {
  run(_): T;
}

export interface CompanyFundamentalsArgs {
  symbol: string;
  metrics?: (
    | 'overview'
    | 'income'
    | 'balance'
    | 'cash'
    | 'ratios'
    | 'ratings'
  )[];
}

export interface StockQueryResult {
  symbol: string;
  price: number;
  name: string;
  change: number;
  changesPercentage: number;
  exchange: string;
}
