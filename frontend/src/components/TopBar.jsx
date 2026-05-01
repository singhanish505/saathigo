import React from 'react';

export default function TopBar({ user, city, cities, onChangeCity, health, onLogout }) {
  const cycle = () => {
    if (!cities.length) return;
    const idx = cities.findIndex(c => c.code === city.code);
    onChangeCity(cities[(idx + 1) % cities.length].code);
  };
  return (
    <div className="topbar">
      <div className="brand">
        <div className="logo">सा</div>
        <div>
          <h1>SaathiGo</h1>
          <small>Aapki Apni Sawaari · Your Companion Ride</small>
        </div>
      </div>
      <div className="topnav">
        <a>Rides</a>
        <a>Sakhi Mode</a>
        <a>Hara Ride</a>
        <a>Sahkari Wallet</a>
        {user && <a onClick={onLogout}>Sign out</a>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="health" title={health.healthy ? 'API healthy' : 'API down'}>
          <span className={`dot ${health.healthy ? 'ok' : 'bad'}`}></span>
          {health.healthy ? `API ${health.mode}` : 'API down'}
        </span>
        <div className="city-chip" onClick={cycle}>📍 {city.name}</div>
      </div>
    </div>
  );
}
