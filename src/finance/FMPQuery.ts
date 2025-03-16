import { StockQueryResult } from '../types.js';

export class FMPQuery {
  FMP_BASE_URL = 'https://financialmodelingprep.com/stable/';

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
