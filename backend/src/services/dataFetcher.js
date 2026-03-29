const axios = require('axios');

// ============ CACHE LAYER ============
const cache = {};
const CACHE_TTL = 60 * 1000; // 1 min for prices
const CACHE_TTL_LONG = 5 * 60 * 1000; // 5 min for slower data
const CACHE_TTL_DAY = 24 * 60 * 60 * 1000; // 1 day for stock list

function getCache(key) {
  const e = cache[key];
  if (e && Date.now() - e.ts < e.ttl) return e.data;
  return null;
}
function setCache(key, data, ttl = CACHE_TTL) {
  cache[key] = { data, ts: Date.now(), ttl };
}

// ============ ALL NSE/BSE STOCKS ============
// We fetch from multiple free sources:
// 1. NSE website (official, full list)
// 2. Yahoo Finance for prices
// 3. Google News RSS for news

// Complete NIFTY 500 + popular BSE stocks — this covers ALL major traded stocks
// We'll also dynamically fetch from NSE API for the full list
const SECTOR_MAP = {
  'RELIANCE': 'Oil & Gas', 'TCS': 'Information Technology', 'HDFCBANK': 'Financial Services',
  'INFY': 'Information Technology', 'ICICIBANK': 'Financial Services', 'HINDUNILVR': 'FMCG',
  'SBIN': 'Financial Services', 'BHARTIARTL': 'Telecom', 'ITC': 'FMCG',
  'KOTAKBANK': 'Financial Services', 'LT': 'Capital Goods', 'AXISBANK': 'Financial Services',
  'BAJFINANCE': 'Financial Services', 'MARUTI': 'Automobile', 'TITAN': 'Consumer Durables',
  'SUNPHARMA': 'Healthcare', 'ASIANPAINT': 'Consumer Durables', 'HCLTECH': 'Information Technology',
  'WIPRO': 'Information Technology', 'ULTRACEMCO': 'Cement', 'TATAMOTORS': 'Automobile',
  'ADANIENT': 'Diversified', 'ADANIPORTS': 'Infrastructure', 'POWERGRID': 'Power',
  'NTPC': 'Power', 'ONGC': 'Oil & Gas', 'JSWSTEEL': 'Metals', 'TATASTEEL': 'Metals',
  'COALINDIA': 'Mining', 'BAJAJFINSV': 'Financial Services', 'TECHM': 'Information Technology',
  'HDFCLIFE': 'Financial Services', 'DIVISLAB': 'Healthcare', 'DRREDDY': 'Healthcare',
  'CIPLA': 'Healthcare', 'NESTLEIND': 'FMCG', 'BRITANNIA': 'FMCG', 'EICHERMOT': 'Automobile',
  'HEROMOTOCO': 'Automobile', 'BAJAJ-AUTO': 'Automobile', 'INDUSINDBK': 'Financial Services',
  'TATACONSUM': 'FMCG', 'APOLLOHOSP': 'Healthcare', 'GRASIM': 'Cement', 'M&M': 'Automobile',
  'BPCL': 'Oil & Gas', 'SBILIFE': 'Financial Services', 'HINDALCO': 'Metals',
  'BANKBARODA': 'Financial Services', 'ZOMATO': 'Consumer Services',
  'ADANIGREEN': 'Power', 'ADANIPOWER': 'Power', 'PIDILITIND': 'Chemicals',
  'SIEMENS': 'Capital Goods', 'HAVELLS': 'Consumer Durables', 'DABUR': 'FMCG',
  'GODREJCP': 'FMCG', 'DLF': 'Real Estate', 'BOSCHLTD': 'Automobile',
  'ABB': 'Capital Goods', 'AMBUJACEM': 'Cement', 'SHREECEM': 'Cement',
  'TRENT': 'Retail', 'VEDL': 'Metals', 'JINDALSTEL': 'Metals',
  'TATAPOWER': 'Power', 'IRCTC': 'Consumer Services', 'POLYCAB': 'Capital Goods',
  'IOC': 'Oil & Gas', 'GAIL': 'Oil & Gas', 'BERGEPAINT': 'Consumer Durables',
  'COLPAL': 'FMCG', 'MARICO': 'FMCG', 'MCDOWELL-N': 'FMCG',
  'VOLTAS': 'Consumer Durables', 'LUPIN': 'Healthcare', 'TORNTPHARM': 'Healthcare',
  'AUBANK': 'Financial Services', 'CHOLAFIN': 'Financial Services', 'MUTHOOTFIN': 'Financial Services',
  'PEL': 'Financial Services', 'BANDHANBNK': 'Financial Services', 'FEDERALBNK': 'Financial Services',
  'IDFCFIRSTB': 'Financial Services', 'CANBK': 'Financial Services', 'PNB': 'Financial Services',
  'UNIONBANK': 'Financial Services', 'INDIANB': 'Financial Services',
  'PERSISTENT': 'Information Technology', 'LTIM': 'Information Technology',
  'MPHASIS': 'Information Technology', 'COFORGE': 'Information Technology',
  'NAUKRI': 'Information Technology', 'LTTS': 'Information Technology',
  'TATAELXSI': 'Information Technology', 'OFSS': 'Information Technology',
  'AUROPHARMA': 'Healthcare', 'BIOCON': 'Healthcare', 'ALKEM': 'Healthcare',
  'IPCALAB': 'Healthcare', 'LALPATHLAB': 'Healthcare', 'MAXHEALTH': 'Healthcare',
  'METROPOLIS': 'Healthcare', 'NATCOPHARMA': 'Healthcare', 'SYNGENE': 'Healthcare',
  'PIIND': 'Chemicals', 'SRF': 'Chemicals', 'ATUL': 'Chemicals',
  'DEEPAKNTR': 'Chemicals', 'CLEAN': 'Chemicals', 'FLUOROCHEM': 'Chemicals',
  'NHPC': 'Power', 'RECLTD': 'Financial Services', 'PFC': 'Financial Services',
  'IREDA': 'Financial Services', 'SJVN': 'Power', 'SAIL': 'Metals', 'NMDC': 'Mining',
  'NATIONALUM': 'Metals', 'HINDCOPPER': 'Metals', 'MOIL': 'Mining',
  'CONCOR': 'Logistics', 'DELHIVERY': 'Logistics', 'BLUEDART': 'Logistics',
  'HAL': 'Defence', 'BEL': 'Defence', 'BHEL': 'Capital Goods',
  'CUMMINSIND': 'Capital Goods', 'THERMAX': 'Capital Goods', 'KPITTECH': 'Information Technology',
  'INDHOTEL': 'Consumer Services', 'JUBLFOOD': 'Consumer Services',
  'PAGEIND': 'Textile', 'RAYMOND': 'Textile', 'PVRINOX': 'Consumer Services',
  'OBEROIRLTY': 'Real Estate', 'GODREJPROP': 'Real Estate', 'PRESTIGE': 'Real Estate',
  'PHOENIXLTD': 'Real Estate', 'BRIGADE': 'Real Estate',
  'SOLARINDS': 'Capital Goods', 'DIXON': 'Consumer Durables', 'WHIRLPOOL': 'Consumer Durables',
  'CROMPTON': 'Consumer Durables', 'BLUESTARLT': 'Consumer Durables',
  'DMART': 'Retail', 'MANYAVAR': 'Retail',
  'PETRONET': 'Oil & Gas', 'HINDPETRO': 'Oil & Gas', 'MRPL': 'Oil & Gas',
  'INDIGO': 'Aviation', 'PAYTM': 'Information Technology',
  'NYKAA': 'Consumer Services', 'POLICYBZR': 'Financial Services',
  'IDEA': 'Telecom', 'JIOFIN': 'Financial Services',
  'ATGL': 'Oil & Gas', 'MGL': 'Oil & Gas', 'IGL': 'Oil & Gas',
  'TORNTPOWER': 'Power', 'CESC': 'Power', 'JSWENERGY': 'Power',
  'ACC': 'Cement', 'RAMCOCEM': 'Cement', 'JKCEMENT': 'Cement',
  'TVSMOTOR': 'Automobile', 'ASHOKLEY': 'Automobile', 'BALKRISIND': 'Automobile',
  'MRF': 'Automobile', 'EXIDEIND': 'Automobile', 'MOTHERSON': 'Automobile',
  'SONACOMS': 'Automobile', 'BHARATFORG': 'Automobile', 'TIINDIA': 'Capital Goods',
};

// NIFTY 500 symbols — the most comprehensive free list of major Indian stocks
const NIFTY500_SYMBOLS = Object.keys(SECTOR_MAP);

// We also dynamically fetch the FULL list from NSE
let allStocksList = null;
let allStocksLastFetch = 0;

// NSE session management
let nseCookies = '';
const nseHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.nseindia.com/',
};

async function refreshNSESession() {
  try {
    const r = await axios.get('https://www.nseindia.com', { headers: nseHeaders, timeout: 10000, maxRedirects: 5 });
    const cookies = r.headers['set-cookie'];
    if (cookies) nseCookies = cookies.map(c => c.split(';')[0]).join('; ');
  } catch (e) {
    console.error('NSE session error:', e.message);
  }
}

async function nseRequest(url) {
  if (!nseCookies) await refreshNSESession();
  try {
    const r = await axios.get(url, { headers: { ...nseHeaders, Cookie: nseCookies }, timeout: 15000 });
    return r.data;
  } catch {
    await refreshNSESession();
    const r = await axios.get(url, { headers: { ...nseHeaders, Cookie: nseCookies }, timeout: 15000 });
    return r.data;
  }
}

// Fetch ALL stocks from NSE (equity list)
async function fetchAllNSEStocks() {
  const cacheKey = 'all_nse_stocks';
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    // Try NSE equity market status which has all indices
    const nifty50 = await nseRequest('https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050');
    const niftyNext50 = await nseRequest('https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20NEXT%2050');
    const nifty100 = await nseRequest('https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20MIDCAP%20100');
    const niftySmall = await nseRequest('https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20SMALLCAP%20100');

    const allStocks = new Map();

    [nifty50, niftyNext50, nifty100, niftySmall].forEach(indexData => {
      if (indexData?.data) {
        indexData.data.forEach(s => {
          if (s.symbol && s.symbol !== 'NIFTY 50' && !s.symbol.includes('NIFTY')) {
            allStocks.set(s.symbol, {
              symbol: s.symbol,
              name: s.meta?.companyName || s.identifier || s.symbol,
              sector: SECTOR_MAP[s.symbol] || s.meta?.industry || 'Others',
              exchange: 'NSE',
              ltp: s.lastPrice,
              open: s.open,
              high: s.dayHigh,
              low: s.dayLow,
              prev_close: s.previousClose,
              change_pct: parseFloat(s.pChange || 0),
              volume: s.totalTradedVolume,
              week_52_high: s.yearHigh,
              week_52_low: s.yearLow,
              market_cap: null,
            });
          }
        });
      }
    });

    const result = Array.from(allStocks.values());
    if (result.length > 0) {
      setCache(cacheKey, result, CACHE_TTL);
      allStocksList = result;
      allStocksLastFetch = Date.now();
      console.log(`Fetched ${result.length} stocks from NSE live`);
      return result;
    }
  } catch (err) {
    console.error('NSE stock list fetch error:', err.message);
  }

  // Fallback: return our built-in list with symbols only
  return NIFTY500_SYMBOLS.map(sym => ({
    symbol: sym, name: sym, sector: SECTOR_MAP[sym] || 'Others', exchange: 'NSE',
  }));
}

// ============ YAHOO FINANCE API ============
let yahooFinance = null;
async function getYahoo() {
  if (!yahooFinance) {
    const yf = require('yahoo-finance2');
    yahooFinance = yf.default || yf;
    try { yahooFinance.setGlobalConfig({ validation: { logErrors: false } }); } catch {}
  }
  return yahooFinance;
}

// Fetch single stock quote
async function fetchYahooQuote(symbol) {
  const cacheKey = `quote_${symbol}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const yf = await getYahoo();
    const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
    const q = await yf.quote(yahooSymbol);
    if (!q || !q.regularMarketPrice) return null;

    const result = {
      symbol: symbol.replace('.NS', '').replace('.BO', ''),
      name: q.longName || q.shortName || symbol,
      exchange: q.exchange === 'BSE' ? 'BSE' : 'NSE',
      sector: SECTOR_MAP[symbol] || 'Others',
      ltp: q.regularMarketPrice,
      open: q.regularMarketOpen,
      high: q.regularMarketDayHigh,
      low: q.regularMarketDayLow,
      close: q.regularMarketPreviousClose,
      prev_close: q.regularMarketPreviousClose,
      volume: q.regularMarketVolume,
      change: q.regularMarketChange,
      change_pct: parseFloat((q.regularMarketChangePercent || 0).toFixed(2)),
      market_cap: q.marketCap,
      week_52_high: q.fiftyTwoWeekHigh,
      week_52_low: q.fiftyTwoWeekLow,
      avg_volume_10d: q.averageDailyVolume10Day,
      pe_ratio: q.trailingPE,
      pb_ratio: q.priceToBook,
      eps: q.trailingEps,
      dividend_yield: q.dividendYield ? (q.dividendYield * 100) : null,
      book_value: q.bookValue,
    };
    setCache(cacheKey, result, CACHE_TTL);
    return result;
  } catch (err) {
    console.error(`Yahoo quote error [${symbol}]:`, err.message);
    return null;
  }
}

// Fetch multiple quotes at once — batched for performance
async function fetchMultipleQuotes(symbols) {
  if (!symbols.length) return [];
  const cacheKey = `multi_${symbols.slice().sort().join(',')}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const yf = await getYahoo();
    const results = [];

    // Batch in groups of 15 for rate limiting
    for (let i = 0; i < symbols.length; i += 15) {
      const batch = symbols.slice(i, i + 15);
      const batchResults = await Promise.allSettled(
        batch.map(sym => yf.quote(sym.includes('.') ? sym : `${sym}.NS`))
      );
      batchResults.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value && r.value.regularMarketPrice) {
          const q = r.value;
          const sym = batch[idx];
          results.push({
            symbol: sym,
            name: q.longName || q.shortName || sym,
            exchange: 'NSE',
            sector: SECTOR_MAP[sym] || 'Others',
            ltp: q.regularMarketPrice,
            open: q.regularMarketOpen,
            high: q.regularMarketDayHigh,
            low: q.regularMarketDayLow,
            close: q.regularMarketPreviousClose,
            prev_close: q.regularMarketPreviousClose,
            volume: q.regularMarketVolume,
            change_pct: parseFloat((q.regularMarketChangePercent || 0).toFixed(2)),
            market_cap: q.marketCap,
            week_52_high: q.fiftyTwoWeekHigh,
            week_52_low: q.fiftyTwoWeekLow,
            avg_volume_10d: q.averageDailyVolume10Day,
            pe_ratio: q.trailingPE,
            pb_ratio: q.priceToBook,
            eps: q.trailingEps,
            dividend_yield: q.dividendYield ? (q.dividendYield * 100) : null,
          });
        }
      });

      // Small delay between batches to not get rate-limited
      if (i + 15 < symbols.length) await new Promise(r => setTimeout(r, 200));
    }

    setCache(cacheKey, results, CACHE_TTL);
    return results;
  } catch (err) {
    console.error('Multi-quote error:', err.message);
    return [];
  }
}

// Fetch fundamentals for a stock
async function fetchFundamentals(symbol) {
  const cacheKey = `fund_${symbol}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const yf = await getYahoo();
    const data = await yf.quoteSummary(`${symbol}.NS`, {
      modules: ['financialData', 'defaultKeyStatistics', 'majorHoldersBreakdown', 'earnings']
    });

    const fd = data?.financialData || {};
    const ks = data?.defaultKeyStatistics || {};
    const h = data?.majorHoldersBreakdown || {};

    const result = {
      symbol,
      pe_ratio: ks.trailingPE,
      pb_ratio: ks.priceToBook,
      roe: fd.returnOnEquity ? parseFloat((fd.returnOnEquity * 100).toFixed(2)) : null,
      roce: null,
      eps: ks.trailingEps,
      dividend_yield: ks.dividendYield ? parseFloat((ks.dividendYield * 100).toFixed(2)) : null,
      debt_to_equity: fd.debtToEquity ? parseFloat((fd.debtToEquity / 100).toFixed(2)) : null,
      current_ratio: fd.currentRatio,
      book_value: ks.bookValue,
      revenue: fd.totalRevenue,
      net_profit: fd.netIncomeToCommon,
      operating_margin: fd.operatingMargins ? parseFloat((fd.operatingMargins * 100).toFixed(2)) : null,
      net_margin: fd.profitMargins ? parseFloat((fd.profitMargins * 100).toFixed(2)) : null,
      revenue_growth_yoy: fd.revenueGrowth ? parseFloat((fd.revenueGrowth * 100).toFixed(2)) : null,
      profit_growth_yoy: fd.earningsGrowth ? parseFloat((fd.earningsGrowth * 100).toFixed(2)) : null,
      promoter_holding: h.insidersPercentHeld ? parseFloat((h.insidersPercentHeld * 100).toFixed(2)) : null,
      fii_holding: h.institutionsPercentHeld ? parseFloat((h.institutionsPercentHeld * 100).toFixed(2)) : null,
      public_holding: h.heldPercentPublic ? parseFloat((h.heldPercentPublic * 100).toFixed(2)) : null,
      target_price: fd.targetMeanPrice,
      recommendation: fd.recommendationKey,
    };
    setCache(cacheKey, result, CACHE_TTL_LONG);
    return result;
  } catch (err) {
    console.error(`Fundamentals error [${symbol}]:`, err.message);
    return null;
  }
}

// Fetch historical chart data
async function fetchHistoricalData(symbol, period1, period2, interval = '1d') {
  const cacheKey = `hist_${symbol}_${interval}_${period1}_${period2}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const yf = await getYahoo();
    const result = await yf.historical(`${symbol}.NS`, { period1, period2, interval });
    const candles = (result || []).map(d => ({
      time: d.date.toISOString().split('T')[0],
      open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume,
    }));
    setCache(cacheKey, candles, CACHE_TTL_LONG);
    return candles;
  } catch (err) {
    console.error(`Historical error [${symbol}]:`, err.message);
    return [];
  }
}

// Fetch intraday chart data (1h, 4h)
async function fetchIntradayData(symbol, interval = '60m', range = '5d') {
  const cacheKey = `intra_${symbol}_${interval}_${range}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const yf = await getYahoo();
    // yahoo-finance2 chart method for intraday
    const result = await yf.chart(`${symbol}.NS`, { interval, range });
    if (!result || !result.quotes) return [];

    const candles = result.quotes
      .filter(q => q.open !== null)
      .map(q => ({
        time: Math.floor(new Date(q.date).getTime() / 1000),
        open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume,
      }));
    setCache(cacheKey, candles, CACHE_TTL);
    return candles;
  } catch (err) {
    console.error(`Intraday error [${symbol}]:`, err.message);
    return [];
  }
}

// Get all sector data with live prices (for heatmap)
async function fetchSectorData() {
  const cacheKey = 'sector_data';
  const cached = getCache(cacheKey);
  if (cached) return cached;

  // First try to get live data from NSE
  let stocks = [];
  try {
    stocks = await fetchAllNSEStocks();
  } catch {
    stocks = [];
  }

  // If NSE data has prices, use it directly; otherwise fetch from Yahoo
  if (stocks.length > 0 && stocks[0].ltp) {
    const sectors = {};
    stocks.forEach(s => {
      const sec = s.sector || 'Others';
      if (!sectors[sec]) sectors[sec] = { sector: sec, stocks: [], totalMcap: 0, avgChange: 0 };
      sectors[sec].stocks.push(s);
    });

    Object.values(sectors).forEach(sec => {
      const changes = sec.stocks.map(s => s.change_pct || 0);
      sec.avgChange = parseFloat((changes.reduce((a, b) => a + b, 0) / changes.length).toFixed(2));
      sec.count = sec.stocks.length;
    });

    const result = Object.values(sectors).sort((a, b) => b.count - a.count);
    setCache(cacheKey, result, CACHE_TTL);
    return result;
  }

  // Fallback: fetch top stocks from yahoo
  const topSymbols = NIFTY500_SYMBOLS.slice(0, 50);
  const quotes = await fetchMultipleQuotes(topSymbols);
  const sectors = {};
  quotes.forEach(q => {
    const sec = q.sector || 'Others';
    if (!sectors[sec]) sectors[sec] = { sector: sec, stocks: [], totalMcap: 0, avgChange: 0 };
    sectors[sec].stocks.push(q);
    sectors[sec].totalMcap += (q.market_cap || 0);
  });
  Object.values(sectors).forEach(sec => {
    const changes = sec.stocks.map(s => s.change_pct || 0);
    sec.avgChange = parseFloat((changes.reduce((a, b) => a + b, 0) / changes.length).toFixed(2));
    sec.count = sec.stocks.length;
  });

  const result = Object.values(sectors).sort((a, b) => b.totalMcap - a.totalMcap);
  setCache(cacheKey, result, CACHE_TTL);
  return result;
}

// Fetch market news from Google News RSS
async function fetchMarketNews() {
  const cacheKey = 'news';
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const res = await axios.get(
      'https://news.google.com/rss/search?q=indian+stock+market+NSE+BSE+sensex+nifty&hl=en-IN&gl=IN&ceid=IN:en',
      { timeout: 10000 }
    );
    const cheerio = require('cheerio');
    const $ = cheerio.load(res.data, { xmlMode: true });
    const articles = [];
    $('item').each((i, el) => {
      if (i >= 30) return false;
      articles.push({
        title: $(el).find('title').text(),
        url: $(el).find('link').text() || $(el).find('link').next().text(),
        source: $(el).find('source').text() || 'Google News',
        published_at: new Date($(el).find('pubDate').text()).toISOString(),
        category: 'market',
      });
    });
    setCache(cacheKey, articles, CACHE_TTL_LONG);
    return articles;
  } catch (err) {
    console.error('News fetch error:', err.message);
    return [];
  }
}

// Fetch Options Chain from NSE
async function fetchOptionsChain(symbol) {
  const cacheKey = `oc_${symbol}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const isIndex = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'NIFTYIT'].includes(symbol.toUpperCase());
    const endpoint = isIndex
      ? `https://www.nseindia.com/api/option-chain-indices?symbol=${encodeURIComponent(symbol)}`
      : `https://www.nseindia.com/api/option-chain-equities?symbol=${encodeURIComponent(symbol)}`;
    const data = await nseRequest(endpoint);
    if (data) setCache(cacheKey, data, CACHE_TTL);
    return data;
  } catch (err) {
    console.error(`Options chain error [${symbol}]:`, err.message);
    return null;
  }
}

// Fetch FII/DII data from NSE
async function fetchFIIDIIData() {
  const cacheKey = 'fiidii';
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const data = await nseRequest('https://www.nseindia.com/api/fiidiiTradeReact');
    if (data) setCache(cacheKey, data, CACHE_TTL_LONG);
    return data;
  } catch (err) {
    console.error('FII/DII error:', err.message);
    return null;
  }
}

// Fetch index quote (NIFTY, BANKNIFTY, etc.)
async function fetchIndexQuote(indexSymbol) {
  const cacheKey = `idx_${indexSymbol}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const yf = await getYahoo();
    const symbolMap = {
      'NIFTY': '^NSEI', 'NIFTY50': '^NSEI', 'BANKNIFTY': '^NSEBANK',
      'SENSEX': '^BSESN', 'NIFTYIT': '^CNXIT', 'NIFTYMIDCAP': 'NIFTY_MIDCAP_100.NS',
    };
    const sym = symbolMap[indexSymbol.toUpperCase()] || indexSymbol;
    const q = await yf.quote(sym);
    if (!q) return null;

    const result = {
      symbol: indexSymbol.toUpperCase(),
      name: q.longName || q.shortName || indexSymbol,
      ltp: q.regularMarketPrice,
      change: q.regularMarketChange,
      change_pct: parseFloat((q.regularMarketChangePercent || 0).toFixed(2)),
      open: q.regularMarketOpen,
      high: q.regularMarketDayHigh,
      low: q.regularMarketDayLow,
      prev_close: q.regularMarketPreviousClose,
      volume: q.regularMarketVolume,
    };
    setCache(cacheKey, result, CACHE_TTL);
    return result;
  } catch (err) {
    console.error(`Index quote error [${indexSymbol}]:`, err.message);
    return null;
  }
}

module.exports = {
  NIFTY500_SYMBOLS,
  SECTOR_MAP,
  fetchAllNSEStocks,
  fetchYahooQuote,
  fetchMultipleQuotes,
  fetchFundamentals,
  fetchHistoricalData,
  fetchIntradayData,
  fetchSectorData,
  fetchMarketNews,
  fetchOptionsChain,
  fetchFIIDIIData,
  fetchIndexQuote,
};
