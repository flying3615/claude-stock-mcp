import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({
    validation: { logErrors: false },
    suppressNotices: ['yahooSurvey'],
});

export default yahooFinance;
