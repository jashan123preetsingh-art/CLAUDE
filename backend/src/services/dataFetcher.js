const axios = require('axios');
const { query } = require('../config/database');
const { broadcast } = require('./websocket');

// NSE API endpoints (unofficial but widely used)
const NSE_BASE = 'https://www.nseindia.com';
const NSE_API = 'https://www.nseindia.com/api';

let nseHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
};

let nseCookies = '';

async function refreshNSESession() {
  try {
    const response = await axios.get(NSE_BASE, {
      headers: nseHeaders,
      maxRedirects: 5,
      timeout: 10000,
    });
    const setCookies = response.headers['set-cookie'];
    if (setCookies) {
      nseCookies = setCookies.map(c => c.split(';')[0]).join('; ');
    }
  } catch (err) {
    console.error('Failed to refresh NSE session:', err.message);
  }
}

async function nseRequest(url) {
  if (!nseCookies) await refreshNSESession();
  try {
    const res = await axios.get(url, {
      headers: { ...nseHeaders, Cookie: nseCookies },
      timeout: 15000,
    });
    return res.data;
  } catch (err) {
    // Retry with fresh session
    await refreshNSESession();
    const res = await axios.get(url, {
      headers: { ...nseHeaders, Cookie: nseCookies },
      timeout: 15000,
    });
    return res.data;
  }
}

// Fetch live market data from NSE
async function fetchNSEMarketData() {
  try {
    const data = await nseRequest(`${NSE_API}/market-data-pre-open?key=NIFTY`);
    return data;
  } catch (err) {
    console.error('Error fetching NSE market data:', err.message);
    return null;
  }
}

// Fetch stock quote from NSE
async function fetchNSEQuote(symbol) {
  try {
    const data = await nseRequest(`${NSE_API}/quote-equity?symbol=${encodeURIComponent(symbol)}`);
    return data;
  } catch (err) {
    console.error(`Error fetching quote for ${symbol}:`, err.message);
    return null;
  }
}

// Fetch all NIFTY stocks
async function fetchNiftyStocks() {
  try {
    const data = await nseRequest(`${NSE_API}/equity-stockIndices?index=NIFTY%2050`);
    return data?.data || [];
  } catch (err) {
    console.error('Error fetching Nifty stocks:', err.message);
    return [];
  }
}

// Yahoo Finance fallback
async function fetchYahooQuote(symbol) {
  try {
    const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
    const yahooFinance = require('yahoo-finance2').default;
    const quote = await yahooFinance.quote(yahooSymbol);
    return {
      symbol,
      ltp: quote.regularMarketPrice,
      open: quote.regularMarketOpen,
      high: quote.regularMarketDayHigh,
      low: quote.regularMarketDayLow,
      close: quote.regularMarketPreviousClose,
      prev_close: quote.regularMarketPreviousClose,
      volume: quote.regularMarketVolume,
      change_pct: quote.regularMarketChangePercent,
      market_cap: quote.marketCap,
      week_52_high: quote.fiftyTwoWeekHigh,
      week_52_low: quote.fiftyTwoWeekLow,
    };
  } catch (err) {
    console.error(`Yahoo Finance error for ${symbol}:`, err.message);
    return null;
  }
}

// Fetch historical data from Yahoo Finance
async function fetchHistoricalData(symbol, period1, period2, interval = '1d') {
  try {
    const yahooSymbol = `${symbol}.NS`;
    const yahooFinance = require('yahoo-finance2').default;
    const result = await yahooFinance.historical(yahooSymbol, {
      period1,
      period2,
      interval,
    });
    return result;
  } catch (err) {
    console.error(`Historical data error for ${symbol}:`, err.message);
    return [];
  }
}

// Fetch FII/DII data from NSE
async function fetchFIIDIIData() {
  try {
    const data = await nseRequest(`${NSE_API}/fiidiiTradeReact`);
    return data;
  } catch (err) {
    console.error('Error fetching FII/DII data:', err.message);
    return null;
  }
}

// Fetch options chain from NSE
async function fetchOptionsChain(symbol) {
  try {
    const data = await nseRequest(`${NSE_API}/option-chain-equities?symbol=${encodeURIComponent(symbol)}`);
    return data;
  } catch (err) {
    console.error(`Options chain error for ${symbol}:`, err.message);
    return null;
  }
}

// Fetch index options chain (NIFTY, BANKNIFTY)
async function fetchIndexOptionsChain(symbol) {
  try {
    const data = await nseRequest(`${NSE_API}/option-chain-indices?symbol=${encodeURIComponent(symbol)}`);
    return data;
  } catch (err) {
    console.error(`Index options chain error for ${symbol}:`, err.message);
    return null;
  }
}

// Batch update stock prices
async function updateStockPrices(stocks) {
  for (const stock of stocks) {
    try {
      let quote = await fetchYahooQuote(stock.symbol);
      if (!quote) continue;

      await query(
        `INSERT INTO price_data (stock_id, ltp, open, high, low, close, prev_close, volume, change_pct, day_high, day_low, week_52_high, week_52_low, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
         ON CONFLICT (stock_id) DO UPDATE SET
           ltp = $2, open = $3, high = $4, low = $5, close = $6, prev_close = $7,
           volume = $8, change_pct = $9, day_high = $10, day_low = $11,
           week_52_high = $12, week_52_low = $13, updated_at = NOW()`,
        [stock.id, quote.ltp, quote.open, quote.high, quote.low,
         quote.close, quote.prev_close, quote.volume, quote.change_pct,
         quote.high, quote.low, quote.week_52_high, quote.week_52_low]
      );

      // Broadcast price update via WebSocket
      broadcast({
        type: 'price_update',
        symbol: stock.symbol,
        data: quote,
      });
    } catch (err) {
      console.error(`Error updating ${stock.symbol}:`, err.message);
    }
  }
}

// Fetch news from Google News RSS for Indian stock market
async function fetchMarketNews() {
  try {
    const res = await axios.get('https://news.google.com/rss/search?q=indian+stock+market+NSE+BSE&hl=en-IN&gl=IN&ceid=IN:en', {
      timeout: 10000,
    });
    const cheerio = require('cheerio');
    const $ = cheerio.load(res.data, { xmlMode: true });
    const articles = [];
    $('item').each((i, el) => {
      if (i >= 20) return false;
      articles.push({
        title: $(el).find('title').text(),
        url: $(el).find('link').text(),
        source: $(el).find('source').text(),
        published_at: new Date($(el).find('pubDate').text()),
        category: 'market',
      });
    });
    return articles;
  } catch (err) {
    console.error('Error fetching news:', err.message);
    return [];
  }
}

module.exports = {
  fetchNSEQuote,
  fetchNiftyStocks,
  fetchYahooQuote,
  fetchHistoricalData,
  fetchFIIDIIData,
  fetchOptionsChain,
  fetchIndexOptionsChain,
  updateStockPrices,
  fetchMarketNews,
  fetchNSEMarketData,
  refreshNSESession,
};
