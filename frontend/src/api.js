// Tiny fetch wrapper for the SaathiGo API.

const BASE = import.meta.env.VITE_API_BASE || ''; // empty -> use Vite proxy

function token() { return localStorage.getItem('saathigo_token'); }
export function setToken(t) { localStorage.setItem('saathigo_token', t); }
export function clearToken() { localStorage.removeItem('saathigo_token'); }

async function call(path, { method = 'GET', body, headers } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: 'Bearer ' + token() } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error?.message || res.statusText), { status: res.status, data });
  return data;
}

export const api = {
  // Auth
  requestOtp: (phone)         => call('/api/v1/auth/request-otp', { method: 'POST', body: { phone } }),
  verifyOtp:  (phone, otp, name) => call('/api/v1/auth/verify-otp',   { method: 'POST', body: { phone, otp, name } }),
  me:         ()              => call('/api/v1/auth/me'),
  updateMe:   (patch)         => call('/api/v1/auth/me', { method: 'PATCH', body: patch }),

  // Cities
  cities:     ()              => call('/api/v1/cities'),

  // Drivers
  nearbyDrivers: (city, lat, lng, filter = 'all', radius = 5) =>
    call(`/api/v1/drivers/nearby?city=${city}&lat=${lat}&lng=${lng}&filter=${filter}&radius=${radius}`),

  // Rides
  estimate: (pickup, drop, cityCode) =>
    call('/api/v1/rides/estimate', { method: 'POST', body: { pickup, drop, cityCode } }),
  bookRide: (cityCode, pickup, drop, rideType) =>
    call('/api/v1/rides/book', { method: 'POST', body: { cityCode, pickup, drop, rideType } }),
  getRide:  (id)              => call('/api/v1/rides/' + id),
  setRideStatus: (id, status) => call('/api/v1/rides/' + id + '/status', { method: 'PATCH', body: { status } }),
  rides:    ()                => call('/api/v1/rides'),

  // Sakhi
  sos:        (rideId, lat, lng, severity = 'panic') =>
    call('/api/v1/sakhi/sos', { method: 'POST', body: { rideId, lat, lng, severity } }),
  familyLink: (rideId)        => call('/api/v1/sakhi/family-link', { method: 'POST', body: { rideId } }),
};
