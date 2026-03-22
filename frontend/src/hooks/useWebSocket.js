import { useEffect, useRef, useCallback } from 'react';
import useStore from '../store/useStore';

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:5000/ws';

export default function useWebSocket(symbols = []) {
  const ws = useRef(null);
  const { setWsConnected } = useStore();
  const reconnectTimeout = useRef(null);

  const connect = useCallback(() => {
    try {
      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        setWsConnected(true);
        // Subscribe to symbols
        if (symbols.length > 0) {
          ws.current.send(JSON.stringify({ type: 'subscribe', symbols }));
        }
      };

      ws.current.onclose = () => {
        setWsConnected(false);
        // Auto-reconnect after 3 seconds
        reconnectTimeout.current = setTimeout(connect, 3000);
      };

      ws.current.onerror = () => {
        setWsConnected(false);
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
    }
  }, [symbols, setWsConnected]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (ws.current) ws.current.close();
    };
  }, [connect]);

  const onMessage = useCallback((callback) => {
    if (ws.current) {
      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          callback(data);
        } catch (e) {
          // ignore invalid messages
        }
      };
    }
  }, []);

  return { ws: ws.current, onMessage };
}
