import React from 'react';
import { useLang } from '../LangContext.jsx';
import LocationPicker from './LocationPicker.jsx';

export default function TopBar({ user, city, cities, onChangeCity, onSelectPickup, health, onLogout }) {
  const { t } = useLang();
  return (
    <div className="topbar">
      <div className="brand">
        <div className="logo">सा</div>
        <div>
          <h1>SaathiGo</h1>
          <small>{t('tagline')}</small>
        </div>
      </div>
      <div className="topnav">
        <a>{t('nav_rides')}</a>
        <a>{t('nav_sakhi')}</a>
        <a>{t('nav_hara')}</a>
        <a>{t('nav_wallet')}</a>
        {user && <a onClick={onLogout}>{t('sign_out')}</a>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="health" title={health.healthy ? t('api_healthy', { mode: health.mode }) : t('api_down')}>
          <span className={`dot ${health.healthy ? 'ok' : 'bad'}`}></span>
          {health.healthy ? t('api_healthy', { mode: health.mode }) : t('api_down')}
        </span>
        <LocationPicker
          cities={cities}
          city={city}
          onChangeCity={onChangeCity}
          onSelectPickup={onSelectPickup}
        />
      </div>
    </div>
  );
}
