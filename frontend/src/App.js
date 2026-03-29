import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Heatmap = lazy(() => import('./pages/Heatmap'));
const Sectors = lazy(() => import('./pages/Sectors'));
const Scanner = lazy(() => import('./pages/Scanner'));
const StockDetail = lazy(() => import('./pages/StockDetail'));
const FiiDii = lazy(() => import('./pages/FiiDii'));
const News = lazy(() => import('./pages/News'));
const OptionsChain = lazy(() => import('./pages/OptionsChain'));
const Screener = lazy(() => import('./pages/Screener'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Charts = lazy(() => import('./pages/Charts'));
const CandlestickPatterns = lazy(() => import('./pages/CandlestickPatterns'));

const Loading = () => (
  <div className="flex items-center justify-center h-screen bg-dark-950">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
      <p className="text-dark-400 text-sm">Loading...</p>
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1a1d23', color: '#e1e3e5', border: '1px solid #3d4048' },
        }}
      />
      <Layout>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/heatmap" element={<Heatmap />} />
            <Route path="/sectors" element={<Sectors />} />
            <Route path="/sectors/:sector" element={<Sectors />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="/scanner/:key" element={<Scanner />} />
            <Route path="/stock/:symbol" element={<StockDetail />} />
            <Route path="/fii-dii" element={<FiiDii />} />
            <Route path="/news" element={<News />} />
            <Route path="/options" element={<OptionsChain />} />
            <Route path="/options/:symbol" element={<OptionsChain />} />
            <Route path="/screener" element={<Screener />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/charts" element={<Charts />} />
            <Route path="/charts/:symbol" element={<Charts />} />
            <Route path="/patterns" element={<CandlestickPatterns />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
}

export default App;
