import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { newsAPI } from '../utils/api';
import { timeAgo } from '../utils/format';

const CATEGORIES = ['All', 'Market', 'Stocks', 'Economy', 'IPO', 'Crypto', 'Global'];

export default function News() {
  const [news, setNews] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNews();
  }, [activeCategory]);

  const loadNews = async () => {
    setLoading(true);
    try {
      const params = activeCategory !== 'All' ? { category: activeCategory.toLowerCase() } : {};
      const res = await newsAPI.list(params);
      setNews(res.data || []);
    } catch {
      setNews(demoNews);
    } finally {
      setLoading(false);
    }
  };

  const displayNews = news.length > 0 ? news : demoNews;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Market News</h1>
          <p className="text-dark-400 text-sm mt-1">Latest Indian market news and analysis</p>
        </div>
        <button onClick={loadNews} className="btn-secondary text-xs">Refresh</button>
      </div>

      {/* Categories */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
              activeCategory === cat
                ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                : 'bg-dark-800 text-dark-400 border border-dark-700 hover:border-dark-600'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* News Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayNews.map((article, i) => (
            <motion.a
              key={i}
              href={article.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass-card-hover p-5 group flex flex-col"
            >
              {article.image_url && (
                <div className="w-full h-40 bg-dark-850 rounded-lg mb-4 overflow-hidden">
                  <img src={article.image_url} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
              <div className="flex items-center gap-2 mb-3">
                <span className="badge bg-accent-blue/20 text-accent-blue">{article.category || 'Market'}</span>
                <span className="text-xs text-dark-600">{timeAgo(article.published_at)}</span>
              </div>
              <h3 className="text-sm font-medium text-dark-200 group-hover:text-white transition-colors mb-2 line-clamp-3 flex-1">
                {article.title}
              </h3>
              {article.summary && (
                <p className="text-xs text-dark-500 line-clamp-2 mb-3">{article.summary}</p>
              )}
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-dark-800">
                <span className="text-xs text-dark-500">{article.source}</span>
                <span className="text-xs text-accent-blue group-hover:underline">Read →</span>
              </div>
            </motion.a>
          ))}
        </div>
      )}
    </div>
  );
}

const demoNews = [
  { title: 'Sensex jumps 500 points as banking stocks lead rally; Nifty reclaims 22,500', source: 'Economic Times', category: 'Market', published_at: new Date(), url: '#' },
  { title: 'RBI MPC keeps repo rate unchanged at 6.5%, shifts stance to accommodative', source: 'Moneycontrol', category: 'Economy', published_at: new Date(Date.now() - 3600000), url: '#' },
  { title: 'TCS Q4 results: Net profit rises 12% YoY, beats street estimates', source: 'LiveMint', category: 'Stocks', published_at: new Date(Date.now() - 7200000), url: '#' },
  { title: 'Adani Group FPO: Fresh issue fully subscribed on Day 2 of bidding', source: 'NDTV Profit', category: 'IPO', published_at: new Date(Date.now() - 10800000), url: '#' },
  { title: 'Gold price surges to Rs 72,000 per 10 grams; silver at all-time high', source: 'Business Standard', category: 'Market', published_at: new Date(Date.now() - 14400000), url: '#' },
  { title: 'FIIs pull out Rs 15,000 crore from Indian equities in March amid global uncertainty', source: 'Financial Express', category: 'Market', published_at: new Date(Date.now() - 18000000), url: '#' },
  { title: 'Auto stocks surge as February sales data exceeds expectations across the board', source: 'Autocar India', category: 'Stocks', published_at: new Date(Date.now() - 21600000), url: '#' },
  { title: 'India GDP growth forecast revised upward to 7.2% by World Bank', source: 'Reuters', category: 'Economy', published_at: new Date(Date.now() - 25200000), url: '#' },
  { title: 'SEBI tightens rules for F&O trading; margin requirements to increase from April', source: 'Moneycontrol', category: 'Market', published_at: new Date(Date.now() - 28800000), url: '#' },
];
