// Scheduler is optional — all data is fetched live from Yahoo Finance
// This only adds background refresh for WebSocket push updates

function startScheduler() {
  console.log('Scheduler: All data served LIVE via Yahoo Finance + NSE APIs');
  console.log('Scheduler: No background jobs needed — data fetched on request with 1-min caching');
}

module.exports = { startScheduler };
