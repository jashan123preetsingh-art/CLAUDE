const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
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
const { startScheduler } = require('./jobs/scheduler');
const { setupWebSocket } = require('./services/websocket');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket setup
setupWebSocket(wss);

// Start scheduler
startScheduler();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
});

module.exports = { app, server };
