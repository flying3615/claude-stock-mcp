import yahooFinance from 'yahoo-finance2';
import { MarketQuery } from '../MarketQuery.ts';
import { mockRawDetailData, mockSummaryData } from './mockData.ts';

jest.mock('yahoo-finance2');
jest.mock('fs');

describe('MarketQuery', () => {
  let marketQuery: MarketQuery;

  beforeEach(() => {
    marketQuery = new MarketQuery();
    (yahooFinance.quote as jest.Mock).mockResolvedValue({
      fullExchangeName: 'NYSE',
      regularMarketDayRange: { high: 150, low: 100 },
      regularMarketPrice: 120,
    });

    (yahooFinance.quoteSummary as jest.Mock).mockImplementation(
      (symbol: string) => {
        switch (symbol) {
          case 'OKLO':
            return Promise.resolve(mockRawDetailData[0]);
          case 'SMR':
            return Promise.resolve(mockRawDetailData[1]);
          default:
            return Promise.resolve(null);
        }
      }
    );
  });

  test('should fetch trending stocks', async () => {
    const mockTrendingSymbols = {
      quotes: [{ symbol: 'OKLO' }, { symbol: 'SMR' }],
    };
    (yahooFinance.trendingSymbols as jest.Mock).mockResolvedValue(
      mockTrendingSymbols
    );

    const result = await marketQuery.getTrendingStocks();

    expect(result).toHaveLength(2);
    expect(result[0].symbol).toBe('OKLO');
    expect(result[1].symbol).toBe('SMR');
  });

  test('should fetch daily gainers', async () => {
    const mockDailyGainers = {
      quotes: [
        { symbol: 'OKLO', regularMarketChangePercent: 5 },
        { symbol: 'SMR', regularMarketChangePercent: 3 },
      ],
    };
    (yahooFinance.dailyGainers as jest.Mock).mockResolvedValue(
      mockDailyGainers
    );

    const result = await marketQuery.getDailyGainers();

    expect(result).toHaveLength(2);
    expect(result[0].symbol).toBe('OKLO');
    expect(result[1].symbol).toBe('SMR');
  });

  test('should query details for a symbol', async () => {
    const result = await marketQuery.queryDetails('OKLO');
    expect(result).toEqual(
      mockSummaryData.find(quote => quote.symbol === 'OKLO')
    );
  });

  test('should get full exchange name from quote', async () => {
    const mockQuote = { fullExchangeName: 'NASDAQ' };
    (yahooFinance.quote as jest.Mock).mockResolvedValue(mockQuote);

    const result = await marketQuery.getFullExchangeNameFromQuote('OKLO');

    expect(result).toBe('NASDAQ');
  });
});
