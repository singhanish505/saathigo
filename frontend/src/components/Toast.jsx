import React from 'react';

export default function Toast({ toast }) {
  return (
    <div className={`toast ${toast ? 'show' : ''}`}>
      {toast?.message}
    </div>
  );
}
