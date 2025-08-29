import { CompanyFundamentalsArgs } from '../types.js';
import axios from 'axios';
import { EconomicIndicator } from './MarketQuery.js';

export class AlphaVantageQuery {
  ALPHA_VANTAGE_URL = 'https://www.alphavantage.co/query';

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async getWithRetry(url: string, attempts = 3, timeoutMs = 10000) {
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await axios.get(url, { timeout: timeoutMs });
        return res.data;
      } catch (err) {
        lastErr = err;
        // exponential backoff: 500ms, 1000ms, 2000ms
        const delay = 500 * Math.pow(2, i);
        await this.sleep(delay);
      }
    }
    throw lastErr;
  }

  // 8. 获取经济指标
  async getEconomicIndicators(
    apiKey: string,
    ecIndicators: EconomicIndicator[]
  ): Promise<any | null> {
    try {
      const result: Record<string, unknown> = {};
      const tasks: Promise<void>[] = [];

      if (ecIndicators.includes(EconomicIndicator.GDP)) {
        const gdpUrl = `${this.ALPHA_VANTAGE_URL}?function=REAL_GDP&interval=quarterly&apikey=${apiKey}`;
        tasks.push(
          (async () => {
            const gdpData = await this.getWithRetry(gdpUrl);
            if (gdpData && (gdpData as any).data) {
              (gdpData as any).data = (gdpData as any).data.slice(0, 4);
            }
            (result as any)['gdpData'] = gdpData;
          })()
        );
      }

      if (ecIndicators.includes(EconomicIndicator.Inflation)) {
        const inflationUrl = `${this.ALPHA_VANTAGE_URL}?function=INFLATION&apikey=${apiKey}`;
        tasks.push(
          (async () => {
            const inflationData = await this.getWithRetry(inflationUrl);
            if (inflationData && (inflationData as any).data) {
              (inflationData as any).data = (inflationData as any).data.slice(0, 4);
            }
            (result as any)['inflationData'] = inflationData;
          })()
        );
      }

      if (ecIndicators.includes(EconomicIndicator.Unemployment)) {
        const unemploymentUrl = `${this.ALPHA_VANTAGE_URL}?function=UNEMPLOYMENT&apikey=${apiKey}`;
        tasks.push(
          (async () => {
            const unemploymentData = await this.getWithRetry(unemploymentUrl);
            if (unemploymentData && (unemploymentData as any).data) {
              (unemploymentData as any).data = (unemploymentData as any).data.slice(0, 4);
            }
            (result as any)['unemploymentData'] = unemploymentData;
          })()
        );
      }

      if (ecIndicators.includes(EconomicIndicator.FedFundsRate)) {
        const fedFundsRateUrl = `${this.ALPHA_VANTAGE_URL}?function=FEDERAL_FUNDS_RATE&apikey=${apiKey}`;
        tasks.push(
          (async () => {
            const fedFundsRateData = await this.getWithRetry(fedFundsRateUrl);
            if (fedFundsRateData && (fedFundsRateData as any).data) {
              (fedFundsRateData as any).data = (fedFundsRateData as any).data.slice(0, 6);
            }
            (result as any)['fedFundsRateData'] = fedFundsRateData;
          })()
        );
      }

      if (ecIndicators.includes(EconomicIndicator.CPI)) {
        const cpiUrl = `${this.ALPHA_VANTAGE_URL}?function=CPI&apikey=${apiKey}`;
        tasks.push(
          (async () => {
            const cpiData = await this.getWithRetry(cpiUrl);
            if (cpiData && (cpiData as any).data) {
              (cpiData as any).data = (cpiData as any).data.slice(0, 6);
            }
            (result as any)['cpiData'] = cpiData;
          })()
        );
      }

      if (ecIndicators.includes(EconomicIndicator.RetailSales)) {
        const retailSalesUrl = `${this.ALPHA_VANTAGE_URL}?function=RETAIL_SALES&apikey=${apiKey}`;
        tasks.push(
          (async () => {
            const retailSalesData = await this.getWithRetry(retailSalesUrl);
            if (retailSalesData && (retailSalesData as any).data) {
              (retailSalesData as any).data = (retailSalesData as any).data.slice(0, 6);
            }
            (result as any)['retailSalesData'] = retailSalesData;
          })()
        );
      }

      await Promise.all(tasks);
      return result;
    } catch (error) {
      console.error(`获取经济指标数据时出错: ${error}`);
      return null;
    }
  }

  // 9. 获取公司基本面
  async companyFundamentals(apiKey: string, args: CompanyFundamentalsArgs) {
    const metrics = args.metrics || ['overview'];
    const results: Record<string, unknown> = {};

    try {
      for (const metric of metrics) {
        let fnParam: string | null = null;
        switch (metric) {
          case 'overview':
            fnParam = 'OVERVIEW';
            break;
          case 'income':
            fnParam = 'INCOME_STATEMENT';
            break;
          case 'balance':
            fnParam = 'BALANCE_SHEET';
            break;
          case 'cash':
            fnParam = 'CASH_FLOW';
            break;
          case 'earnings':
            fnParam = 'EARNINGS';
            break;
          default:
            fnParam = null;
        }

        if (!fnParam) continue;

        const url = `${this.ALPHA_VANTAGE_URL}?function=${fnParam}&symbol=${encodeURIComponent(args.symbol!)}&apikey=${apiKey}`;
        const data = await this.getWithRetry(url, 3, 10000);
        results[metric] = data;
      }

      return results;
    } catch (error) {
      // 正确的错误来源命名（非 FMP）
      throw new Error(
        `Alpha Vantage API error for company fundamentals: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
