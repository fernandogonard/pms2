// layouts/ReceptionLayout.js
// Layout profesional para el panel de recepcionista
import React from 'react';

const ReceptionLayout = ({ children }) => (
  <div style={{ minHeight: '100vh', background: '#18191A', color: '#fff' }}>
    <main>{children}</main>
  </div>
);

export default ReceptionLayout;
