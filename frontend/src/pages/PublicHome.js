// pages/PublicHome.js
// Landing page pública — diseño profesional y responsive

import React from 'react';
import BookingWizard from '../components/BookingWizard';

const PublicHome = () => {
  return (
    <div style={styles.wrapper}>
      {/* ── NAVBAR ── */}
      <nav style={styles.navbar}>
        <div style={styles.navInner}>
          <span style={styles.brand}>🏨 MiHotel</span>
          <div style={styles.navLinks}>
            <a href="#reservar" style={styles.navLink}>Reservar</a>
            <a href="#servicios" style={styles.navLink}>Servicios</a>
            <a href="#contacto" style={styles.navLink}>Contacto</a>
            <a href="/login" style={styles.navBtn}>Acceso staff</a>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.heroBadge}>⭐ Bienvenido a MiHotel</div>
          <h1 style={styles.heroTitle}>Tu estadía perfecta<br />te espera</h1>
          <p style={styles.heroSubtitle}>
            Habitaciones modernas, servicio personalizado y la mejor ubicación.
            Reservá directamente y obtené el mejor precio garantizado.
          </p>
          <a href="#reservar" style={styles.heroCta}>Reservar ahora →</a>
        </div>
        <div style={styles.heroStats}>
          {[
            { num: '18+', label: 'Habitaciones' },
            { num: '4', label: 'Tipos de alojamiento' },
            { num: '24hs', label: 'Atención permanente' },
          ].map((s) => (
            <div key={s.label} style={styles.statCard}>
              <span style={styles.statNum}>{s.num}</span>
              <span style={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── SERVICIOS ── */}
      <section id="servicios" style={styles.section}>
        <h2 style={styles.sectionTitle}>¿Por qué elegirnos?</h2>
        <div style={styles.servicesGrid}>
          {[
            { icon: '🛏️', title: 'Suites y habitaciones', desc: 'Dobles, triples, cuádruples y suites con todo el confort.' },
            { icon: '🍳', title: 'Desayuno incluido', desc: 'Buffet completo cada mañana sin cargo adicional.' },
            { icon: '🕐', title: 'Check-in 24hs', desc: 'Llegá a cualquier hora. Nuestro equipo te espera.' },
            { icon: '📶', title: 'WiFi de alta velocidad', desc: 'Conexión ilimitada en habitaciones y áreas comunes.' },
            { icon: '🧹', title: 'Limpieza diaria', desc: 'Mucama con cambio de ropa y toallas todos los días.' },
            { icon: '🚗', title: 'Estacionamiento', desc: 'Playa de estacionamiento cubierta y segura disponible.' },
          ].map((s) => (
            <div key={s.title} style={styles.serviceCard}>
              <span style={styles.serviceIcon}>{s.icon}</span>
              <h3 style={styles.serviceTitle}>{s.title}</h3>
              <p style={styles.serviceDesc}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── RESERVA ── */}
      <section id="reservar" style={styles.bookingSection}>
        <h2 style={styles.sectionTitle}>Hacé tu reserva</h2>
        <p style={styles.bookingSubtitle}>
          Completá el formulario y confirmamos tu reserva al instante.
        </p>
        <BookingWizard />
      </section>

      {/* ── FOOTER ── */}
      <footer id="contacto" style={styles.footer}>
        <div style={styles.footerInner}>
          <div>
            <span style={styles.brand}>🏨 MiHotel</span>
            <p style={styles.footerTagline}>Tu hogar lejos de casa</p>
          </div>
          <div style={styles.footerLinks}>
            <a href="mailto:info@mihotel.com" style={styles.footerLink}>📧 info@mihotel.com</a>
            <a href="tel:+5491112345678" style={styles.footerLink}>📞 +54 9 11 1234-5678</a>
            <a href="#cancelacion" style={styles.footerLink}>Política de cancelación</a>
          </div>
        </div>
        <div style={styles.footerBottom}>
          © {new Date().getFullYear()} MiHotel — Todos los derechos reservados
        </div>
      </footer>
    </div>
  );
};

const styles = {
  wrapper: { minHeight: '100vh', background: '#0f1117', color: '#e8eaf0', fontFamily: "'Inter','Segoe UI',Arial,sans-serif", display: 'flex', flexDirection: 'column' },
  navbar: { position: 'sticky', top: 0, zIndex: 100, background: 'rgba(15,17,23,0.93)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  navInner: { maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: 0.5 },
  navLinks: { display: 'flex', alignItems: 'center', gap: 28 },
  navLink: { color: '#94a3b8', textDecoration: 'none', fontSize: 15 },
  navBtn: { background: '#3b82f6', color: '#fff', padding: '8px 18px', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600 },
  hero: { maxWidth: 1100, margin: '0 auto', padding: '80px 24px 64px', display: 'flex', flexDirection: 'column', gap: 48, width: '100%', boxSizing: 'border-box' },
  heroContent: { maxWidth: 640 },
  heroBadge: { display: 'inline-block', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, marginBottom: 20 },
  heroTitle: { fontSize: 'clamp(30px,5vw,52px)', fontWeight: 800, lineHeight: 1.15, margin: '0 0 20px', color: '#fff' },
  heroSubtitle: { fontSize: 17, color: '#94a3b8', lineHeight: 1.7, marginBottom: 32, maxWidth: 520 },
  heroCta: { display: 'inline-block', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', padding: '14px 32px', borderRadius: 10, textDecoration: 'none', fontSize: 16, fontWeight: 700, boxShadow: '0 4px 24px rgba(59,130,246,0.35)' },
  heroStats: { display: 'flex', gap: 20, flexWrap: 'wrap' },
  statCard: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '20px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 110 },
  statNum: { fontSize: 28, fontWeight: 800, color: '#60a5fa' },
  statLabel: { fontSize: 12, color: '#64748b', textAlign: 'center' },
  section: { maxWidth: 1100, margin: '0 auto', padding: '64px 24px', width: '100%', boxSizing: 'border-box' },
  sectionTitle: { fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 8, textAlign: 'center' },
  servicesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20, marginTop: 36 },
  serviceCard: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '24px 20px' },
  serviceIcon: { fontSize: 28, marginBottom: 12, display: 'block' },
  serviceTitle: { fontSize: 16, fontWeight: 600, color: '#e2e8f0', margin: '0 0 8px' },
  serviceDesc: { fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 },
  bookingSection: { background: 'rgba(59,130,246,0.05)', borderTop: '1px solid rgba(59,130,246,0.15)', borderBottom: '1px solid rgba(59,130,246,0.15)', padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  bookingSubtitle: { textAlign: 'center', color: '#94a3b8', marginBottom: 32, fontSize: 16 },
  footer: { marginTop: 'auto', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.06)' },
  footerInner: { maxWidth: 1100, margin: '0 auto', padding: '40px 24px 24px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 32 },
  footerTagline: { color: '#475569', fontSize: 13, margin: '8px 0 0' },
  footerLinks: { display: 'flex', flexDirection: 'column', gap: 10 },
  footerLink: { color: '#64748b', textDecoration: 'none', fontSize: 14 },
  footerBottom: { textAlign: 'center', padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', color: '#334155', fontSize: 13 },
};

export default PublicHome;
