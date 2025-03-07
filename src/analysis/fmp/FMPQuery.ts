interface CompanyFundamentalsArgs {
  symbol: string;
  metrics?: ('overview' | 'income' | 'balance' | 'cash' | 'ratios' | 'news')[];
}

export class FMPQuery {
  FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

  async companyFundamentals(args: CompanyFundamentalsArgs) {
    const metrics = args.metrics || ['overview'];
    const results: Record<string, unknown> = {};

    for (const metric of metrics) {
      let endpoint: string;
      switch (metric) {
        case 'overview':
          endpoint = `/profile/${args.symbol}`;
          break;
        case 'income':
          endpoint = `/income-statement/${args.symbol}`;
          break;
        case 'balance':
          endpoint = `/balance-sheet-statement/${args.symbol}`;
          break;
        case 'cash':
          endpoint = `/cash-flow-statement/${args.symbol}`;
          break;
        case 'ratios':
          endpoint = `/ratios/${args.symbol}`;
          break;
        default:
          continue;
      }

      const url = new URL(`${this.FMP_BASE_URL}${endpoint}`);
      url.searchParams.append('apikey', process.env.FMP_API_KEY!);

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`FMP API error for ${metric}: ${response.statusText}`);
      }

      results[metric] = await response.json();
    }

    return results;
  }
}
