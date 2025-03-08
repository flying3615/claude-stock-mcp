import { ConditionOptionsWithSrc, Weight } from './types.js';

export const sourceIds = [
  // 'aggressive_small_caps',
  'day_gainers',
  'growth_technology_stocks',
  'most_actives',
  'small_cap_gainers',
  // 'undervalued_growth_stocks',
  // 'undervalued_large_caps',
];

export const marketQueryConfig = {
  count: 30,
  region: 'US',
  lang: 'en-US',
};

export const weight: Weight = {
  regularMarketPrice: 0.15,
  regularMarketChangePercent: 0.3,
  volumeRatio: 0.2,
  sharesOutstanding: 0.05,
  breakoutStrength: 0.3,
};

// trade long to break out for ranking and batch analysis
export const fetchConditionForMarket: ConditionOptionsWithSrc = {
  shouldHigherThanAveragePriceDays: [5, 10, 20], // 5, 10, 20 均线
  priceDeviationWithin: 0.15, // 5，10，20 均线价格偏差小于15%
  closeToHighestWithin: 0.5, // 当前价格与最高价差距小于50%
  turnOverRateRange: [2], // 换手率 > 2%
  volumeRatioRange: [2], // 量比 > 2%
  minVolume: 5000000, // 成交量 > 500万
  // higherThanLast120DaysHighest: true, // 当前平均价格高于过去120天最高价
  // maxSharesOutstanding: 10000000000, // 流通股数最大不过10亿
  // bullish: true, // 看多 当前》50均线》200均线 //TODO: add bearish??
  sourceIds: sourceIds, // 从哪些板块获取
  // breakout: true, // 检测突破
};
