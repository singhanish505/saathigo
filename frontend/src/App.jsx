import React, { useState, useEffect, useCallback } from 'react';
import { api, setToken, clearToken } from './api.js';
import { useLang } from './LangContext.jsx';
import Login from './components/Login.jsx';
import TopBar from './components/TopBar.jsx';
import BookingPanel from './components/BookingPanel.jsx';
import LiveMap from './components/LiveMap.jsx';
import PerksPanel from './components/PerksPanel.jsx';
import Toast from './components/Toast.jsx';
import RideConfirmModal from './components/RideConfirmModal.jsx';

export default function App() {
  const { t } = useLang();
  const [user, setUser] = useState(null);
  const [bootError, setBootError] = useState(null);
  const [cities, setCities] = useState([]);
  const [city, setCity] = useState({ code: 'BLR', name: 'Bangalore', center: [12.9716, 77.5946], tier: 'metro' });
  const [filter, setFilter] = useState('all');
  const [rideType, setRideType] = useState('EV');
  const [pickup, setPickup] = useState({ lat: 12.9716, lng: 77.5946, label: 'Indiranagar 100ft Road' });
  const [drop, setDrop]     = useState({ lat: 13.1986, lng: 77.7066, label: 'Kempegowda International Airport' });
  const [quotes, setQuotes] = useState([]);
  const [surge, setSurge]   = useState(1.0);
  const [drivers, setDrivers] = useState([]);
  const [matched, setMatched] = useState(null); // { ride, driver }
  const [toast, setToast] = useState(null);
  const [health, setHealth] = useState({ healthy: false, mode: '...' });

  const flashToast = useCallback((message) => {
    setToast({ message, ts: Date.now() });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Boot
  useEffect(() => {
    (async () => {
      try {
        const h = await fetch('/healthz').then(r => r.json()).catch(() => ({ healthy: false }));
        setHealth(h);
        const c = await api.cities();
        setCities(c.cities);
        if (localStorage.getItem('saathigo_token')) {
          try {
            const me = await api.me();
            setUser(me.user);
          } catch (_e) { clearToken(); }
        }
      } catch (e) {
        setBootError(e.message);
      }
    })();
  }, []);

  // Whenever city or pickup changes, refresh drivers + estimate
  const refreshDrivers = useCallback(async () => {
    try {
      const res = await api.nearbyDrivers(city.code, city.center[0], city.center[1], filter, 6);
      setDrivers(res.drivers);
    } catch (e) { /* probably 401 - ignore on first load */ }
  }, [city, filter]);

  const refreshEstimate = useCallback(async () => {
    try {
      const r = await api.estimate(pickup, drop, city.code);
      setQuotes(r.quotes);
      setSurge(r.surge);
    } catch (e) { /* ignore */ }
  }, [pickup, drop, city]);

  useEffect(() => { refreshDrivers(); }, [refreshDrivers]);
  useEffect(() => { refreshEstimate(); }, [refreshEstimate]);

  const onLogin = async (token, user) => {
    setToken(token);
    setUser(user);
    flashToast(t('welcome_toast', { name: user.name }));
  };

  const onLogout = () => {
    clearToken();
    setUser(null);
    setMatched(null);
    flashToast(t('signed_out'));
  };

  const onChangeCity = (code) => {
    const next = cities.find(c => c.code === code) || city;
    setCity(next);
    setPickup({ lat: next.center[0], lng: next.center[1], label: `${next.name} Centre` });
    setDrop({ lat: next.center[0] + 0.05, lng: next.center[1] + 0.05, label: `${next.name} Outskirts` });
    flashToast(t('switched_city', { city: next.name }) + (next.tier === 'tier2' ? ' · ' + t('tier2_note') : ''));
  };

  const onSelectPickup = (loc) => {
    setPickup(loc);
  };

  const onBook = async () => {
    if (!user) { flashToast(t('login_first')); return; }
    try {
      const res = await api.bookRide(city.code, pickup, drop, rideType);
      setMatched(res);
      flashToast(t('ride_booked'));
    } catch (e) {
      flashToast(t('could_not_book', { msg: e.message }));
    }
  };

  const onSos = async () => {
    if (!matched) return;
    try {
      const r = await api.sos(matched.ride.id, pickup.lat, pickup.lng);
      flashToast(t('sos_raised', { id: r.incident.id }));
    } catch (e) {
      flashToast(t('sos_failed', { msg: e.message }));
    }
  };

  const onShareFamily = async () => {
    if (!matched) return;
    try {
      const r = await api.familyLink(matched.ride.id);
      navigator.clipboard?.writeText(r.url);
      flashToast(t('family_copied'));
    } catch (e) {
      flashToast(t('family_failed', { msg: e.message }));
    }
  };

  if (bootError) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Could not connect to backend</h2>
        <p style={{ color: '#6B7280', marginTop: 8 }}>{bootError}</p>
        <p style={{ color: '#6B7280', marginTop: 12, fontSize: 13 }}>
          Run <code>cd backend && npm install && npm start</code>, then reload.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <TopBar user={null} city={city} cities={cities} onChangeCity={onChangeCity} onSelectPickup={onSelectPickup} health={health} onLogout={onLogout} />
        <Login onLogin={onLogin} flashToast={flashToast} />
        <Toast toast={toast} />
      </>
    );
  }

  return (
    <>
      <TopBar user={user} city={city} cities={cities} onChangeCity={onChangeCity} onSelectPickup={onSelectPickup} health={health} onLogout={onLogout} />
      <div className="app">
        <div className="panel left">
          <BookingPanel
            user={user}
            city={city}
            pickup={pickup} setPickup={setPickup}
            drop={drop} setDrop={setDrop}
            quotes={quotes} surge={surge}
            rideType={rideType} setRideType={setRideType}
            onBook={onBook}
            flashToast={flashToast}
          />
        </div>
        <div className="panel map-wrap">
          <LiveMap
            city={city}
            drivers={drivers}
            filter={filter} setFilter={setFilter}
            pickup={pickup}
            matched={matched}
            onSos={onSos}
            onShareFamily={onShareFamily}
          />
        </div>
        <div className="panel right">
          <PerksPanel user={user} matched={matched} />
        </div>
      </div>
      {matched && <RideConfirmModal matched={matched} onClose={() => setMatched(null)} />}
      <Toast toast={toast} />
    </>
  );
}
