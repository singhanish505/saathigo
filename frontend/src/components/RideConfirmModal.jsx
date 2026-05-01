import React from 'react';
import { useLang } from '../LangContext.jsx';

export default function RideConfirmModal({ matched, onClose }) {
  const { t } = useLang();
  const ride = matched.ride;
  const driver = matched.driver;
  const onwayKey = ride.rideType === 'EV' ? 'ride_onway_ev' : ride.rideType === 'SAKHI' ? 'ride_onway_sakhi' : 'ride_onway';
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('ride_confirmed')}</h2>
        <p style={{ color: '#6B7280', fontSize: 14 }}>{t(onwayKey)}</p>
        <div className="summary">
          <div><span>{t('driver_label')}</span><strong>{driver.name} ({driver.rating} ⭐)</strong></div>
          <div><span>{t('vehicle_label')}</span><strong>{driver.vehicle.model} · {driver.vehicle.plate}</strong></div>
          <div><span>{t('eta_label')}</span><strong>{ride.etaMin} {t('minutes')}</strong></div>
          <div><span>{t('fare_label')}</span><strong>{ride.fare.farePretty}</strong></div>
          <div><span>{t('driver_share_label')}</span><strong>₹ {ride.fare.driverShareRupees.toLocaleString('en-IN')}</strong></div>
          {ride.fare.co2SavedGrams > 0 && (
            <div><span>{t('co2_saved_label')}</span><strong>{(ride.fare.co2SavedGrams / 1000).toFixed(2)} kg 🌿</strong></div>
          )}
          {matched.freeRideEarned && (
            <div style={{ background: '#FEF3C7', padding: 8, borderRadius: 8, marginTop: 4 }}>
              <strong style={{ color: '#92400E' }}>🎊 {t('free_ride_banner')}</strong>
            </div>
          )}
        </div>
        <button className="btn" onClick={onClose}>{t('track_map')}</button>
      </div>
    </div>
  );
}
