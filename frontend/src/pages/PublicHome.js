// pages/PublicHome.js
// Página pública para clientes: listado de habitaciones y formulario de reserva

import BookingWizard from '../components/BookingWizard';

const PublicHome = () => {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#18191A',
      color: '#fff',
      fontFamily: 'Inter, Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 0,
    }}>
      <header style={{
        width: '100%',
        maxWidth: '1100px',
        margin: '32px auto 0',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
      }}>
        <span style={{ fontWeight: 600, fontSize: 22, letterSpacing: 1 }}>🏨 MiHotel</span>
      </header>
      <h1 style={{ fontSize: 32, fontWeight: 600, margin: '32px 0 24px' }}>Reserva tu habitación</h1>
      <BookingWizard />
      <footer style={{
        width: '100%',
        maxWidth: '1100px',
        margin: 'auto',
        display: 'flex',
        justifyContent: 'center',
        gap: '48px',
        padding: '24px 0 32px',
        borderTop: '1px solid #222',
        fontSize: 16,
        color: '#bbb',
      }}>
        <a href="#contacto" style={{ color: '#bbb', textDecoration: 'none' }}>Contacto</a>
        <a href="#redes" style={{ color: '#bbb', textDecoration: 'none' }}>Redes sociales</a>
        <a href="#cancelacion" style={{ color: '#bbb', textDecoration: 'none' }}>Políticas de cancelación</a>
      </footer>
    </div>
  );
};

export default PublicHome;
