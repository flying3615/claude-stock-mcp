import { Evaluator } from '../Evaluator';
import { QuoteSummary, Weight } from '../../types';
import { mockSummaryData } from './mockData';

describe('Evaluator', () => {
  let evaluator: Evaluator;
  let weights: Weight;

  beforeEach(() => {
    evaluator = new Evaluator();
    weights = {
      regularMarketPrice: 0.25,
      regularMarketChangePercent: 0.25,
      volumeRatio: 0.25,
      sharesOutstanding: 0.25,
    };
  });

  test('normalize should normalize data correctly', () => {
    const data = [
      {
        symbol: 'A',
        price: 100,
        changePercent: 5,
        volumeRatio: 10,
        sharesOutstanding: 1000,
        score: 0,
      },
      {
        symbol: 'B',
        price: 200,
        changePercent: 10,
        volumeRatio: 20,
        sharesOutstanding: 2000,
        score: 0,
      },
    ];
    const result = evaluator.normalize(data, 'price', true);
    expect(result[0].price).toBe(1);
    expect(result[1].price).toBe(0);
  });

  test('calculateScores should calculate scores correctly', () => {
    const result = evaluator.calculateScores(mockSummaryData, weights);
    expect(result[0].score).toBe(0);
  });

  test('sortStocks should sort stocks by score in descending order', () => {
    const data = [
      { symbol: 'A', score: 50 },
      { symbol: 'B', score: 100 },
    ] as QuoteSummary[];
    const result = evaluator.sortStocks(data);
    expect(result[0].symbol).toBe('B');
    expect(result[1].symbol).toBe('A');
  });

  test('evaluateObjMapper should map quote summaries to evaluator objects', () => {
    const result = evaluator.evaluateObjMapper(mockSummaryData);
    expect(result[0]).toHaveProperty('symbol');
    expect(result[0]).toHaveProperty('price');
    expect(result[0]).toHaveProperty('changePercent');
    expect(result[0]).toHaveProperty('volumeRatio');
    expect(result[0]).toHaveProperty('sharesOutstanding');
  });
});
