import React, { useEffect } from 'react';

const SessionExpiredBanner = ({ next, onRedirect }) => {
  useEffect(() => {
    const t = setTimeout(() => {
      if (onRedirect) onRedirect();
    }, 2200);
    return () => clearTimeout(t);
  }, [onRedirect]);

  return (
    <div style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#ef4444', color: '#fff', padding: '12px 20px', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>
      <strong>Sesión expirada</strong>
      <div style={{ fontSize: 13, marginTop: 6 }}>Te redirigiremos al login en breve para reingresar.</div>
    </div>
  );
};

export default SessionExpiredBanner;
