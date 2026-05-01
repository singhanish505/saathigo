// k6 WebSocket load test - simulates rider clients holding open connections.
// Run with: `k6 run loadtest/k6-websocket.js`
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE_WS = (__ENV.BASE_URL || 'http://localhost:4000').replace('http', 'ws');
const messagesReceived = new Counter('ws_messages_received');
const connTime = new Trend('ws_connect_ms');

export const options = {
  scenarios: {
    riders: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m',  target: 1000 },   // 1k concurrent rider WS
        { duration: '3m',  target: 5000 },   // 5k concurrent rider WS
        { duration: '1m',  target: 0 },
      ],
    },
  },
  thresholds: {
    ws_connect_ms:   ['p(95)<500'],
    ws_session_duration: ['p(95)>30000'],
  },
};

export default function () {
  const t0 = Date.now();
  const url = `${BASE_WS}/socket.io/?EIO=4&transport=websocket&ns=/location`;
  ws.connect(url, {}, (socket) => {
    socket.on('open', () => {
      connTime.add(Date.now() - t0);
      // Subscribe to a random driver
      const driverId = `drv_blr_${String(Math.floor(Math.random() * 100) + 1).padStart(5, '0')}`;
      socket.send(JSON.stringify(['rider:subscribe', { driverId }]));
    });
    socket.on('message', () => messagesReceived.add(1));
    socket.setTimeout(() => socket.close(), 30_000);
  });
}
