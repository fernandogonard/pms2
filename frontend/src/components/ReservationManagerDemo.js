import React, { useState } from 'react';

const ReservationManagerDemo = () => {
  const [viewMode, setViewMode] = useState('compact');
  const [expandedFilters, setExpandedFilters] = useState(false);
  const [expandedStats, setExpandedStats] = useState(true);

  // Datos de demostración
  const mockReservations = [
    {
      _id: '1',
      checkIn: '2025-10-07',
      checkOut: '2025-10-10',
      client: { nombre: 'Juan', apellido: 'Pérez', email: 'juan@email.com' },
      tipo: 'doble',
      cantidad: 1,
      room: [{ number: '102' }],
      status: 'reservada',
      totalAmount: 150,
      duration: 3
    },
    {
      _id: '2',
      checkIn: '2025-10-08',
      checkOut: '2025-10-12',
      client: { nombre: 'María', apellido: 'García', email: 'maria@email.com' },
      tipo: 'triple',
      cantidad: 1,
      room: [{ number: '103' }],
      status: 'checkin',
      totalAmount: 288,
      duration: 4
    },
    {
      _id: '3',
      checkIn: '2025-10-10',
      checkOut: '2025-10-14',
      client: { nombre: 'Carlos', apellido: 'López', email: 'carlos@email.com' },
      tipo: 'doble',
      cantidad: 2,
      room: [{ number: '104' }, { number: '105' }],
      status: 'reservada',
      totalAmount: 400,
      duration: 4
    },
    {
      _id: '4',
      checkIn: '2025-10-11',
      checkOut: '2025-10-13',
      client: { nombre: 'Ana', apellido: 'Martín', email: 'ana@email.com' },
      tipo: 'cuadruple',
      cantidad: 1,
      room: [],
      status: 'reservada',
      totalAmount: 170,
      duration: 2
    },
    {
      _id: '5',
      checkIn: '2025-10-09',
      checkOut: '2025-10-11',
      client: { nombre: 'Roberto', apellido: 'Silva', email: 'roberto@email.com' },
      tipo: 'doble',
      cantidad: 1,
      room: [{ number: '106' }],
      status: 'checkout',
      totalAmount: 100,
      duration: 2
    }
  ];

  const mockStats = {
    general: {
      totalReservations: 125,
      checkin: 8,
      reservadas: 15,
      ocupadasHoy: 12
    }
  };

  // Componente de reserva en vista compacta
  const CompactReservationCard = ({ reservation, index }) => (
    <div className={`card mb-2 ${index % 2 === 0 ? 'bg-light' : ''}`} style={{ fontSize: '0.9rem' }}>
      <div className="card-body p-3">
        <div className="row align-items-center">
          <div className="col-md-2">
            <div className="d-flex flex-column">
              <span className="fw-bold text-primary">
                {new Date(reservation.checkIn).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
              </span>
              <small className="text-muted">
                {reservation.duration}d
              </small>
            </div>
          </div>
          
          <div className="col-md-3">
            <div className="d-flex flex-column">
              <span className="fw-bold">
                {reservation.client?.nombre} {reservation.client?.apellido}
              </span>
              <small className="text-muted text-truncate" style={{ maxWidth: '150px' }}>
                {reservation.client?.email}
              </small>
            </div>
          </div>

          <div className="col-md-2">
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-info text-capitalize">{reservation.tipo}</span>
              <small className="text-muted">{reservation.cantidad}</small>
            </div>
          </div>

          <div className="col-md-2">
            {reservation.room && reservation.room.length > 0 ? (
              <div className="d-flex flex-wrap gap-1">
                {reservation.room.slice(0, 2).map((r, idx) => (
                  <span key={idx} className="badge bg-secondary" style={{ fontSize: '0.7rem' }}>
                    #{r.number}
                  </span>
                ))}
                {reservation.room.length > 2 && (
                  <span className="badge bg-secondary" style={{ fontSize: '0.7rem' }}>
                    +{reservation.room.length - 2}
                  </span>
                )}
              </div>
            ) : (
              <span className="badge bg-warning" style={{ fontSize: '0.7rem' }}>Virtual</span>
            )}
          </div>

          <div className="col-md-2">
            <span className={`badge status-${reservation.status}`} style={{ fontSize: '0.7rem' }}>
              {reservation.status}
            </span>
          </div>

          <div className="col-md-1">
            <div className="dropdown">
              <button 
                className="btn btn-outline-secondary btn-sm dropdown-toggle" 
                type="button" 
                data-bs-toggle="dropdown"
                style={{ fontSize: '0.8rem' }}
              >
                <i className="fas fa-ellipsis-v"></i>
              </button>
              <ul className="dropdown-menu">
                <li><a className="dropdown-item" href="#"><i className="fas fa-eye"></i> Ver</a></li>
                <li><a className="dropdown-item" href="#"><i className="fas fa-edit"></i> Editar</a></li>
                <li><a className="dropdown-item" href="#"><i className="fas fa-sign-in-alt"></i> Check-in</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Componente de tabla compacta
  const ScrollableTable = () => (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center py-2">
        <h6 className="mb-0">
          <i className="fas fa-list"></i> Reservas 
          <span className="badge bg-primary ms-2">{mockReservations.length}</span>
        </h6>
      </div>
      
      <div className="table-responsive" style={{ maxHeight: '60vh', fontSize: '0.85rem' }}>
        <table className="table table-hover table-sm mb-0">
          <thead className="table-dark sticky-top">
            <tr>
              <th style={{ minWidth: '80px' }}>Fecha</th>
              <th style={{ minWidth: '120px' }}>Cliente</th>
              <th style={{ minWidth: '60px' }}>Tipo</th>
              <th style={{ minWidth: '80px' }}>Hab.</th>
              <th style={{ minWidth: '70px' }}>Estado</th>
              <th style={{ minWidth: '60px' }}>Total</th>
              <th style={{ minWidth: '60px' }}></th>
            </tr>
          </thead>
          <tbody>
            {mockReservations.map((reservation, index) => (
              <tr key={reservation._id} className={index % 2 === 0 ? 'table-light' : ''}>
                <td>
                  <div style={{ fontSize: '0.8rem' }}>
                    <div className="fw-bold text-primary">
                      {new Date(reservation.checkIn).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                    </div>
                    <small className="text-muted">{reservation.duration}d</small>
                  </div>
                </td>
                <td>
                  <div style={{ maxWidth: '120px' }}>
                    <div className="fw-bold text-truncate">
                      {reservation.client?.nombre} {reservation.client?.apellido}
                    </div>
                    <small className="text-muted text-truncate d-block">
                      {reservation.client?.email}
                    </small>
                  </div>
                </td>
                <td>
                  <span className="badge bg-info" style={{ fontSize: '0.7rem' }}>
                    {reservation.tipo}
                  </span>
                </td>
                <td>
                  {reservation.room && reservation.room.length > 0 ? (
                    <div className="d-flex flex-wrap gap-1">
                      {reservation.room.slice(0, 1).map((r, idx) => (
                        <span key={idx} className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>
                          #{r.number}
                        </span>
                      ))}
                      {reservation.room.length > 1 && (
                        <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>
                          +{reservation.room.length - 1}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="badge bg-warning" style={{ fontSize: '0.65rem' }}>Virtual</span>
                  )}
                </td>
                <td>
                  <span className={`badge status-${reservation.status}`} style={{ fontSize: '0.65rem' }}>
                    {reservation.status}
                  </span>
                </td>
                <td>
                  <small className="text-success fw-bold">
                    ${reservation.totalAmount}
                  </small>
                </td>
                <td>
                  <button className="btn btn-outline-primary btn-sm" style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}>
                    <i className="fas fa-eye"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="container-fluid" style={{ fontSize: '0.9rem' }}>
      {/* ENCABEZADO COMPACTO */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">
          <i className="fas fa-calendar-alt text-primary"></i> Gestión de Reservas Optimizada
        </h4>
        <div className="d-flex gap-2">
          {/* Selector de vista */}
          <div className="btn-group btn-group-sm" role="group">
            <input 
              type="radio" 
              className="btn-check" 
              name="viewMode" 
              id="compact" 
              checked={viewMode === 'compact'}
              onChange={() => setViewMode('compact')}
            />
            <label className="btn btn-outline-primary" htmlFor="compact">
              <i className="fas fa-list"></i> Compacto
            </label>

            <input 
              type="radio" 
              className="btn-check" 
              name="viewMode" 
              id="table" 
              checked={viewMode === 'table'}
              onChange={() => setViewMode('table')}
            />
            <label className="btn btn-outline-primary" htmlFor="table">
              <i className="fas fa-table"></i> Tabla
            </label>

            <input 
              type="radio" 
              className="btn-check" 
              name="viewMode" 
              id="cards" 
              checked={viewMode === 'cards'}
              onChange={() => setViewMode('cards')}
            />
            <label className="btn btn-outline-primary" htmlFor="cards">
              <i className="fas fa-th-large"></i> Tarjetas
            </label>
          </div>

          <button className="btn btn-success btn-sm">
            <i className="fas fa-plus"></i> Nueva
          </button>
        </div>
      </div>

      {/* ESTADÍSTICAS ACORDEÓN */}
      <div className="card mb-3">
        <div className="card-header py-2">
          <button 
            className="btn btn-link p-0 text-decoration-none w-100 text-start d-flex justify-content-between align-items-center"
            onClick={() => setExpandedStats(!expandedStats)}
          >
            <h6 className="mb-0">
              <i className="fas fa-chart-bar text-info"></i> Estadísticas Rápidas
            </h6>
            <i className={`fas fa-chevron-${expandedStats ? 'up' : 'down'}`}></i>
          </button>
        </div>
        {expandedStats && (
          <div className="card-body py-3">
            <div className="row">
              <div className="col-3">
                <div className="text-center">
                  <h5 className="text-primary mb-0">{mockStats.general.totalReservations}</h5>
                  <small className="text-muted">Total Reservas</small>
                </div>
              </div>
              <div className="col-3">
                <div className="text-center">
                  <h5 className="text-success mb-0">{mockStats.general.checkin}</h5>
                  <small className="text-muted">Check-in Activo</small>
                </div>
              </div>
              <div className="col-3">
                <div className="text-center">
                  <h5 className="text-info mb-0">{mockStats.general.reservadas}</h5>
                  <small className="text-muted">Reservadas</small>
                </div>
              </div>
              <div className="col-3">
                <div className="text-center">
                  <h5 className="text-warning mb-0">{mockStats.general.ocupadasHoy}</h5>
                  <small className="text-muted">Ocupadas Hoy</small>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FILTROS ACORDEÓN */}
      <div className="card mb-3">
        <div className="card-header py-2">
          <button 
            className="btn btn-link p-0 text-decoration-none w-100 text-start d-flex justify-content-between align-items-center"
            onClick={() => setExpandedFilters(!expandedFilters)}
          >
            <h6 className="mb-0">
              <i className="fas fa-filter text-secondary"></i> Filtros Avanzados
            </h6>
            <i className={`fas fa-chevron-${expandedFilters ? 'up' : 'down'}`}></i>
          </button>
        </div>
        {expandedFilters && (
          <div className="card-body py-2" style={{ fontSize: '0.85rem' }}>
            <div className="row g-2">
              <div className="col-md-3">
                <label className="form-label small">Rango de Fechas</label>
                <div className="d-flex gap-1">
                  <input type="date" className="form-control form-control-sm" defaultValue="2025-10-06" />
                  <input type="date" className="form-control form-control-sm" defaultValue="2025-10-20" />
                </div>
              </div>
              
              <div className="col-md-2">
                <label className="form-label small">Estado</label>
                <select className="form-select form-select-sm">
                  <option value="">Todos</option>
                  <option value="reservada">Reservada</option>
                  <option value="checkin">Check-in</option>
                  <option value="checkout">Check-out</option>
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label small">Tipo Habitación</label>
                <select className="form-select form-select-sm">
                  <option value="">Todos</option>
                  <option value="doble">Doble</option>
                  <option value="triple">Triple</option>
                  <option value="cuadruple">Cuádruple</option>
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label small">Cliente</label>
                <input type="text" className="form-control form-control-sm" placeholder="Buscar cliente..." />
              </div>

              <div className="col-md-2">
                <label className="form-label small">Habitación</label>
                <input type="text" className="form-control form-control-sm" placeholder="Nº habitación..." />
              </div>

              <div className="col-md-1">
                <label className="form-label small">&nbsp;</label>
                <button className="btn btn-outline-secondary btn-sm d-block w-100" title="Limpiar filtros">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CONTENIDO PRINCIPAL CON SCROLL */}
      <div className="mb-3">
        {viewMode === 'compact' && (
          <div className="compact-scroll">
            {mockReservations.map((reservation, index) => (
              <CompactReservationCard 
                key={reservation._id} 
                reservation={reservation}
                index={index}
              />
            ))}
            {/* Simular más reservas para mostrar el scroll */}
            {Array.from({ length: 10 }, (_, i) => (
              <CompactReservationCard 
                key={`extra-${i}`} 
                reservation={{
                  ...mockReservations[i % mockReservations.length],
                  _id: `extra-${i}`,
                  checkIn: `2025-10-${15 + i}`,
                  client: { 
                    nombre: `Cliente ${i + 6}`, 
                    apellido: `Apellido ${i + 6}`,
                    email: `cliente${i + 6}@email.com`
                  }
                }}
                index={i + 5}
              />
            ))}
          </div>
        )}

        {viewMode === 'table' && <ScrollableTable />}

        {viewMode === 'cards' && (
          <div className="row compact-scroll">
            {mockReservations.map((reservation, index) => (
              <div key={reservation._id} className="col-md-6 col-lg-4 mb-3">
                <div className="card h-100" style={{ fontSize: '0.85rem' }}>
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <h6 className="card-title mb-0">
                        {reservation.client?.nombre} {reservation.client?.apellido}
                      </h6>
                      <span className={`badge status-${reservation.status}`} style={{ fontSize: '0.7rem' }}>
                        {reservation.status}
                      </span>
                    </div>
                    <div className="row g-2">
                      <div className="col-6">
                        <small className="text-muted">Check-in:</small>
                        <div className="fw-bold">
                          {new Date(reservation.checkIn).toLocaleDateString('es-ES')}
                        </div>
                      </div>
                      <div className="col-6">
                        <small className="text-muted">Tipo:</small>
                        <div>
                          <span className="badge bg-info">{reservation.tipo}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <small className="text-muted">Habitaciones:</small>
                      <div>
                        {reservation.room && reservation.room.length > 0 ? (
                          reservation.room.map((r, idx) => (
                            <span key={idx} className="badge bg-secondary me-1">#{r.number}</span>
                          ))
                        ) : (
                          <span className="badge bg-warning">Virtual</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      <small className="text-muted">Total:</small>
                      <div className="fw-bold text-success">${reservation.totalAmount}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PAGINACIÓN COMPACTA */}
      <div className="d-flex justify-content-between align-items-center">
        <small className="text-muted">
          1 - {mockReservations.length} de {mockReservations.length + 100} reservas
        </small>
        
        <nav>
          <ul className="pagination pagination-sm mb-0">
            <li className="page-item">
              <button className="page-link">
                <i className="fas fa-angle-left"></i>
              </button>
            </li>
            
            <li className="page-item active">
              <span className="page-link">1 / 8</span>
            </li>
            
            <li className="page-item">
              <button className="page-link">
                <i className="fas fa-angle-right"></i>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
};

export default ReservationManagerDemo;