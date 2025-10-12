// layouts/ReceptionLayout.js
// Layout profesional para el panel de recepcionista
import React from 'react';
import Navbar from '../components/Navbar';

const ReceptionLayout = ({ children }) => (
  <div style={{ minHeight: '100vh', background: '#18191A', color: '#fff' }}>
    <Navbar />
    <main style={{ padding: '2rem', paddingTop: '1rem' }}>{children}</main>
  </div>
);

export default ReceptionLayout;
