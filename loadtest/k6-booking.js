// k6 load test - booking + estimate flow.
// Run with: `k6 run loadtest/k6-booking.js`
//
// Stages: warm -> ramp -> peak -> hold -> ramp-down.
// On a single laptop you'll see ~5k RPS. The 100M-request story is in the architecture doc;
// this script demonstrates the request shape and lets you verify a target environment.
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:4000';

const bookCounter = new Counter('rides_booked');
const estimateLatency = new Trend('estimate_latency_ms');

export const options = {
  scenarios: {
    booking: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 2000,
      stages: [
        { duration: '30s', target: 200 },   // warm
        { duration: '1m',  target: 1000 },  // ramp
        { duration: '2m',  target: 5000 },  // peak (5k RPS)
        { duration: '1m',  target: 5000 },  // hold
        { duration: '30s', target: 0 },     // ramp-down
      ],
    },
  },
  thresholds: {
    http_req_failed:   ['rate<0.01'],     // < 1% errors
    http_req_duration: ['p(95)<300'],     // p95 < 300ms
    estimate_latency_ms: ['p(99)<500'],
  },
};

const cities = [
  { code: 'BLR', center: [12.9716, 77.5946] },
  { code: 'MUM', center: [19.0760, 72.8777] },
  { code: 'DEL', center: [28.6139, 77.2090] },
  { code: 'PUN', center: [18.5204, 73.8567] },
  { code: 'HYD', center: [17.3850, 78.4867] },
  { code: 'PAT', center: [25.5941, 85.1376] },
];
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function jitter(c, m = 0.05) { return c + (Math.random() - 0.5) * m; }

export function setup() {
  // 1. Get an OTP and login a single rider for the run
  const phone = '+919876500000';
  const otpRes = http.post(`${BASE}/api/v1/auth/request-otp`, JSON.stringify({ phone }),
    { headers: { 'Content-Type': 'application/json' } });
  const otp = otpRes.json('dev_otp');
  const verifyRes = http.post(`${BASE}/api/v1/auth/verify-otp`,
    JSON.stringify({ phone, otp, name: 'Load Tester' }),
    { headers: { 'Content-Type': 'application/json' } });
  return { token: verifyRes.json('token') };
}

export default function (data) {
  const city = pick(cities);
  const pickup = { lat: jitter(city.center[0]), lng: jitter(city.center[1]), label: 'Test pickup' };
  const drop   = { lat: jitter(city.center[0], 0.1), lng: jitter(city.center[1], 0.1), label: 'Test drop' };
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` };

  // Estimate
  const t0 = Date.now();
  const est = http.post(`${BASE}/api/v1/rides/estimate`,
    JSON.stringify({ pickup, drop, cityCode: city.code }), { headers });
  estimateLatency.add(Date.now() - t0);
  check(est, { 'estimate 200': (r) => r.status === 200 });

  // 30% of estimates -> book
  if (Math.random() < 0.3) {
    const types = ['EV','SAKHI','POOL','ONEJOURNEY','STD'];
    const book = http.post(`${BASE}/api/v1/rides/book`,
      JSON.stringify({ pickup, drop, cityCode: city.code, rideType: pick(types) }), { headers });
    if (book.status === 201) bookCounter.add(1);
    check(book, { 'book 201/503': (r) => r.status === 201 || r.status === 503 });
  }

  sleep(Math.random() * 0.5);
}
