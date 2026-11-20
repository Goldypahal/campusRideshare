import { useEffect, useRef } from 'react';

type EventHandler = (data: any) => void;

export function useWebSocket(onEvent: EventHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let pingInterval: NodeJS.Timeout | null = null;
    let isMounted = true;

    async function connect() {
      const token = localStorage.getItem('token');
      // If no token exists, do not attempt to open an unauthorized socket
      if (!token || !isMounted) return;

      let ticket: string | null = null;
      try {
        const ticketRes = await fetch('/api/auth/ws-ticket', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (ticketRes.ok) {
          const data = await ticketRes.json();
          ticket = data.ticket;
        }
      } catch (err) {
        console.warn('WS: ticket fetch error, falling back:', err);
      }

      if (!isMounted) return;

      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = window.location.host;
      const url = ticket
        ? `${scheme}://${host}/ws?ticket=${encodeURIComponent(ticket)}`
        : `${scheme}://${host}/ws?token=${encodeURIComponent(token)}`;

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WS: Connected and authenticated with server');
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
            if (data.type === 'error') {
              console.warn('WS server notification:', data.message);
              return;
            }
            onEvent && onEvent(data);
          } catch (e) {}
        };

        ws.onclose = (event) => {
          if (pingInterval) clearInterval(pingInterval);
          if (event.code === 4401) {
            console.warn('WS: Closed due to authentication failure (4401)');
            return; // Do not auto-reconnect if token was rejected
          }
          if (isMounted) {
            console.log('WS: Disconnected, scheduling reconnection in 3s...');
            reconnectTimeoutRef.current = setTimeout(connect, 3000);
          }
        };

        ws.onerror = (e) => {
          console.warn('WS connection notice:', e);
        };
      } catch (e) {
        console.error('WS setup error:', e);
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {}
      }
    };
  }, [onEvent]);
}
