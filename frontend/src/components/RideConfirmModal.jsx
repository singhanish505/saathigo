import React from 'react';

export default function RideConfirmModal({ matched, onClose }) {
  const ride = matched.ride;
  const driver = matched.driver;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>🎉 Ride Confirmed!</h2>
        <p style={{ color: '#6B7280', fontSize: 14 }}>
          Your {ride.rideType === 'EV' ? 'Hara EV' : ride.rideType === 'SAKHI' ? 'Sakhi ride' : 'cab'} is on the way
        </p>
        <div className="summary">
          <div><span>Driver</span><strong>{driver.name} ({driver.rating} ⭐)</strong></div>
          <div><span>Vehicle</span><strong>{driver.vehicle.model} · {driver.vehicle.plate}</strong></div>
          <div><span>ETA</span><strong>{ride.etaMin} minutes</strong></div>
          <div><span>Fare (locked)</span><strong>{ride.fare.farePretty}</strong></div>
          <div><span>To driver-owner (92%)</span><strong>₹ {ride.fare.driverShareRupees.toLocaleString('en-IN')}</strong></div>
          {ride.fare.co2SavedGrams > 0 && (
            <div><span>CO₂ saved</span><strong>{(ride.fare.co2SavedGrams / 1000).toFixed(2)} kg 🌿</strong></div>
          )}
          {matched.freeRideEarned && (
            <div style={{ background: '#FEF3C7', padding: 8, borderRadius: 8, marginTop: 4 }}>
              <strong style={{ color: '#92400E' }}>🎊 Khushi streak hit 10! Next ride is FREE.</strong>
            </div>
          )}
        </div>
        <button className="btn" onClick={onClose}>Track on map</button>
      </div>
    </div>
  );
}
