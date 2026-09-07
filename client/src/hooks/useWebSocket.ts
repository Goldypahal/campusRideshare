import { useEffect, useRef } from 'react';

type EventHandler = (data: any) => void;

export function useWebSocket(onEvent: EventHandler) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const token = localStorage.getItem('token');
    const url = token ? `${scheme}://${host}/ws?token=${encodeURIComponent(token)}` : `${scheme}://${host}/ws`;

    let pingInterval: NodeJS.Timeout | null = null;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WS connected & authenticated');
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === 'pong') return;
          onEvent && onEvent(data);
        } catch (e) {}
      };

      ws.onclose = () => {
        console.log('WS closed');
        if (pingInterval) clearInterval(pingInterval);
      };

      ws.onerror = (e) => console.error('WS error', e);

      return () => {
        if (pingInterval) clearInterval(pingInterval);
        try { ws.close(); } catch (e) {}
      };
    } catch (e) {
      console.error('WS connection failed', e);
    }
  }, [onEvent]);
}
