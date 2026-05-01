import React, { useState, useRef, useEffect } from 'react';
import { useLang } from '../LangContext.jsx';
import { ALL_INDIA_CITIES, PLACES } from '../placesData.js';

export default function LocationPicker({ cities, city, onChangeCity, onSelectPickup }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [gpsState, setGpsState] = useState('idle');
  const ref = useRef(null);
  const inputRef = useRef(null);

  const backendCodes = new Set(cities.map(c => c.code));

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 50);
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const q = query.toLowerCase().trim();

  const filteredCities = ALL_INDIA_CITIES.filter(c =>
    !q || c.name.toLowerCase().includes(q)
  );

  const filteredPlaces = q
    ? PLACES.filter(p =>
        p.label.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q)
      )
    : PLACES.filter(p => p.city === city.name);

  const selectCity = (c) => {
    if (c.code && backendCodes.has(c.code)) {
      onChangeCity(c.code);
    } else {
      onSelectPickup({ lat: c.lat, lng: c.lng, label: c.name + ' Centre' });
    }
    setOpen(false);
    setQuery('');
  };

  const selectPlace = (place) => {
    if (place.cityCode && backendCodes.has(place.cityCode) && place.cityCode !== city.code) {
      onChangeCity(place.cityCode);
    }
    onSelectPickup({ lat: place.lat, lng: place.lng, label: place.label });
    setOpen(false);
    setQuery('');
  };

  const useGps = () => {
    if (!navigator.geolocation) return;
    setGpsState('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsState('idle');
        onSelectPickup({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: t('loc_my_location'),
        });
        setOpen(false);
        setQuery('');
      },
      () => setGpsState('error'),
      { timeout: 8000 }
    );
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="city-chip" onClick={() => setOpen(o => !o)}>
        📍 {city.name}
        <span style={{ fontSize: 9, opacity: 0.75, marginLeft: 2 }}>▾</span>
      </div>

      {open && (
        <div className="loc-picker">
          <div className="loc-search-row">
            <span className="loc-search-icon">🔍</span>
            <input
              ref={inputRef}
              className="loc-search"
              placeholder={t('loc_search_ph')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="loc-clear" onClick={() => setQuery('')}>✕</button>
            )}
          </div>

          <button
            className={`loc-gps${gpsState === 'error' ? ' error' : ''}`}
            onClick={useGps}
            disabled={gpsState === 'loading'}
          >
            {gpsState === 'loading' ? (
              <><span className="loc-spinner" /> {t('loc_detecting')}</>
            ) : gpsState === 'error' ? (
              <>⚠️ {t('loc_gps_error')}</>
            ) : (
              <>🎯 {t('loc_use_gps')}</>
            )}
          </button>

          <div className="loc-scroll">
            {filteredCities.length > 0 && (
              <>
                <div className="loc-section">{t('loc_cities')}</div>
                {filteredCities.map(c => (
                  <div
                    key={c.name}
                    className={`loc-item${c.code === city.code ? ' active' : ''}`}
                    onClick={() => selectCity(c)}
                  >
                    <span className="loc-item-icon">🏙</span>
                    <span className="loc-item-label">{c.name}</span>
                    {c.code && backendCodes.has(c.code) ? (
                      <span className="loc-tier live">✓ Live</span>
                    ) : (
                      <span className="loc-tier">soon</span>
                    )}
                  </div>
                ))}
              </>
            )}

            {filteredPlaces.length > 0 && (
              <>
                <div className="loc-section">
                  {q ? t('loc_results') : t('loc_nearby')}
                </div>
                {filteredPlaces.map((p, i) => (
                  <div
                    key={i}
                    className="loc-item"
                    onClick={() => selectPlace(p)}
                  >
                    <span className="loc-item-icon">📌</span>
                    <span className="loc-item-label">{p.label}</span>
                    {(q || p.city !== city.name) && (
                      <span className="loc-tier">{p.city}</span>
                    )}
                  </div>
                ))}
              </>
            )}

            {filteredCities.length === 0 && filteredPlaces.length === 0 && (
              <div className="loc-empty">{t('loc_no_results', { q: query })}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
