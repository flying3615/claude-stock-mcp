import { CompanyFundamentalsArgs } from '../types.js';
import axios from 'axios';
import { EconomicIndicator } from './MarketQuery.js';

export class AlphaVantageQuery {
  ALPHA_VANTAGE_URL_URL = 'https://www.alphavantage.co/query';

  // 8. 获取经济指标
  async getEconomicIndicators(
    apiKey: string,
    ecIndicators: EconomicIndicator[]
  ): Promise<any | null> {
    try {
      const result = {};
      if (ecIndicators.includes(EconomicIndicator.GDP)) {
        // 获取GDP增长率
        const gdpUrl = `${this.ALPHA_VANTAGE_URL_URL}?function=REAL_GDP&interval=quarterly&apikey=${apiKey}`;
        const gdpResponse = await axios.get(gdpUrl);
        // 处理并过滤GDP数据，只保留最近4个季度
        const gdpData = gdpResponse.data;
        if (gdpData && gdpData.data) {
          gdpData.data = gdpData.data.slice(0, 4);
        }
        result['gdpData'] = gdpData;
      } else if (ecIndicators.includes(EconomicIndicator.Inflation)) {
        // 获取通货膨胀率
        const inflationUrl = `${this.ALPHA_VANTAGE_URL_URL}?function=INFLATION&apikey=${apiKey}`;
        const inflationResponse = await axios.get(inflationUrl);

        // 处理并过滤通货膨胀率数据，只保留最近4个数据点
        const inflationData = inflationResponse.data;
        if (inflationData && inflationData.data) {
          inflationData.data = inflationData.data.slice(0, 4);
        }

        result['inflationData'] = inflationData;
      } else if (ecIndicators.includes(EconomicIndicator.Unemployment)) {
        // 获取失业率
        const unemploymentUrl = `${this.ALPHA_VANTAGE_URL_URL}?function=UNEMPLOYMENT&apikey=${apiKey}`;
        const unemploymentResponse = await axios.get(unemploymentUrl);

        // 处理并过滤失业率数据，只保留最近4个数据点
        const unemploymentData = unemploymentResponse.data;
        if (unemploymentData && unemploymentData.data) {
          unemploymentData.data = unemploymentData.data.slice(0, 4);
        }
        result['unemploymentData'] = unemploymentData;
      } else if (ecIndicators.includes(EconomicIndicator.FedFundsRate)) {
        // 获取联邦基金利率
        const fedFundsRateUrl = `${this.ALPHA_VANTAGE_URL_URL}?function=FEDERAL_FUNDS_RATE&apikey=${apiKey}`;
        const fedFundsRateResponse = await axios.get(fedFundsRateUrl);

        // 处理并过滤联邦基金利率数据，只保留最近6个数据点
        const fedFundsRateData = fedFundsRateResponse.data;
        if (fedFundsRateData && fedFundsRateData.data) {
          fedFundsRateData.data = fedFundsRateData.data.slice(0, 6);
        }

        result['fedFundsRateData'] = fedFundsRateData;
      } else if (ecIndicators.includes(EconomicIndicator.CPI)) {
        // 获取CPI
        const cpiUrl = `${this.ALPHA_VANTAGE_URL_URL}?function=CPI&apikey=${apiKey}`;
        const cpiResponse = await axios.get(cpiUrl);

        // 处理并过滤CPI数据，只保留最近6个数据点
        const cpiData = cpiResponse.data;
        if (cpiData && cpiData.data) {
          cpiData.data = cpiData.data.slice(0, 6);
        }
        result['cpiData'] = cpiData;
      } else if (ecIndicators.includes(EconomicIndicator.RetailSales)) {
        // 获取零售销售数据
        const retailSalesUrl = `${this.ALPHA_VANTAGE_URL_URL}?function=RETAIL_SALES&apikey=${apiKey}`;
        const retailSalesResponse = await axios.get(retailSalesUrl);

        // 处理并过滤零售销售数据，只保留最近6个数据点
        const retailSalesData = retailSalesResponse.data;
        if (retailSalesData && retailSalesData.data) {
          retailSalesData.data = retailSalesData.data.slice(0, 6);
        }
        result['retailSalesData'] = retailSalesData;
      }

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

    const url = new URL(`${this.ALPHA_VANTAGE_URL_URL}`);
    url.searchParams.append('apikey', apiKey);
    url.searchParams.append('symbol', args.symbol!);

    for (const metric of metrics) {
      switch (metric) {
        case 'overview':
          url.searchParams.append('function', 'OVERVIEW');
          break;
        case 'income':
          url.searchParams.append('function', 'INCOME_STATEMENT');
          break;
        case 'balance':
          url.searchParams.append('function', 'BALANCE_SHEET');
          break;
        case 'cash':
          url.searchParams.append('function', 'CASH_FLOW');
          break;
        case 'earnings':
          url.searchParams.append('function', 'EARNINGS');
          break;
        default:
          continue;
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`FMP API error for ${metric}: ${response.statusText}`);
      }

      results[metric] = await response.json();
    }

    return results;
  }
}
