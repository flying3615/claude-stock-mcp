import yahooFinance from 'yahoo-finance2';
import { QuoteSummary, Weight } from '../types.ts';

yahooFinance.setGlobalConfig({
  validation: { _internalThrowOnAdditionalProperties: false, logErrors: false },
});
yahooFinance.suppressNotices(['yahooSurvey']);

interface EvaluatorObject {
  symbol: string;
  score: number;
  price: number;
  changePercent: number;
  volumeRatio: number;
  sharesOutstanding: number;
  breakoutStrength: number;
}

export class Evaluator {
  normalize = (data: EvaluatorObject[], key: string, invert: boolean) => {
    const values = data.map(d => d[key]);
    const max = Math.max(...values);
    const min = Math.min(...values);

    // should be more than 2 elements, otherwise it either return 1 or 0
    if (max === min) {
      return data.map(d => ({ ...d, [key]: 0 }));
    }

    return data.map(d => {
      const normalizedValue = invert
        ? (max - d[key]) / (max - min)
        : (d[key] - min) / (max - min);
      return { ...d, [key]: normalizedValue };
    });
  };

  calculateScores = (
    summaries: QuoteSummary[],
    weights: Weight
  ): QuoteSummary[] => {
    const data = this.evaluateObjMapper(summaries);

    const normalizedPrice: EvaluatorObject[] = this.normalize(
      data,
      'price',
      true
    );
    const normalizedChangePercent: EvaluatorObject[] = this.normalize(
      data,
      'changePercent',
      false
    );
    const normalizedVolume: EvaluatorObject[] = this.normalize(
      data,
      'volumeRatio',
      false
    );
    const normalizedSharesOutstanding: EvaluatorObject[] = this.normalize(
      data,
      'sharesOutstanding',
      true
    );

    const normalizedBreakoutStrength: EvaluatorObject[] = this.normalize(
      data,
      'breakoutStrength',
      false
    );

    return data.map((d, i) => {
      const score =
        100 *
        parseFloat(
          (
            normalizedPrice[i].price * weights.regularMarketPrice +
            normalizedChangePercent[i].changePercent *
              weights.regularMarketChangePercent +
            normalizedVolume[i].volumeRatio * weights.volumeRatio +
            normalizedSharesOutstanding[i].sharesOutstanding *
              weights.sharesOutstanding +
            normalizedBreakoutStrength[i].breakoutStrength *
              weights.breakoutStrength
          ).toFixed(4)
        );

      const targetSummary = summaries.find(
        summary => summary.symbol === d.symbol
      );
      targetSummary.score = parseFloat(score.toFixed(2));

      return targetSummary;
    });
  };

  sortStocks = (data: QuoteSummary[]) => {
    return data.sort((a, b) => b.score - a.score);
  };

  evaluateObjMapper(quoteSummaries: QuoteSummary[]): EvaluatorObject[] {
    return quoteSummaries.map(d => {
      return {
        symbol: d.symbol,
        score: d.score,
        price: d.price.regularMarketPrice,
        changePercent: d.price.regularMarketChangePercent,
        volumeRatio: d.summaryDetail.volumeRatio,
        sharesOutstanding: d.summaryDetail.sharesOutstanding,
        breakoutStrength: d.breakSignal?.strength ?? 0,
      };
    });
  }
}
