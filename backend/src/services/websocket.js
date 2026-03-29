const clients = new Set();

function setupWebSocket(wss) {
  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`WebSocket client connected. Total: ${clients.size}`);

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'subscribe') {
          ws.subscriptions = ws.subscriptions || new Set();
          (data.symbols || []).forEach(s => ws.subscriptions.add(s));
        }
      } catch (e) {
        // ignore invalid messages
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.send(JSON.stringify({ type: 'connected', message: 'Connected to Stock Analytics WebSocket' }));
  });
}

function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === 1) {
      if (data.type === 'price_update' && client.subscriptions) {
        if (client.subscriptions.has(data.symbol) || client.subscriptions.has('*')) {
          client.send(message);
        }
      } else {
        client.send(message);
      }
    }
  });
}

module.exports = { setupWebSocket, broadcast };
