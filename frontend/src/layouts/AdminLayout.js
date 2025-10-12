// layouts/AdminLayout.js
// Layout simplificado para el panel de administrador - sin navbar superior
import React from 'react';

const AdminLayout = ({ children }) => (
  <div style={{ 
    minHeight: '100vh', 
    background: '#0f0f0f', 
    color: '#fff',
    margin: 0,
    padding: 0,
    overflow: 'hidden'
  }}>
    {children}
  </div>
);

export default AdminLayout;
