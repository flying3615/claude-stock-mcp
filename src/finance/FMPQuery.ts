import { CompanyFundamentalsArgs, StockQueryResult } from '../types.js';

export class FMPQuery {
  FMP_BASE_URL = 'https://financialmodelingprep.com/stable/';

  async companyFundamentals(args: CompanyFundamentalsArgs) {
    const metrics = args.metrics || ['overview'];
    const results: Record<string, unknown> = {};

    for (const metric of metrics) {
      let endpoint: string;
      switch (metric) {
        case 'overview':
          //  This API provides key financial and operational information for a specific stock symbol,
          //  including the company's market capitalization, stock price, industry, and much more.
          endpoint = `/profile`;
          break;
        case 'income':
          // Track key financial growth metrics with the Income Statement Growth API.
          // Analyze how revenue, profits, and expenses have evolved over time, offering insights into a company’s financial health and operational efficiency.
          endpoint = `/income-statement-growth`;
          break;
        case 'balance':
          // Analyze the growth of key balance sheet items over time with the Balance Sheet Statement Growth API.
          // Track changes in assets, liabilities, and equity to understand the financial evolution of a company.
          endpoint = `/balance-sheet-statement-growth`;
          break;
        case 'cash':
          // Measure the growth rate of a company’s cash flow with the FMP Cashflow Statement Growth API.
          // Determine how quickly a company’s cash flow is increasing or decreasing over time
          endpoint = `/cash-flow-statement-growth`;
          break;
        case 'ratios':
          // This API provides detailed profitability, liquidity, and efficiency ratios,
          // enabling users to assess a company's operational and financial health across various metrics.
          endpoint = `/ratios`;
          break;
        case 'ratings':
          // This API provides a comprehensive snapshot of financial ratings for a specific stock symbol,
          // including the overall rating, discounted cash flow rating, return on equity rating, and more.
          endpoint = `/ratings-snapshot`;
          break;
        default:
          continue;
      }

      const url = new URL(`${this.FMP_BASE_URL}${endpoint}`);
      url.searchParams.append('apikey', process.env.FMP_API_KEY!);
      url.searchParams.append('symbol', args.symbol!);

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`FMP API error for ${metric}: ${response.statusText}`);
      }

      results[metric] = await response.json();
    }

    return results;
  }

  /**
   * Query the 50 biggest stock gainers.
   */
  async queryBiggestGainers(top = 10): Promise<StockQueryResult[]> {
    const url = new URL(`${this.FMP_BASE_URL}/biggest-gainers`);
    url.searchParams.append('apikey', process.env.FMP_API_KEY!);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(
        `FMP API error for biggest-gainers: ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.slice(0, top).map(
      (item: any) =>
        ({
          symbol: item.symbol,
          price: item.price,
          name: item.name,
          change: item.change,
          changesPercentage: item.changesPercentage,
          exchange: item.exchange,
        }) as StockQueryResult
    );
  }

  /**
   * Query the 50 biggest stock losers.
   */
  async queryBiggestLosers(top = 10): Promise<StockQueryResult[]> {
    const url = new URL(`${this.FMP_BASE_URL}/biggest-losers`);
    url.searchParams.append('apikey', process.env.FMP_API_KEY!);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(
        `FMP API error for biggest-losers: ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.slice(0, top).map(
      (item: any) =>
        ({
          symbol: item.symbol,
          price: item.price,
          name: item.name,
          change: item.change,
          changesPercentage: item.changesPercentage,
          exchange: item.exchange,
        }) as StockQueryResult
    );
  }

  /**
   * Query the 50 top traded stocks.
   */
  async queryTopTradedStocks(top = 10): Promise<StockQueryResult[]> {
    const url = new URL(`${this.FMP_BASE_URL}/most-actives`);
    url.searchParams.append('apikey', process.env.FMP_API_KEY!);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`FMP API error for most-actives: ${response.statusText}`);
    }

    const data = await response.json();
    return data.slice(0, top).map(
      (item: any) =>
        ({
          symbol: item.symbol,
          price: item.price,
          name: item.name,
          change: item.change,
          changesPercentage: item.changesPercentage,
          exchange: item.exchange,
        }) as StockQueryResult
    );
  }
}
