// frontend/src/components/AccessibilityFeatures.js
// Componente para mejorar accesibilidad del CRM

import React, { useState, useEffect } from 'react';
import './AccessibilityFeatures.css';

const AccessibilityFeatures = () => {
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState('normal');
  const [focusVisible, setFocusVisible] = useState(true);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    // Cargar preferencias de accesibilidad
    const savedPreferences = localStorage.getItem('accessibility-preferences');
    if (savedPreferences) {
      const preferences = JSON.parse(savedPreferences);
      setHighContrast(preferences.highContrast || false);
      setFontSize(preferences.fontSize || 'normal');
      setFocusVisible(preferences.focusVisible !== false);
    }

    // Detectar preferencias del sistema
    if (window.matchMedia('(prefers-contrast: high)').matches) {
      setHighContrast(true);
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.classList.add('reduce-motion');
    }
  }, []);

  useEffect(() => {
    // Aplicar cambios de accesibilidad
    document.documentElement.classList.toggle('high-contrast', highContrast);
    document.documentElement.classList.toggle('large-text', fontSize === 'large');
    document.documentElement.classList.toggle('extra-large-text', fontSize === 'extra-large');
    document.documentElement.classList.toggle('focus-visible', focusVisible);

    // Guardar preferencias
    const preferences = {
      highContrast,
      fontSize,
      focusVisible
    };
    localStorage.setItem('accessibility-preferences', JSON.stringify(preferences));
  }, [highContrast, fontSize, focusVisible]);

  const announce = (message, priority = 'polite') => {
    const announcement = {
      id: Date.now(),
      message,
      priority,
      timestamp: new Date()
    };
    
    setAnnouncements(prev => [...prev, announcement]);

    // Limpiar anuncios después de 5 segundos
    setTimeout(() => {
      setAnnouncements(prev => prev.filter(a => a.id !== announcement.id));
    }, 5000);
  };

  const skipToContent = (e) => {
    e.preventDefault();
    const content = document.querySelector('#main-content');
    if (content) {
      content.focus();
      content.scrollIntoView();
    }
  };

  const skipToNav = (e) => {
    e.preventDefault();
    const nav = document.querySelector('#main-navigation');
    if (nav) {
      nav.focus();
      nav.scrollIntoView();
    }
  };

  return (
    <>
      {/* Skip Links */}
      <div className="skip-links">
        <a href="#main-content" onClick={skipToContent} className="skip-link">
          Saltar al contenido principal
        </a>
        <a href="#main-navigation" onClick={skipToNav} className="skip-link">
          Saltar a la navegación
        </a>
      </div>

      {/* Panel de Accesibilidad */}
      <div className="accessibility-panel" role="region" aria-label="Panel de accesibilidad">
        <button
          className="accessibility-toggle"
          onClick={() => document.querySelector('.accessibility-controls').classList.toggle('visible')}
          aria-expanded="false"
          aria-controls="accessibility-controls"
          title="Abrir opciones de accesibilidad"
        >
          <span className="sr-only">Opciones de accesibilidad</span>
          ♿
        </button>

        <div id="accessibility-controls" className="accessibility-controls">
          <h3>Opciones de Accesibilidad</h3>
          
          <div className="accessibility-option">
            <label>
              <input
                type="checkbox"
                checked={highContrast}
                onChange={(e) => {
                  setHighContrast(e.target.checked);
                  announce(e.target.checked ? 'Alto contraste activado' : 'Alto contraste desactivado');
                }}
              />
              Alto contraste
            </label>
          </div>

          <div className="accessibility-option">
            <label htmlFor="font-size-select">Tamaño de fuente:</label>
            <select
              id="font-size-select"
              value={fontSize}
              onChange={(e) => {
                setFontSize(e.target.value);
                announce(`Tamaño de fuente cambiado a ${e.target.value}`);
              }}
            >
              <option value="normal">Normal</option>
              <option value="large">Grande</option>
              <option value="extra-large">Extra grande</option>
            </select>
          </div>

          <div className="accessibility-option">
            <label>
              <input
                type="checkbox"
                checked={focusVisible}
                onChange={(e) => {
                  setFocusVisible(e.target.checked);
                  announce(e.target.checked ? 'Indicadores de foco activados' : 'Indicadores de foco desactivados');
                }}
              />
              Mostrar indicadores de foco
            </label>
          </div>

          <div className="accessibility-option">
            <button
              onClick={() => {
                // Reset todas las preferencias
                setHighContrast(false);
                setFontSize('normal');
                setFocusVisible(true);
                localStorage.removeItem('accessibility-preferences');
                announce('Preferencias de accesibilidad restablecidas');
              }}
              className="reset-btn"
            >
              Restablecer preferencias
            </button>
          </div>
        </div>
      </div>

      {/* Live Region para anuncios */}
      <div className="sr-only">
        {announcements.map(announcement => (
          <div
            key={announcement.id}
            role="status"
            aria-live={announcement.priority}
            aria-atomic="true"
          >
            {announcement.message}
          </div>
        ))}
      </div>

      {/* Landmark roles adicionales */}
      <div className="landmarks-helper sr-only">
        <nav role="navigation" aria-label="Navegación principal">
          <ul>
            <li><a href="#dashboard">Dashboard</a></li>
            <li><a href="#reservations">Reservas</a></li>
            <li><a href="#rooms">Habitaciones</a></li>
            <li><a href="#clients">Clientes</a></li>
            <li><a href="#reports">Reportes</a></li>
          </ul>
        </nav>
      </div>
    </>
  );
};

// Hook personalizado para anuncios
export const useAnnouncements = () => {
  const announce = (message, priority = 'polite') => {
    // Crear elemento temporal para anuncios
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    liveRegion.textContent = message;
    
    document.body.appendChild(liveRegion);
    
    setTimeout(() => {
      document.body.removeChild(liveRegion);
    }, 1000);
  };

  return { announce };
};

// Hook para gestión de foco
export const useFocusManagement = () => {
  const trapFocus = (element) => {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    element.addEventListener('keydown', handleTabKey);
    
    return () => {
      element.removeEventListener('keydown', handleTabKey);
    };
  };

  const restoreFocus = (previousFocus) => {
    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
    }
  };

  return { trapFocus, restoreFocus };
};

// Componente de breadcrumbs accesible
export const AccessibleBreadcrumbs = ({ items }) => (
  <nav aria-label="Navegación de rutas" role="navigation">
    <ol className="breadcrumbs">
      {items.map((item, index) => (
        <li key={index} className={index === items.length - 1 ? 'current' : ''}>
          {index === items.length - 1 ? (
            <span aria-current="page">{item.label}</span>
          ) : (
            <a href={item.href}>{item.label}</a>
          )}
        </li>
      ))}
    </ol>
  </nav>
);

// Componente de tabla accesible
export const AccessibleTable = ({ headers, data, caption, sortable = false }) => {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  const handleSort = (columnIndex) => {
    if (!sortable) return;

    if (sortColumn === columnIndex) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnIndex);
      setSortDirection('asc');
    }
  };

  return (
    <table role="table" aria-label={caption}>
      {caption && <caption>{caption}</caption>}
      <thead>
        <tr role="row">
          {headers.map((header, index) => (
            <th
              key={index}
              role="columnheader"
              scope="col"
              tabIndex={sortable ? 0 : -1}
              onClick={() => handleSort(index)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSort(index);
                }
              }}
              aria-sort={
                sortColumn === index
                  ? sortDirection === 'asc' ? 'ascending' : 'descending'
                  : 'none'
              }
              className={sortable ? 'sortable' : ''}
            >
              {header}
              {sortable && sortColumn === index && (
                <span className="sort-indicator" aria-hidden="true">
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={rowIndex} role="row">
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} role="gridcell">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default AccessibilityFeatures;