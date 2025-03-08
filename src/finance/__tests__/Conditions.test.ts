import yahooFinance from 'yahoo-finance2';
import { Conditions } from '../Conditions';
import { ConditionOptions, QuoteSummary } from '../../types';
import { mockSummaryData } from './mockData';

jest.mock('yahoo-finance2');

describe('Conditions', () => {
  let conditions: Conditions;

  beforeEach(() => {
    conditions = new Conditions();
  });

  test('checkDeviationsWithin should return true if deviations are within threshold', () => {
    const movingAverages = [
      { days: 5, averagePrice: 100 },
      { days: 10, averagePrice: 105 },
      { days: 20, averagePrice: 95 },
    ];
    const result = conditions.checkDeviationsWithin(movingAverages, 0.1);
    expect(result).toBe(true);
  });

  test('isCloseToHighest should return true if stock is close to its high', () => {
    const quoteSummary: QuoteSummary = mockSummaryData[0];
    const result = conditions.isCloseToHighest(quoteSummary, 0.4);
    expect(result).toBe(true);
  });

  test('isCloseHigherThan should return true if stock price is higher than target price', () => {
    const quoteSummary: QuoteSummary = mockSummaryData[0];
    const result1 = conditions.isCloseHigherThan(quoteSummary, 50);
    expect(result1).toBe(false);
    const result2 = conditions.isCloseHigherThan(quoteSummary, 30);
    expect(result2).toBe(true);
  });

  test('turnOverRateFilter should return true if turnover rate is within range', () => {
    const quoteSummary: QuoteSummary = mockSummaryData[0];
    const result = conditions.turnOverRateFilter(quoteSummary, 3, 15);
    expect(result).toBe(false);
  });

  test('volumeRatioFilter should return true if volume ratio is within range', () => {
    const quoteSummary: QuoteSummary = mockSummaryData[0];
    const result = conditions.volumeRatioFilter(quoteSummary, 2, 10);
    expect(result).toBe(true);
  });

  test('volumeBiggerThan should return true if volume is bigger than threshold', () => {
    const quoteSummary: QuoteSummary = mockSummaryData[0];
    const result = conditions.volumeBiggerThan(quoteSummary, 1000000);
    expect(result).toBe(true);
  });

  test('sharesOutstandingSmallerThan should return true if shares outstanding is smaller than threshold', () => {
    const quoteSummary: QuoteSummary = mockSummaryData[0];
    const result = conditions.sharesOutstandingSmallerThan(
      quoteSummary,
      1000000000
    );
    expect(result).toBe(true);
  });

  test('isHigherThanLast120DaysHighest should return true if current price is higher than last 120 days highest', async () => {
    const quoteSummary: QuoteSummary = mockSummaryData[0];
    (yahooFinance.chart as jest.Mock).mockResolvedValue({
      quotes: [{ high: 100 }, { high: 110 }, { high: 120 }],
      meta: { regularMarketPrice: 130 },
    });
    const result =
      await conditions.isHigherThanLast120DaysHighest(quoteSummary);
    expect(result).toBe(true);
  });

  test('getMovingAverage should return moving averages for given days', async () => {
    (yahooFinance.chart as jest.Mock).mockResolvedValue({
      quotes: Array(30).fill({ adjclose: 100 }),
    });
    const result = await conditions.getMovingAverage('AAPL', [5, 10, 20]);
    expect(result).toEqual([
      { days: 5, averagePrice: 100 },
      { days: 10, averagePrice: 100 },
      { days: 20, averagePrice: 100 },
    ]);
  });

  test('checkConditions should return quoteSummary if all conditions are met', async () => {
    const quoteSummary: QuoteSummary = mockSummaryData[0];
    jest.spyOn(conditions, 'getMovingAverage').mockResolvedValue([
      { days: 5, averagePrice: 35 },
      { days: 10, averagePrice: 36 },
      { days: 20, averagePrice: 37 },
    ]);
    const options = {
      shouldHigherThanAveragePriceDays: [5, 10, 20],
      priceDeviationWithin: 0.1,
      closeToHighestWithin: 0.4,
      turnOverRateRange: [3, 52],
      volumeRatioRange: [2, 10],
      minVolume: 34063638 - 10,
      higherThanLast120DaysHighest: false, // fix it later
      maxSharesOutstanding: 136796000 + 10,
    } as ConditionOptions;
    const result = await conditions.checkConditions(quoteSummary, options);
    expect(result).toEqual(quoteSummary);
  });

  test('goThroughConditions should return filtered quote summaries', async () => {
    const quoteSummaries: QuoteSummary[] = [
      mockSummaryData[0],
      mockSummaryData[1],
    ];
    jest
      .spyOn(conditions, 'checkConditions')
      .mockImplementationOnce(async () => mockSummaryData[0]);
    const options = {
      shouldHigherThanAveragePriceDays: [5, 10, 20],
      priceDeviationWithin: 0.1,
      closeToHighestWithin: 0.4,
      turnOverRateRange: [3, 15],
      volumeRatioRange: [3, 10],
      minVolume: 1000000,
      higherThanLast120DaysHighest: false,
      maxSharesOutstanding: 1000000000,
    } as ConditionOptions;
    const result = await conditions.goThroughConditions(
      options,
      quoteSummaries
    );
    expect(result).toEqual([mockSummaryData[0]]);
  });

  test('isBullish should return true if the stock is considered bullish', () => {
    const quoteSummary: QuoteSummary = mockSummaryData[0];
    const result = conditions.isBullish(quoteSummary);
    expect(result).toBe(true);
  });
});
