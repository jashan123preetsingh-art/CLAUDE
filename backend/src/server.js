const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
require('dotenv').config();

const stockRoutes = require('./routes/stocks');
const scannerRoutes = require('./routes/scanners');
const fundamentalRoutes = require('./routes/fundamentals');
const fiiDiiRoutes = require('./routes/fiiDii');
const alertRoutes = require('./routes/alerts');
const authRoutes = require('./routes/auth');
const newsRoutes = require('./routes/news');
const optionsRoutes = require('./routes/options');
const chartRoutes = require('./routes/charts');
const sectorRoutes = require('./routes/sectors');
const { setupWebSocket } = require('./services/websocket');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Middleware
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());

// API Routes
app.use('/api/stocks', stockRoutes);
app.use('/api/scanners', scannerRoutes);
app.use('/api/fundamentals', fundamentalRoutes);
app.use('/api/fii-dii', fiiDiiRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/options', optionsRoutes);
app.use('/api/charts', chartRoutes);
app.use('/api/sectors', sectorRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: 'live_api', timestamp: new Date().toISOString() });
});

// Serve React frontend build
const frontendBuild = path.join(__dirname, '../../frontend/build');
app.use(express.static(frontendBuild));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuild, 'index.html'));
});

// WebSocket
setupWebSocket(wss);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n=== StockPulse Server ===`);
  console.log(`API:       http://localhost:${PORT}/api`);
  console.log(`Frontend:  http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`Mode:      LIVE API (Yahoo Finance + NSE)`);
  console.log(`Stocks:    ALL NSE/BSE via live API`);
  console.log(`========================\n`);
});

module.exports = { app, server };
