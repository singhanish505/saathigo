import React from 'react';

export default function PerksPanel({ user, matched }) {
  const streak = user.khushiStreak || 0;
  const co2 = user.co2SavedKg || 0;
  return (
    <>
      <h3>Your Saathi Wallet</h3>
      <div className="perk-card khushi">
        <h4>🎁 Khushi Streak</h4>
        <div className="big">{streak} / 10</div>
        <p>{Math.max(0, 10 - (streak % 10))} more rides → next ride FREE (up to ₹400)</p>
      </div>
      <div className="perk-card green">
        <h4>🌱 Hara Impact</h4>
        <div className="big">{co2.toFixed(2)} kg</div>
        <p>CO₂ saved · {Math.floor(co2 / 4)} tree credits in your account</p>
      </div>
      <div className="perk-card coop">
        <h4>🤝 Sahkari Dividend</h4>
        <div className="big">₹ 142</div>
        <p>Your share of platform profit (Q1 2026 mock, paid via UPI)</p>
      </div>

      <h3 style={{ marginTop: 18 }}>What makes us different</h3>
      <div className="feature-list">
        <div className="feature">
          <div className="fi a">S</div>
          <div className="feature-text">
            <strong>Sakhi Shield</strong>
            <span>Verified women drivers, AI route-deviation alert, one-tap police SOS in 6 cities.</span>
          </div>
        </div>
        <div className="feature">
          <div className="fi b">H</div>
          <div className="feature-text">
            <strong>Hara Ride</strong>
            <span>EV-first fleet with battery-swap stations. Carbon credits to riders.</span>
          </div>
        </div>
        <div className="feature">
          <div className="fi c">W</div>
          <div className="feature-text">
            <strong>Sahkari Wheels</strong>
            <span>Drivers own equity. Just 8% commission (vs 25% Ola/Uber). Quarterly dividend.</span>
          </div>
        </div>
        <div className="feature">
          <div className="fi d">B</div>
          <div className="feature-text">
            <strong>Apna Bhasha</strong>
            <span>Voice booking in 11 Indian languages. SMS booking for low-data areas.</span>
          </div>
        </div>
        <div className="feature">
          <div className="fi e">J</div>
          <div className="feature-text">
            <strong>OneJourney</strong>
            <span>Door-to-door across modes (auto + metro + cab + e-rickshaw) with one fare.</span>
          </div>
        </div>
      </div>
    </>
  );
}
