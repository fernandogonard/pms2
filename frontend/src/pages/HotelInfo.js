// src/pages/HotelInfo.js
// Página informativa principal del Hotel Diva
import React from 'react';

const HotelInfo = () => (
  <div style={{ maxWidth: 900, margin: '2rem auto', padding: 24, background: '#fff', borderRadius: 8 }}>
    <h1 style={{ color: '#00f', marginBottom: 24 }}>Hotel Diva - Mar del Plata</h1>
    <p style={{ fontSize: 18, marginBottom: 16 }}>
      El Hotel Diva es un alojamiento 2 estrellas situado en el centro de Mar del Plata, en Garay 1630. A sólo unas cuadras del Paseo Aldrey y a 11 minutos a pie de la Playa Bristol.
    </p>
    <ul style={{ marginBottom: 24 }}>
      <li><b>Habitaciones:</b> 38 habitaciones dobles (matrimoniales o twin), todas para no fumadores, con escritorio, TV, caja fuerte, calefacción, baño privado y amenities básicos.</li>
      <li><b>Servicios:</b> Wi-Fi gratuito, desayuno buffet incluido, recepción 24 horas, sala de juegos, centro de negocios, bar y salón común.</li>
      <li><b>Ubicación:</b> Zona céntrica, cerca de comercios y playa. No dispone de estacionamiento propio.</li>
      <li><b>Políticas:</b> No se admiten mascotas. Cunas/camas infantiles bajo pedido.</li>
    </ul>
    <h2 style={{ color: '#00f', marginBottom: 16 }}>Características y Comodidades</h2>
    <ul>
      <li>Wi-Fi gratis en todo el hotel</li>
      <li>Desayuno continental incluido</li>
      <li>Recepción y atención 24 horas</li>
      <li>Sala de juegos para niños y adultos</li>
      <li>Centro de negocios y salón de eventos</li>
      <li>Bar y área de estar/comedor compartido</li>
      <li>Ascensor, caja de seguridad, servicio a la habitación</li>
      <li>Habitaciones con calefacción y suelo alfombrado</li>
      <li>Baño privado completo con bidet y secador de pelo</li>
    </ul>
    <h2 style={{ color: '#00f', marginTop: 32 }}>¿Por qué elegir Hotel Diva?</h2>
    <p style={{ fontSize: 16 }}>
      El Hotel Diva es ideal para quienes buscan comodidad básica, atención personalizada y excelente ubicación a precio accesible. Perfecto para viajeros, familias y negocios.
    </p>
    <div style={{ marginTop: 32, color: '#888', fontSize: 14 }}>
      <b>Dirección:</b> Garay 1630, Mar del Plata, Argentina<br />
      <b>Teléfono:</b> (Ejemplo) +54 223 123-4567<br />
      <b>Email:</b> info@hoteldiva.com.ar
    </div>
  </div>
);

export default HotelInfo;
