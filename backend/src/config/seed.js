const { pool, query } = require('./database');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// Major Indian stocks to seed
const STOCKS = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', sector: 'Oil & Gas', market_cap: 1900000, is_fno: true },
  { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', sector: 'Information Technology', market_cap: 1500000, is_fno: true },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', sector: 'Financial Services', market_cap: 1200000, is_fno: true },
  { symbol: 'INFY', name: 'Infosys Ltd', sector: 'Information Technology', market_cap: 750000, is_fno: true },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', sector: 'Financial Services', market_cap: 700000, is_fno: true },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd', sector: 'FMCG', market_cap: 600000, is_fno: true },
  { symbol: 'SBIN', name: 'State Bank of India', sector: 'Financial Services', market_cap: 550000, is_fno: true },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', sector: 'Telecom', market_cap: 500000, is_fno: true },
  { symbol: 'ITC', name: 'ITC Ltd', sector: 'FMCG', market_cap: 480000, is_fno: true },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd', sector: 'Financial Services', market_cap: 400000, is_fno: true },
  { symbol: 'LT', name: 'Larsen & Toubro Ltd', sector: 'Capital Goods', market_cap: 380000, is_fno: true },
  { symbol: 'AXISBANK', name: 'Axis Bank Ltd', sector: 'Financial Services', market_cap: 350000, is_fno: true },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd', sector: 'Financial Services', market_cap: 420000, is_fno: true },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd', sector: 'Automobile', market_cap: 350000, is_fno: true },
  { symbol: 'TITAN', name: 'Titan Company Ltd', sector: 'Consumer Durables', market_cap: 320000, is_fno: true },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries', sector: 'Healthcare', market_cap: 300000, is_fno: true },
  { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd', sector: 'Consumer Durables', market_cap: 280000, is_fno: true },
  { symbol: 'HCLTECH', name: 'HCL Technologies Ltd', sector: 'Information Technology', market_cap: 380000, is_fno: true },
  { symbol: 'WIPRO', name: 'Wipro Ltd', sector: 'Information Technology', market_cap: 250000, is_fno: true },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd', sector: 'Cement', market_cap: 240000, is_fno: true },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', sector: 'Automobile', market_cap: 230000, is_fno: true },
  { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd', sector: 'Diversified', market_cap: 350000, is_fno: true },
  { symbol: 'ADANIPORTS', name: 'Adani Ports & SEZ Ltd', sector: 'Infrastructure', market_cap: 250000, is_fno: true },
  { symbol: 'POWERGRID', name: 'Power Grid Corporation', sector: 'Power', market_cap: 200000, is_fno: true },
  { symbol: 'NTPC', name: 'NTPC Ltd', sector: 'Power', market_cap: 220000, is_fno: true },
  { symbol: 'ONGC', name: 'Oil & Natural Gas Corporation', sector: 'Oil & Gas', market_cap: 210000, is_fno: true },
  { symbol: 'JSWSTEEL', name: 'JSW Steel Ltd', sector: 'Metals', market_cap: 200000, is_fno: true },
  { symbol: 'TATASTEEL', name: 'Tata Steel Ltd', sector: 'Metals', market_cap: 180000, is_fno: true },
  { symbol: 'COALINDIA', name: 'Coal India Ltd', sector: 'Mining', market_cap: 170000, is_fno: true },
  { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv Ltd', sector: 'Financial Services', market_cap: 260000, is_fno: true },
  { symbol: 'TECHM', name: 'Tech Mahindra Ltd', sector: 'Information Technology', market_cap: 140000, is_fno: true },
  { symbol: 'HDFCLIFE', name: 'HDFC Life Insurance', sector: 'Financial Services', market_cap: 130000, is_fno: true },
  { symbol: 'DIVISLAB', name: 'Divis Laboratories Ltd', sector: 'Healthcare', market_cap: 120000, is_fno: true },
  { symbol: 'DRREDDY', name: 'Dr. Reddys Laboratories', sector: 'Healthcare', market_cap: 110000, is_fno: true },
  { symbol: 'CIPLA', name: 'Cipla Ltd', sector: 'Healthcare', market_cap: 100000, is_fno: true },
  { symbol: 'NESTLEIND', name: 'Nestle India Ltd', sector: 'FMCG', market_cap: 210000, is_fno: true },
  { symbol: 'BRITANNIA', name: 'Britannia Industries Ltd', sector: 'FMCG', market_cap: 110000, is_fno: true },
  { symbol: 'EICHERMOT', name: 'Eicher Motors Ltd', sector: 'Automobile', market_cap: 100000, is_fno: true },
  { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp Ltd', sector: 'Automobile', market_cap: 90000, is_fno: true },
  { symbol: 'BAJAJ-AUTO', name: 'Bajaj Auto Ltd', sector: 'Automobile', market_cap: 180000, is_fno: true },
  { symbol: 'INDUSINDBK', name: 'IndusInd Bank Ltd', sector: 'Financial Services', market_cap: 80000, is_fno: true },
  { symbol: 'TATACONSUM', name: 'Tata Consumer Products', sector: 'FMCG', market_cap: 90000, is_fno: true },
  { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals Enterprise', sector: 'Healthcare', market_cap: 85000, is_fno: true },
  { symbol: 'GRASIM', name: 'Grasim Industries Ltd', sector: 'Cement', market_cap: 75000, is_fno: true },
  { symbol: 'M&M', name: 'Mahindra & Mahindra Ltd', sector: 'Automobile', market_cap: 300000, is_fno: true },
  { symbol: 'BPCL', name: 'Bharat Petroleum Corp', sector: 'Oil & Gas', market_cap: 65000, is_fno: true },
  { symbol: 'SBILIFE', name: 'SBI Life Insurance', sector: 'Financial Services', market_cap: 130000, is_fno: true },
  { symbol: 'HINDALCO', name: 'Hindalco Industries Ltd', sector: 'Metals', market_cap: 120000, is_fno: true },
  { symbol: 'BANKBARODA', name: 'Bank of Baroda', sector: 'Financial Services', market_cap: 50000, is_fno: true },
  { symbol: 'ZOMATO', name: 'Zomato Ltd', sector: 'Consumer Services', market_cap: 160000, is_fno: true },
];

async function seed() {
  try {
    console.log('Seeding stocks...');
    for (const stock of STOCKS) {
      await query(
        `INSERT INTO stocks (symbol, name, exchange, sector, market_cap, is_fno)
         VALUES ($1, $2, 'NSE', $3, $4, $5)
         ON CONFLICT (symbol, exchange) DO UPDATE SET
           name = $2, sector = $3, market_cap = $4, is_fno = $5`,
        [stock.symbol, stock.name, stock.sector, stock.market_cap, stock.is_fno]
      );
    }
    console.log(`Seeded ${STOCKS.length} stocks successfully!`);
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await pool.end();
  }
}

seed();
