import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../utils/api';

const CompactReservationManager = () => {
  // Estados principales
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  // Estados de UI
  const [viewMode, setViewMode] = useState('compact'); // 'compact', 'table', 'cards'
  const [expandedFilters, setExpandedFilters] = useState(false);
  const [expandedStats, setExpandedStats] = useState(true);

  // Estados de paginación
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 15, // Reducido para vista compacta
    hasNextPage: false,
    hasPrevPage: false
  });

  // Estados de filtros
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    tipo: '',
    clientSearch: '',
    roomNumber: '',
    sortBy: 'checkIn',
    sortOrder: 'desc'
  });

  // Obtener reservas optimizadas
  const fetchReservations = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.itemsPerPage.toString(),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      });

      Object.entries(filters).forEach(([key, value]) => {
        if (value && key !== 'sortBy' && key !== 'sortOrder') {
          params.append(key, value);
        }
      });

      const response = await api.get(`/api/reservations/optimized?${params}`);
      
      if (response.data.success) {
        setReservations(response.data.data.reservations);
        setPagination(response.data.data.pagination);
      } else {
        setError('Error al cargar las reservas');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.itemsPerPage]);

  // Obtener estadísticas
  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await api.get(`/api/reservations/stats?${params}`);
      
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, [filters.startDate, filters.endDate]);

  useEffect(() => {
    fetchReservations(1);
    fetchStats();
  }, [fetchReservations, fetchStats]);

  // Handlers
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handlePageChange = (newPage) => {
    fetchReservations(newPage);
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      status: '',
      tipo: '',
      clientSearch: '',
      roomNumber: '',
      sortBy: 'checkIn',
      sortOrder: 'desc'
    });
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
                {Math.ceil(reservation.duration || 0)}d
              </small>
            </div>
          </div>
          
          <div className="col-md-3">
            <div className="d-flex flex-column">
              <span className="fw-bold">
                {reservation.client?.nombre} {reservation.client?.apellido}
              </span>
              <small className="text-muted text-truncate" style={{ maxWidth: '150px' }}>
                {reservation.client?.email || reservation.email || 'Sin email'}
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

  // Componente de tabla compacta con scroll
  const ScrollableTable = () => (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center py-2">
        <h6 className="mb-0">
          <i className="fas fa-list"></i> Reservas 
          <span className="badge bg-primary ms-2">{pagination.totalItems}</span>
        </h6>
        <div className="d-flex gap-2 align-items-center">
          <select
            className="form-select form-select-sm"
            style={{ width: '80px', fontSize: '0.8rem' }}
            value={pagination.itemsPerPage}
            onChange={(e) => setPagination(prev => ({ ...prev, itemsPerPage: Number(e.target.value) }))}
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
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
            {reservations.map((reservation, index) => (
              <tr key={reservation._id} className={index % 2 === 0 ? 'table-light' : ''}>
                <td>
                  <div style={{ fontSize: '0.8rem' }}>
                    <div className="fw-bold text-primary">
                      {new Date(reservation.checkIn).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                    </div>
                    <small className="text-muted">{Math.ceil(reservation.duration || 0)}d</small>
                  </div>
                </td>
                <td>
                  <div style={{ maxWidth: '120px' }}>
                    <div className="fw-bold text-truncate">
                      {reservation.client?.nombre} {reservation.client?.apellido}
                    </div>
                    <small className="text-muted text-truncate d-block">
                      {reservation.client?.email || reservation.email || 'Sin email'}
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
                    ${(reservation.totalAmount || 0).toFixed(0)}
                  </small>
                </td>
                <td>
                  <div className="btn-group btn-group-sm">
                    <button className="btn btn-outline-primary btn-sm" style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}>
                      <i className="fas fa-eye"></i>
                    </button>
                  </div>
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
          <i className="fas fa-calendar-alt"></i> Gestión de Reservas
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
          <button 
            className="btn btn-outline-secondary btn-sm" 
            onClick={() => { fetchReservations(pagination.currentPage); fetchStats(); }}
            disabled={loading}
          >
            <i className="fas fa-sync-alt"></i>
          </button>
        </div>
      </div>

      {/* ESTADÍSTICAS ACORDEÓN */}
      {stats && (
        <div className="card mb-3">
          <div className="card-header py-2">
            <button 
              className="btn btn-link p-0 text-decoration-none w-100 text-start d-flex justify-content-between align-items-center"
              onClick={() => setExpandedStats(!expandedStats)}
            >
              <h6 className="mb-0">
                <i className="fas fa-chart-bar"></i> Estadísticas Rápidas
              </h6>
              <i className={`fas fa-chevron-${expandedStats ? 'up' : 'down'}`}></i>
            </button>
          </div>
          {expandedStats && (
            <div className="card-body py-2">
              <div className="row">
                <div className="col-3">
                  <div className="text-center">
                    <h5 className="text-primary mb-0">{stats.general.totalReservations}</h5>
                    <small className="text-muted">Total</small>
                  </div>
                </div>
                <div className="col-3">
                  <div className="text-center">
                    <h5 className="text-success mb-0">{stats.general.checkin}</h5>
                    <small className="text-muted">Check-in</small>
                  </div>
                </div>
                <div className="col-3">
                  <div className="text-center">
                    <h5 className="text-info mb-0">{stats.general.reservadas}</h5>
                    <small className="text-muted">Reservadas</small>
                  </div>
                </div>
                <div className="col-3">
                  <div className="text-center">
                    <h5 className="text-warning mb-0">{stats.general.ocupadasHoy}</h5>
                    <small className="text-muted">Hoy</small>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FILTROS ACORDEÓN */}
      <div className="card mb-3">
        <div className="card-header py-2">
          <button 
            className="btn btn-link p-0 text-decoration-none w-100 text-start d-flex justify-content-between align-items-center"
            onClick={() => setExpandedFilters(!expandedFilters)}
          >
            <h6 className="mb-0">
              <i className="fas fa-filter"></i> Filtros
              {Object.values(filters).some(v => v && !['checkIn', 'desc'].includes(v)) && (
                <span className="badge bg-primary ms-2">Activos</span>
              )}
            </h6>
            <i className={`fas fa-chevron-${expandedFilters ? 'up' : 'down'}`}></i>
          </button>
        </div>
        {expandedFilters && (
          <div className="card-body py-2" style={{ fontSize: '0.85rem' }}>
            <div className="row g-2">
              <div className="col-md-3">
                <label className="form-label small">Fechas</label>
                <div className="d-flex gap-1">
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  />
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  />
                </div>
              </div>
              
              <div className="col-md-2">
                <label className="form-label small">Estado</label>
                <select
                  className="form-select form-select-sm"
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="reservada">Reservada</option>
                  <option value="checkin">Check-in</option>
                  <option value="checkout">Check-out</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label small">Tipo</label>
                <select
                  className="form-select form-select-sm"
                  value={filters.tipo}
                  onChange={(e) => handleFilterChange('tipo', e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="doble">Doble</option>
                  <option value="triple">Triple</option>
                  <option value="cuadruple">Cuádruple</option>
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label small">Cliente</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Buscar..."
                  value={filters.clientSearch}
                  onChange={(e) => handleFilterChange('clientSearch', e.target.value)}
                />
              </div>

              <div className="col-md-2">
                <label className="form-label small">Habitación</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Nº..."
                  value={filters.roomNumber}
                  onChange={(e) => handleFilterChange('roomNumber', e.target.value)}
                />
              </div>

              <div className="col-md-1">
                <label className="form-label small">&nbsp;</label>
                <button
                  className="btn btn-outline-secondary btn-sm d-block w-100"
                  onClick={clearFilters}
                  title="Limpiar filtros"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CONTENIDO PRINCIPAL */}
      {loading ? (
        <div className="text-center p-4">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
          <div className="mt-2">Cargando reservas...</div>
        </div>
      ) : error ? (
        <div className="alert alert-danger">
          <i className="fas fa-exclamation-triangle"></i> {error}
        </div>
      ) : (
        <>
          {/* Vista según el modo seleccionado */}
          {viewMode === 'compact' && (
            <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              {reservations.length === 0 ? (
                <div className="text-center p-4">
                  <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                  <div>No se encontraron reservas</div>
                </div>
              ) : (
                reservations.map((reservation, index) => (
                  <CompactReservationCard 
                    key={reservation._id} 
                    reservation={reservation}
                    index={index}
                  />
                ))
              )}
            </div>
          )}

          {viewMode === 'table' && <ScrollableTable />}

          {viewMode === 'cards' && (
            <div className="row" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              {reservations.map((reservation, index) => (
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
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* PAGINACIÓN COMPACTA */}
      {pagination.totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <small className="text-muted">
            {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} - {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} de {pagination.totalItems}
          </small>
          
          <nav>
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${!pagination.hasPrevPage ? 'disabled' : ''}`}>
                <button
                  className="page-link"
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={!pagination.hasPrevPage}
                >
                  <i className="fas fa-angle-left"></i>
                </button>
              </li>
              
              <li className="page-item active">
                <span className="page-link">
                  {pagination.currentPage} / {pagination.totalPages}
                </span>
              </li>
              
              <li className={`page-item ${!pagination.hasNextPage ? 'disabled' : ''}`}>
                <button
                  className="page-link"
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                >
                  <i className="fas fa-angle-right"></i>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
};

export default CompactReservationManager;