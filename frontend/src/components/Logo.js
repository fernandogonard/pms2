import React from 'react';
import logo from '../assets/images/logo.png';

/**
 * Componente Logo para Hotel DIVA
 * @param {Object} props - Propiedades del componente
 * @param {number} props.width - Ancho del logo (default: 40)
 * @param {number} props.height - Alto del logo (default: 40)
 * @param {boolean} props.showText - Mostrar texto "Hotel DIVA" junto al logo (default: true)
 * @param {string} props.className - Clases CSS adicionales
 */
const Logo = ({ width = 40, height = 40, showText = true, className = '' }) => {
  return (
    <div className={\d-flex align-items-center \\}>
      <img 
        src={logo} 
        alt="Hotel DIVA" 
        width={width} 
        height={height} 
        className="me-2" 
      />
      {showText && <span className="fw-bold">Hotel DIVA</span>}
    </div>
  );
};

export default Logo;
