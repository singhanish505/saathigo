import React from 'react';

const RIDE_NAMES = {
  STD:        { label: 'Standard', tag: 'Reliable cab', cls: '' },
  EV:         { label: 'Hara EV',  tag: '100% electric · CO₂ saved', cls: 'ev' },
  SAKHI:      { label: 'Sakhi',    tag: 'Women driver · Family tracking', cls: 'sakhi' },
  POOL:       { label: 'Garland Pool', tag: 'Verified co-riders · 50% off', cls: 'pool' },
  ONEJOURNEY: { label: 'OneJourney',  tag: 'Auto + Metro + Cab · 1 fare', cls: 'onejourney' },
};

export default function BookingPanel({
  user, city, pickup, setPickup, drop, setDrop,
  quotes, surge, rideType, setRideType, onBook, flashToast,
}) {
  const selected = quotes.find(q => q.type === rideType) || quotes[0];

  return (
    <div className="booking">
      <div className="greeting">Namaste, {user.name} <span className="wave">👋</span></div>
      <div className="sub">Where would you like to go today?</div>

      <div className="lang-bar">
        <span className="lang active">EN</span>
        <span className="lang" onClick={() => flashToast('हिन्दी UI active')}>हिं</span>
        <span className="lang" onClick={() => flashToast('ಕನ್ನಡ UI active')}>कन्नड़</span>
        <span className="lang" onClick={() => flashToast('मराठी UI active')}>मराठी</span>
        <span className="lang" onClick={() => flashToast('తెలుగు UI active')}>తెలుగు</span>
        <span className="lang" onClick={() => flashToast('भोजपुरी UI active (Bihar mode)')}>भोजपुरी</span>
        <span className="lang" onClick={() => flashToast('🎙 Voice booking: "Mujhe airport jaana hai" → booked Hara EV.')}>🎙 Voice</span>
      </div>

      <div className="input-stack">
        <div className="input-row">
          <span className="pin green"></span>
          <input
            value={pickup.label || ''}
            onChange={(e) => setPickup({ ...pickup, label: e.target.value })}
            placeholder="Pickup location"
          />
        </div>
        <div className="input-row">
          <span className="pin red"></span>
          <input
            value={drop.label || ''}
            onChange={(e) => setDrop({ ...drop, label: e.target.value })}
            placeholder="Drop location"
          />
        </div>
      </div>

      {surge > 1.05 && (
        <div className="surge-banner">
          ⚡ {surge.toFixed(2)}x demand surge in {city.name}
          <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.85 }}>
            (capped at {city.tier === 'metro' ? '2.2x' : '1.6x'})
          </span>
        </div>
      )}

      <div className="promise-bar">
        <span style={{ fontSize: 16 }}>🌟</span>
        <span><strong>Khushi Promise:</strong> Clean cab, free water & charging — or your ride is free.</span>
      </div>

      <div className="ride-types">
        {quotes.map(q => {
          const meta = RIDE_NAMES[q.type] || { label: q.type, tag: '', cls: '' };
          return (
            <div
              key={q.type}
              className={`ride-type ${meta.cls} ${rideType === q.type ? 'selected' : ''}`}
              onClick={() => setRideType(q.type)}
            >
              <div className="rt-head">
                <span className="rt-name">{meta.label}</span>
                <span className="rt-eta">{q.minutes} min</span>
              </div>
              <div className="rt-price">{q.farePretty}</div>
              <div className="rt-tag">{meta.tag}{q.co2SavedGrams ? ` · ${(q.co2SavedGrams / 1000).toFixed(2)} kg saved` : ''}</div>
            </div>
          );
        })}
      </div>

      <button className="btn book-btn" onClick={onBook} disabled={!selected}>
        {selected ? `Book ${RIDE_NAMES[selected.type]?.label || selected.type} — ${selected.farePretty}` : 'Loading…'}
      </button>

      <div style={{ marginTop: 14, fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
        🛡️ Sahkari Wheels · 92% of fare goes to driver-owners
      </div>
    </div>
  );
}
