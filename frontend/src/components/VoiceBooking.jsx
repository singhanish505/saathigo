import React, { useState, useRef, useEffect } from 'react';
import { useLang } from '../LangContext.jsx';
import { PLACES } from '../placesData.js';

// BCP-47 codes for Web Speech API — Bhojpuri has no official code, falls back to Hindi
const SPEECH_LANG = {
  en:  'en-IN',
  hi:  'hi-IN',
  kn:  'kn-IN',
  mr:  'mr-IN',
  te:  'te-IN',
  bho: 'hi-IN',
};

// Ride type detection — English keywords + common Indian script variants
const RIDE_PATTERNS = [
  { type: 'SAKHI',      re: /\b(sakhi|women|ladies|mahila|महिला|सखी|ಮಹಿಳೆ|మహిళ|femmes?)\b/i },
  { type: 'POOL',       re: /\b(pool|share|shared|pooled|पूल|शेयर|ਸ਼ੇਅਰ)\b/i },
  { type: 'ONEJOURNEY', re: /\b(one\s*journey|premium|ek\s*safar|एक सफर|ఒక యాత్ర)\b/i },
  { type: 'EV',         re: /\b(ev|electric|hara|green|इलेक्ट्रिक|हरा|ಹಸಿರು|హరా|విద్యుత్)\b/i },
];

// Score-based best match across all transcript alternatives
function findPlace(texts) {
  let best = null, bestScore = 0;
  for (const text of texts) {
    const lower = text.toLowerCase();
    for (const p of PLACES) {
      const label = p.label.toLowerCase();
      if (lower.includes(label) && label.length > bestScore) {
        best = p;
        bestScore = label.length;
      }
    }
  }
  return best;
}

function findRideType(text) {
  for (const { type, re } of RIDE_PATTERNS) {
    if (re.test(text)) return type;
  }
  return null;
}

export default function VoiceBooking({ city, setDrop, setRideType }) {
  const { lang, t } = useLang();
  // phase: idle | listening | heard | error | unsupported
  const [phase, setPhase] = useState('idle');
  const [interim, setInterim] = useState('');
  const [transcript, setTranscript] = useState('');
  const [matched, setMatched] = useState(null);
  const [rideMatch, setRideMatch] = useState(null);
  const recogRef = useRef(null);

  // Abort recognition on unmount
  useEffect(() => () => recogRef.current?.abort(), []);

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setPhase('unsupported'); return; }

    const recog = new SR();
    recog.lang = SPEECH_LANG[lang] || 'en-IN';
    recog.continuous = false;
    recog.interimResults = true;
    recog.maxAlternatives = 5;
    recogRef.current = recog;

    setPhase('listening');
    setInterim('');
    setTranscript('');
    setMatched(null);
    setRideMatch(null);

    let done = false;

    const finish = (result) => {
      if (done) return;
      done = true;
      const alts = Array.from({ length: result.length }, (_, i) => result[i].transcript);
      const text = alts[0];
      setTranscript(text);
      setMatched(findPlace(alts));
      setRideMatch(findRideType(text));
      setPhase('heard');
    };

    recog.onresult = (e) => {
      const result = e.results[e.results.length - 1];
      if (result.isFinal) {
        finish(result);
      } else {
        setInterim(result[0].transcript);
      }
    };

    recog.onerror = (e) => {
      if (e.error !== 'aborted') setPhase('error');
    };

    recog.onend = () => {
      if (!done) {
        // Timed out with no final result — use interim if available
        if (interim) {
          const fakeResult = [{ transcript: interim }];
          fakeResult.length = 1;
          setTranscript(interim);
          setMatched(findPlace([interim]));
          setRideMatch(findRideType(interim));
          setPhase('heard');
          done = true;
        } else {
          setPhase('error');
        }
      }
    };

    recog.start();
  };

  const cancel = () => {
    recogRef.current?.abort();
    setPhase('idle');
    setInterim('');
    setTranscript('');
    setMatched(null);
  };

  const confirm = () => {
    if (matched) {
      setDrop({ lat: matched.lat, lng: matched.lng, label: matched.label });
    }
    if (rideMatch) setRideType(rideMatch);
    setPhase('idle');
    setTranscript('');
    setMatched(null);
    setRideMatch(null);
  };

  if (phase === 'unsupported') {
    return (
      <span className="voice-unsupported" title={t('voice_unsupported')}>
        🎙 —
      </span>
    );
  }

  if (phase === 'idle') {
    return (
      <button className="voice-btn" onClick={start}>
        🎙 {t('voice_tap')}
      </button>
    );
  }

  return (
    <div className="voice-overlay" onClick={(e) => { if (e.target === e.currentTarget) cancel(); }}>
      <div className="voice-modal">

        {phase === 'listening' && (
          <>
            <div className="voice-ring">
              <span className="voice-ring-icon">🎙</span>
            </div>
            <div className="voice-status">{t('voice_listening')}</div>
            <div className="voice-interim">{interim || '…'}</div>
            <button className="voice-cancel-btn" onClick={cancel}>{t('voice_cancel')}</button>
          </>
        )}

        {phase === 'heard' && (
          <>
            <div className="voice-heard-block">
              <span className="voice-heard-label">{t('voice_heard')}</span>
              <span className="voice-transcript">"{transcript}"</span>
            </div>

            {matched ? (
              <>
                <div className="voice-match-box">
                  <span className="voice-match-pin">📍</span>
                  <div className="voice-match-info">
                    <div className="voice-found-label">{t('voice_found')}</div>
                    <div className="voice-match-name">{matched.label}</div>
                    {matched.city !== city.name && (
                      <div className="voice-match-city">{matched.city}</div>
                    )}
                    {rideMatch && (
                      <div className="voice-ride-tag">🚗 {rideMatch}</div>
                    )}
                  </div>
                </div>
                <div className="voice-actions">
                  <button className="voice-confirm-btn" onClick={confirm}>{t('voice_set_drop')}</button>
                  <button className="voice-retry-btn" onClick={start}>{t('voice_retry')}</button>
                </div>
              </>
            ) : (
              <>
                <div className="voice-no-match">🔍 {t('voice_no_match')}</div>
                <div className="voice-tip">{t('voice_tip')}</div>
                <div className="voice-actions">
                  <button className="voice-retry-btn full" onClick={start}>{t('voice_retry')}</button>
                  <button className="voice-cancel-btn-sm" onClick={cancel}>{t('voice_cancel')}</button>
                </div>
              </>
            )}
          </>
        )}

        {phase === 'error' && (
          <>
            <div className="voice-ring error">
              <span className="voice-ring-icon">⚠️</span>
            </div>
            <div className="voice-status">{t('voice_error')}</div>
            <div className="voice-tip">{t('voice_tip')}</div>
            <div className="voice-actions">
              <button className="voice-retry-btn full" onClick={start}>{t('voice_retry')}</button>
              <button className="voice-cancel-btn-sm" onClick={cancel}>{t('voice_cancel')}</button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
