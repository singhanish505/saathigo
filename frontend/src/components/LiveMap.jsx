import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { io } from 'socket.io-client';

// Helper to make a colored car DivIcon
function carIcon(type, matched = false) {
  const cls = ['car-marker', type, matched ? 'matched' : ''].filter(Boolean).join(' ');
  return L.divIcon({
    className: '',
    html: `<div class="${cls}">🚗</div>`,
    iconSize: [matched ? 38 : 32, matched ? 38 : 32],
    iconAnchor: [matched ? 19 : 16, matched ? 19 : 16],
  });
}
const pickupIcon = L.divIcon({
  className: '', html: '<div class="pulse"></div>', iconSize: [14, 14], iconAnchor: [7, 7],
});

export default function LiveMap({ city, drivers, filter, setFilter, pickup, matched, onSos, onShareFamily }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const markersRef = useRef(new Map()); // driverId -> Leaflet marker
  const pickupMarkerRef = useRef(null);
  const matchedMarkerRef = useRef(null);
  const socketRef = useRef(null);
  const [liveCount, setLiveCount] = useState(0);

  // Init map
  useEffect(() => {
    if (mapRef.current) return;
    mapRef.current = L.map(containerRef.current, { zoomControl: true })
      .setView(city.center, city.tier === 'metro' ? 12 : 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap · SaathiGo',
      maxZoom: 19,
    }).addTo(mapRef.current);
    pickupMarkerRef.current = L.marker(city.center, { icon: pickupIcon }).addTo(mapRef.current);
  }, []);

  // City change
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView(city.center, 12);
    pickupMarkerRef.current?.setLatLng([pickup.lat, pickup.lng]);
  }, [city, pickup]);

  // WebSocket: live driver updates
  useEffect(() => {
    if (socketRef.current) socketRef.current.disconnect();
    const socket = io('/location', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => setLiveCount((n) => n)); // trigger re-render

    socket.on('location:update', ({ driverId, lat, lng }) => {
      const m = markersRef.current.get(driverId);
      if (m) m.setLatLng([lat, lng]);
      if (matched && matched.driver.id === driverId && matchedMarkerRef.current) {
        matchedMarkerRef.current.setLatLng([lat, lng]);
      }
    });
    return () => { socket.disconnect(); };
  }, [matched]);

  // Subscribe to all visible drivers (cap to 100 for sanity)
  useEffect(() => {
    if (!socketRef.current) return;
    drivers.slice(0, 100).forEach(d => {
      socketRef.current.emit('rider:subscribe', { driverId: d.id });
    });
  }, [drivers]);

  // Render driver markers (filtered)
  useEffect(() => {
    if (!mapRef.current) return;
    // Clear old markers no longer in list
    const incomingIds = new Set(drivers.map(d => d.id));
    for (const [id, m] of markersRef.current) {
      if (!incomingIds.has(id)) {
        mapRef.current.removeLayer(m);
        markersRef.current.delete(id);
      }
    }
    // Add/update
    drivers.forEach(d => {
      const type = d.sakhi ? 'sakhi' : (d.ev ? 'ev' : '');
      let m = markersRef.current.get(d.id);
      if (!m) {
        m = L.marker([d.lat, d.lng], { icon: carIcon(type) }).addTo(mapRef.current);
        m.bindTooltip(`${d.name} · ⭐ ${d.rating}${d.ev ? ' · EV' : ''}${d.sakhi ? ' · Sakhi' : ''}`);
        markersRef.current.set(d.id, m);
      } else {
        m.setLatLng([d.lat, d.lng]);
      }
    });
    setLiveCount(drivers.length);
  }, [drivers]);

  // Matched-driver marker emphasis
  useEffect(() => {
    if (!matched || !mapRef.current) {
      if (matchedMarkerRef.current) {
        mapRef.current?.removeLayer(matchedMarkerRef.current);
        matchedMarkerRef.current = null;
      }
      return;
    }
    const driver = matched.driver;
    const ride = matched.ride;
    // Find current location from drivers list
    const cur = drivers.find(d => d.id === driver.id) || ride.pickup;
    if (matchedMarkerRef.current) mapRef.current.removeLayer(matchedMarkerRef.current);
    matchedMarkerRef.current = L.marker([cur.lat, cur.lng], { icon: carIcon(driver.ev ? 'ev' : (driver.sakhiVerified ? 'sakhi' : ''), true) })
      .addTo(mapRef.current);
  }, [matched, drivers]);

  const counts = {
    all: drivers.length,
    ev: drivers.filter(d => d.ev).length,
    sakhi: drivers.filter(d => d.sakhi).length,
    pool: drivers.filter(d => d.coop).length,
  };

  const filters = [
    { id: 'all',   label: 'All Cabs' },
    { id: 'ev',    label: '⚡ EV' },
    { id: 'sakhi', label: '👩 Sakhi' },
    { id: 'pool',  label: '🌸 Pool' },
  ];

  return (
    <>
      <div className="map-overlay-top">
        {filters.map(f => (
          <div
            key={f.id}
            className={`chip ${f.id} ${filter === f.id ? 'active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label} ({counts[f.id]})
          </div>
        ))}
      </div>

      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {matched && (
        <div className="map-overlay-bottom">
          <div className="driver-card">
            <div className={`driver-photo ${matched.driver.sakhiVerified ? 'sakhi' : (matched.driver.ev ? 'ev' : '')}`}>
              {matched.driver.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="driver-info">
              <div className="driver-name">
                {matched.driver.name}
                {matched.driver.sakhiVerified && <span className="tag sakhi">SAKHI</span>}
                {matched.driver.ev && <span className="tag ev">EV</span>}
                {matched.driver.coopMember && <span className="tag coop">CO-OP</span>}
              </div>
              <div className="driver-meta">
                ⭐ {matched.driver.rating} · {matched.driver.trips} trips
              </div>
            </div>
            <div className="car-info">
              <div>{matched.driver.vehicle.model}</div>
              <div className="plate">{matched.driver.vehicle.plate}</div>
            </div>
          </div>
          <div className="eta-row">
            <div className="eta">
              Arriving in <strong>{matched.ride.etaMin} min</strong>
              <span style={{ color: 'var(--muted)', marginLeft: 6 }}>
                · {matched.ride.distanceToPickupKm} km away
              </span>
            </div>
            <div className="actions">
              <button className="btn-icon" title="Share live location with family" onClick={onShareFamily}>📡</button>
              <button className="btn-icon" title="Call driver">📞</button>
              <button className="btn-icon btn-sos" title="SOS — Police + Family alert" onClick={onSos}>SOS</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
