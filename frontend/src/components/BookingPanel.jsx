import React from 'react';
import { useLang } from '../LangContext.jsx';
import { LANGS } from '../i18n.js';
import VoiceBooking from './VoiceBooking.jsx';

const RIDE_NAMES = {
  STD:        { label: 'Standard',     cls: '',          tagKey: 'rt_std_tag' },
  EV:         { label: 'Hara EV',      cls: 'ev',        tagKey: 'rt_ev_tag' },
  SAKHI:      { label: 'Sakhi',        cls: 'sakhi',     tagKey: 'rt_sakhi_tag' },
  POOL:       { label: 'Garland Pool', cls: 'pool',      tagKey: 'rt_pool_tag' },
  ONEJOURNEY: { label: 'OneJourney',   cls: 'onejourney',tagKey: 'rt_onejourney_tag' },
};

export default function BookingPanel({
  user, city, pickup, setPickup, drop, setDrop,
  quotes, surge, rideType, setRideType, onBook,
}) {
  const { lang, setLang, t } = useLang();
  const selected = quotes.find(q => q.type === rideType) || quotes[0];

  return (
    <div className="booking">
      <div className="greeting">{t('greeting', { name: user.name })} <span className="wave">👋</span></div>
      <div className="sub">{t('where_go')}</div>

      <div className="lang-bar">
        {LANGS.map(l => (
          <span
            key={l.code}
            className={`lang${lang === l.code ? ' active' : ''}`}
            onClick={() => setLang(l.code)}
          >
            {l.label}
          </span>
        ))}
        <VoiceBooking city={city} setDrop={setDrop} setRideType={setRideType} />
      </div>

      <div className="input-stack">
        <div className="input-row">
          <span className="pin green"></span>
          <input
            value={pickup.label || ''}
            onChange={(e) => setPickup({ ...pickup, label: e.target.value })}
            placeholder={t('pickup_ph')}
          />
        </div>
        <div className="input-row">
          <span className="pin red"></span>
          <input
            value={drop.label || ''}
            onChange={(e) => setDrop({ ...drop, label: e.target.value })}
            placeholder={t('drop_ph')}
          />
        </div>
      </div>

      {surge > 1.05 && (
        <div className="surge-banner">
          ⚡ {t('surge_banner', { mult: surge.toFixed(2), city: city.name })}
          <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.85 }}>
            ({t('surge_capped', { cap: city.tier === 'metro' ? '2.2x' : '1.6x' })})
          </span>
        </div>
      )}

      <div className="promise-bar">
        <span style={{ fontSize: 16 }}>🌟</span>
        <span><strong>{t('khushi_promise_label')}</strong> {t('khushi_promise_text')}</span>
      </div>

      <div className="ride-types">
        {quotes.map(q => {
          const meta = RIDE_NAMES[q.type] || { label: q.type, cls: '', tagKey: '' };
          return (
            <div
              key={q.type}
              className={`ride-type ${meta.cls} ${rideType === q.type ? 'selected' : ''}`}
              onClick={() => setRideType(q.type)}
            >
              <div className="rt-head">
                <span className="rt-name">{meta.label}</span>
                <span className="rt-eta">{q.minutes} {t('min')}</span>
              </div>
              <div className="rt-price">{q.farePretty}</div>
              <div className="rt-tag">
                {meta.tagKey ? t(meta.tagKey) : ''}
                {q.co2SavedGrams ? ` · ${(q.co2SavedGrams / 1000).toFixed(2)} ${t('co2_short')}` : ''}
              </div>
            </div>
          );
        })}
      </div>

      <button className="btn book-btn" onClick={onBook} disabled={!selected}>
        {selected ? t('book_btn', { type: RIDE_NAMES[selected.type]?.label || selected.type, fare: selected.farePretty }) : t('loading')}
      </button>

      <div style={{ marginTop: 14, fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
        🛡️ {t('coop_footer')}
      </div>
    </div>
  );
}
