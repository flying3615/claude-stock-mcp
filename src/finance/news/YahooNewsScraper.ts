import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';

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
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Wait for news list to load, but with longer timeout and error handling
    await page.waitForSelector('li.stream-item.story-item', { timeout: 60000 });
  } catch (err) {
    console.error('Error loading Yahoo Finance news page:', err);
    await browser.close();
    return [];
  }
  const articles: YahooNewsArticleMeta[] = await page.$$eval(
    'li.stream-item.story-item',
    items => {
      return items
        .map(el => {
          const contentDiv = el.querySelector('div.content');
          const titleEl = contentDiv?.querySelector('a[title]');
          const title = titleEl?.getAttribute('title')?.trim() || '';
          const urlPath = titleEl?.getAttribute('href') || '';
          const urlFull = urlPath.startsWith('http')
            ? urlPath
            : `https://finance.yahoo.com${urlPath}`;
          // Publisher and date
          let publisher = '';
          let date = '';
          const publishingDiv = el.querySelector('div.publishing');
          if (publishingDiv) {
            const publishingText = publishingDiv.textContent || '';
            const parts = publishingText.split('•');
            if (parts.length === 2) {
              publisher = parts[0].trim();
              date = parts[1].trim();
            } else {
              publisher = publishingText.trim();
            }
          }
          // Stock symbols
          const stockSymbols: string[] = [];
          el.querySelectorAll('div.taxonomy-links a.ticker').forEach(
            tickerEl => {
              const symbol = tickerEl.getAttribute('aria-label')?.trim();
              if (symbol) stockSymbols.push(symbol);
            }
          );
          if (title && urlFull) {
            return { title, url: urlFull, publisher, date, stockSymbols };
          }
          return null;
        })
        .filter(Boolean) as any;
    }
  );
  await browser.close();
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
    res = await axios.get(url, {
      headers: {
        'Accept-Encoding': 'identity',
      },
    });
  } catch (err) {
    console.error(err);
    return { text: `Error fetching Yahoo Finance article ${url}` };
  }
  const $ = cheerio.load(res.data);
  // Yahoo Finance article text is in <div class="body">, paragraphs in <p>
  const paragraphs = $('div.body p')
    .map((_, p) => $(p).text())
    .get();
  return { text: paragraphs.join('\n') };
}
