// components/ReportDownload.js
// Descarga de reportes avanzados (ocupación) para admin
import React, { useState } from 'react';
import { apiFetch } from '../utils/api';

const API_REPORT_OCCUPANCY = '/api/reports/occupancy';

const ReportDownload = () => {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDownload = async e => {
    e.preventDefault();
    setError('');
    if (!start || !end) {
      setError('Debes seleccionar ambas fechas.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`${API_REPORT_OCCUPANCY}?start=${start}&end=${end}`);
      if (!res.ok) {
        setError('No se pudo descargar el reporte.');
        setLoading(false);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_ocupacion_${start}_a_${end}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#222', borderRadius: 16, boxShadow: '0 2px 12px #0002', padding: 24, marginBottom: 32 }}>
      <h2>Descargar reporte de ocupación</h2>
      <form onSubmit={handleDownload} style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ color: '#fff' }}>
          Desde:
          <input type="date" value={start} onChange={e => setStart(e.target.value)} style={{ marginLeft: 8, background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }} required />
        </label>
        <label style={{ color: '#fff' }}>
          Hasta:
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={{ marginLeft: 8, background: '#18191A', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: 8 }} required />
        </label>
        <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: 6, fontWeight: 500, fontSize: 16 }} disabled={loading}>
          {loading ? 'Descargando...' : 'Descargar Excel'}
        </button>
      </form>
      {error && <div style={{ color: '#ef4444', fontWeight: 500 }}>{error}</div>}
    </div>
  );
};

export default ReportDownload;
