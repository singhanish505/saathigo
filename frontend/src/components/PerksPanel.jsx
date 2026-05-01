import React from 'react';
import { useLang } from '../LangContext.jsx';

export default function PerksPanel({ user }) {
  const { t } = useLang();
  const streak = user.khushiStreak || 0;
  const co2 = user.co2SavedKg || 0;
  return (
    <>
      <h3>{t('your_wallet')}</h3>
      <div className="perk-card khushi">
        <h4>🎁 {t('khushi_streak')}</h4>
        <div className="big">{streak} / 10</div>
        <p>{t('rides_to_free', { n: Math.max(0, 10 - (streak % 10)) })}</p>
      </div>
      <div className="perk-card green">
        <h4>🌱 {t('hara_impact')}</h4>
        <div className="big">{co2.toFixed(2)} kg</div>
        <p>{t('co2_saved_desc', { n: Math.floor(co2 / 4) })}</p>
      </div>
      <div className="perk-card coop">
        <h4>🤝 {t('sahkari_dividend')}</h4>
        <div className="big">₹ 142</div>
        <p>{t('dividend_text')}</p>
      </div>

      <h3 style={{ marginTop: 18 }}>{t('what_diff')}</h3>
      <div className="feature-list">
        <div className="feature">
          <div className="fi a">S</div>
          <div className="feature-text">
            <strong>Sakhi Shield</strong>
            <span>{t('feat_sakhi_desc')}</span>
          </div>
        </div>
        <div className="feature">
          <div className="fi b">H</div>
          <div className="feature-text">
            <strong>Hara Ride</strong>
            <span>{t('feat_hara_desc')}</span>
          </div>
        </div>
        <div className="feature">
          <div className="fi c">W</div>
          <div className="feature-text">
            <strong>Sahkari Wheels</strong>
            <span>{t('feat_coop_desc')}</span>
          </div>
        </div>
        <div className="feature">
          <div className="fi d">B</div>
          <div className="feature-text">
            <strong>Apna Bhasha</strong>
            <span>{t('feat_bhasha_desc')}</span>
          </div>
        </div>
        <div className="feature">
          <div className="fi e">J</div>
          <div className="feature-text">
            <strong>OneJourney</strong>
            <span>{t('feat_journey_desc')}</span>
          </div>
        </div>
      </div>
    </>
  );
}
