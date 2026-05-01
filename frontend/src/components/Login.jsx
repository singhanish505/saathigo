import React, { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onLogin, flashToast }) {
  const [phone, setPhone] = useState('+919876543210');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('Anish');
  const [devOtp, setDevOtp] = useState(null);
  const [stage, setStage] = useState('phone'); // phone | otp
  const [busy, setBusy] = useState(false);

  const requestOtp = async () => {
    setBusy(true);
    try {
      const r = await api.requestOtp(phone);
      setDevOtp(r.dev_otp);
      setStage('otp');
      flashToast('OTP sent. (Dev OTP shown below.)');
    } catch (e) { flashToast(e.message); }
    setBusy(false);
  };

  const verify = async () => {
    setBusy(true);
    try {
      const r = await api.verifyOtp(phone, otp || devOtp, name);
      onLogin(r.token, r.user);
    } catch (e) { flashToast(e.message); }
    setBusy(false);
  };

  return (
    <div className="login-wrap">
      <h2>Login to SaathiGo</h2>
      <p>India's first driver-owned, EV-first e-hailing co-operative.</p>

      {stage === 'phone' && (
        <>
          <input
            placeholder="Phone (+91XXXXXXXXXX)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn" disabled={busy || !phone} onClick={requestOtp}>
            {busy ? 'Sending OTP…' : 'Send OTP'}
          </button>
        </>
      )}

      {stage === 'otp' && (
        <>
          {devOtp && (
            <div className="dev-otp">
              <strong>Dev OTP:</strong> {devOtp} <span style={{ float: 'right' }}>(visible in dev only)</span>
            </div>
          )}
          <input
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength={6}
          />
          <button className="btn" disabled={busy} onClick={verify}>
            {busy ? 'Verifying…' : 'Verify & Login'}
          </button>
          <div style={{ marginTop: 12, fontSize: 12, color: '#6B7280', textAlign: 'center' }}>
            <a style={{ color: '#FF7A1A', cursor: 'pointer' }} onClick={() => setStage('phone')}>← Change phone</a>
          </div>
        </>
      )}
    </div>
  );
}
