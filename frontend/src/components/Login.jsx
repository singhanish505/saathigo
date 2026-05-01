import React, { useState } from 'react';
import { api } from '../api.js';
import { useLang } from '../LangContext.jsx';

export default function Login({ onLogin, flashToast }) {
  const { t } = useLang();
  const [phone, setPhone] = useState('+919876543210');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('Anish');
  const [devOtp, setDevOtp] = useState(null);
  const [stage, setStage] = useState('phone');
  const [busy, setBusy] = useState(false);

  const requestOtp = async () => {
    setBusy(true);
    try {
      const r = await api.requestOtp(phone);
      setDevOtp(r.dev_otp);
      setStage('otp');
      flashToast(t('otp_sent'));
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
      <h2>{t('login_title')}</h2>
      <p>{t('login_subtitle')}</p>

      {stage === 'phone' && (
        <>
          <input
            placeholder={t('phone_ph')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            placeholder={t('name_ph')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn" disabled={busy || !phone} onClick={requestOtp}>
            {busy ? t('sending_otp') : t('send_otp')}
          </button>
        </>
      )}

      {stage === 'otp' && (
        <>
          {devOtp && (
            <div className="dev-otp">
              <strong>{t('dev_otp_label')}</strong> {devOtp} <span style={{ float: 'right' }}>{t('dev_otp_note')}</span>
            </div>
          )}
          <input
            placeholder={t('otp_ph')}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength={6}
          />
          <button className="btn" disabled={busy} onClick={verify}>
            {busy ? t('verifying') : t('verify_login')}
          </button>
          <div style={{ marginTop: 12, fontSize: 12, color: '#6B7280', textAlign: 'center' }}>
            <a style={{ color: '#FF7A1A', cursor: 'pointer' }} onClick={() => setStage('phone')}>{t('change_phone')}</a>
          </div>
        </>
      )}
    </div>
  );
}
