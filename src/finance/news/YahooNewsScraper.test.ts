import {
  scrapeYahooMarketNewsMeta,
  scrapeYahooNewsArticleContent,
  YahooNewsArticleMeta,
} from './YahooNewsScraper.js';

async function testScrapeYahooMarketNewsMetaAndContent() {
  try {
    const articles: YahooNewsArticleMeta[] = await scrapeYahooMarketNewsMeta();
    console.log(`Fetched ${articles.length} articles.`);
    for (let idx = 0; idx < articles.length; idx++) {
      const article = articles[idx];
      console.log(`\nArticle #${idx + 1}`);
      console.log(`Title: ${article.title}`);
      console.log(`URL: ${article.url}`);
      console.log(`Publisher: ${article.publisher}`);
      console.log(`Date: ${article.date}`);
      console.log(`Stock Symbols: ${article.stockSymbols.join(', ')}`);
      // Optionally fetch and print the article content (first 300 chars)
      const content = await scrapeYahooNewsArticleContent(article.url);
      console.log(`Text (first 300 chars): ${content.text.slice(0, 300)}...`);
    }
  } catch (err) {
    console.error('Error scraping Yahoo Finance news:', err);
  }
}

testScrapeYahooMarketNewsMetaAndContent();
