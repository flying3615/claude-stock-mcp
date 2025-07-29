import axios from 'axios';
import * as cheerio from 'cheerio';

export interface YahooNewsArticleMeta {
  title: string;
  url: string;
  publisher: string;
  date: string;
  stockSymbols: string[];
}

export interface YahooNewsArticleContent {
  text: string;
}

/**
 * Scrapes today's market news article metadata from Yahoo Finance News.
 * @returns Promise<YahooNewsArticleMeta[]>
 */
export async function scrapeYahooMarketNewsMeta(): Promise<
  YahooNewsArticleMeta[]
> {
  const url = 'https://finance.yahoo.com/news/';
  const res = await axios.get(url);

  const $ = cheerio.load(res.data);
  const articles: YahooNewsArticleMeta[] = [];

  $('li.stream-item.story-item').each((_, el) => {
    const contentDiv = $(el).find('div.content');
    const titleEl = contentDiv.find('a[title]');
    const title = titleEl.attr('title')?.trim() || '';
    const urlPath = titleEl.attr('href');
    const urlFull =
      urlPath && urlPath.startsWith('http')
        ? urlPath
        : `https://finance.yahoo.com${urlPath}`;
    // Extract publisher and date from publishing class
    let publisher = '';
    let date = '';
    const publishingDiv = $(el).find('div.publishing');
    if (publishingDiv.length) {
      // Example: "Yahoo Finance • 14 hours ago"
      const publishingText = publishingDiv.text();
      const parts = publishingText.split('•');
      if (parts.length === 2) {
        publisher = parts[0].trim();
        date = parts[1].trim();
      } else {
        publisher = publishingText.trim();
      }
    }
    // Extract stock symbols from taxonomy-links
    const stockSymbols: string[] = [];
    $(el)
      .find('div.taxonomy-links a.ticker')
      .each((_, tickerEl) => {
        const symbol = $(tickerEl).attr('aria-label')?.trim();
        if (symbol) stockSymbols.push(symbol);
      });
    if (title && urlFull) {
      articles.push({
        title,
        url: urlFull,
        publisher,
        date,
        stockSymbols,
      });
    }
  });
  return articles;
}

/**
 * Given a Yahoo Finance news article URL, extract its full text content.
 * @param url string
 * @returns Promise<YahooNewsArticleContent>
 */
export async function scrapeYahooNewsArticleContent(
  url: string
): Promise<YahooNewsArticleContent> {
  let res;
  try {
    res = await axios.get(url);
  } catch (err) {
    console.error('Error fetching Yahoo Finance article:', err);
    return { text: '' };
  }
  const $ = cheerio.load(res.data);
  // Yahoo Finance article text is in <div class="body">, paragraphs in <p>
  const paragraphs = $('div.body p')
    .map((_, p) => $(p).text())
    .get();
  return { text: paragraphs.join('\n') };
}
