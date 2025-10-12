import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../utils/api';

const OptimizedReservationManager = () => {
  // Estados principales
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  // Estados de paginación
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20,
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

      // Agregar filtros solo si tienen valor
      Object.entries(filters).forEach(([key, value]) => {
        if (value && key !== 'sortBy' && key !== 'sortOrder') {
          params.append(key, value);
        }
      });

      const response = await api.get(`/api/reservations/optimized?${params}`);
      
      if (response.data.success) {
        setReservations(response.data.data.reservations);
        setPagination(response.data.data.pagination);
        
        // Log de rendimiento
        if (response.data.data.performance) {
          console.log(`⚡ Consulta ejecutada en: ${response.data.data.performance.queryTime}ms`);
        }
      } else {
        setError('Error al cargar las reservas');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error de conexión');
      console.error('Error fetching reservations:', err);
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

  // Efectos
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

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setPagination(prev => ({ ...prev, itemsPerPage: newItemsPerPage }));
    fetchReservations(1);
  };

  const handleSort = (column) => {
    const newOrder = filters.sortBy === column && filters.sortOrder === 'asc' ? 'desc' : 'asc';
    setFilters(prev => ({ ...prev, sortBy: column, sortOrder: newOrder }));
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

  const getSortIcon = (column) => {
    if (filters.sortBy !== column) return <i className="fas fa-sort text-muted"></i>;
    return filters.sortOrder === 'asc' 
      ? <i className="fas fa-sort-up text-primary"></i>
      : <i className="fas fa-sort-down text-primary"></i>;
  };

  // Generar números de página para paginación
  const getPageNumbers = () => {
    const current = pagination.currentPage;
    const total = pagination.totalPages;
    const pages = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      if (current <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(total);
      } else if (current >= total - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = total - 4; i <= total; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = current - 1; i <= current + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(total);
      }
    }

    return pages;
  };

  // Componente de fila de reserva
  const ReservationRow = ({ reservation, index }) => (
    <tr className={index % 2 === 0 ? 'table-light' : ''}>
      <td>
        <div className="fw-bold">{new Date(reservation.checkIn).toLocaleDateString('es-ES')}</div>
        <small className="text-muted">{new Date(reservation.checkIn).toLocaleDateString('es-ES', { weekday: 'short' })}</small>
      </td>
      <td>
        <div className="fw-bold">{new Date(reservation.checkOut).toLocaleDateString('es-ES')}</div>
        <small className="text-muted">{Math.ceil(reservation.duration || 0)} días</small>
      </td>
      <td>
        <div className="fw-bold">
          {reservation.client?.nombre} {reservation.client?.apellido}
        </div>
        <small className="text-muted">
          {reservation.client?.email || reservation.email || 'Sin email'}
        </small>
      </td>
      <td>
        <span className="badge bg-info text-capitalize">{reservation.tipo}</span>
        <div className="small text-muted">{reservation.cantidad} hab.</div>
      </td>
      <td>
        {reservation.room && reservation.room.length > 0 ? (
          <div>
            {reservation.room.map((r, idx) => (
              <span key={idx} className="badge bg-secondary me-1">#{r.number}</span>
            ))}
          </div>
        ) : (
          <span className="badge bg-warning">Virtual</span>
        )}
      </td>
      <td>
        <span className={`badge status-${reservation.status}`}>
          {reservation.status}
        </span>
      </td>
      <td>
        <div className="fw-bold text-success">
          ${(reservation.totalAmount || 0).toFixed(2)}
        </div>
      </td>
      <td>
        <div className="btn-group btn-group-sm">
          <button className="btn btn-outline-primary btn-sm" title="Ver detalles">
            <i className="fas fa-eye"></i>
          </button>
          <button className="btn btn-outline-warning btn-sm" title="Editar">
            <i className="fas fa-edit"></i>
          </button>
          <button className="btn btn-outline-success btn-sm" title="Check-in">
            <i className="fas fa-sign-in-alt"></i>
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="container-fluid">
      {/* ENCABEZADO */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2><i className="fas fa-calendar-alt"></i> Gestión de Reservas Optimizada</h2>
        <div className="d-flex gap-2">
          <button className="btn btn-success" disabled={loading}>
            <i className="fas fa-plus"></i> Nueva Reserva
          </button>
          <button 
            className="btn btn-outline-secondary" 
            onClick={() => { fetchReservations(pagination.currentPage); fetchStats(); }}
            disabled={loading}
          >
            <i className="fas fa-sync-alt"></i> Actualizar
          </button>
        </div>
      </div>

      {/* ESTADÍSTICAS RÁPIDAS */}
      {stats && (
        <div className="row mb-4">
          <div className="col-md-3">
            <div className="card text-center border-primary">
              <div className="card-body">
                <h3 className="text-primary mb-1">{stats.general.totalReservations}</h3>
                <small className="text-muted">Total Reservas</small>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card text-center border-success">
              <div className="card-body">
                <h3 className="text-success mb-1">{stats.general.checkin}</h3>
                <small className="text-muted">Check-in Activo</small>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card text-center border-info">
              <div className="card-body">
                <h3 className="text-info mb-1">{stats.general.reservadas}</h3>
                <small className="text-muted">Reservadas</small>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card text-center border-warning">
              <div className="card-body">
                <h3 className="text-warning mb-1">{stats.general.ocupadasHoy}</h3>
                <small className="text-muted">Ocupadas Hoy</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FILTROS AVANZADOS */}
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="mb-0">
            <i className="fas fa-filter"></i> Filtros Avanzados
            {Object.values(filters).some(v => v && !['checkIn', 'desc'].includes(v)) && (
              <span className="badge bg-primary ms-2">Activos</span>
            )}
          </h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label small">Rango de Fechas</label>
              <div className="d-flex gap-2">
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
              <label className="form-label small">Tipo Habitación</label>
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
                placeholder="Buscar cliente..."
                value={filters.clientSearch}
                onChange={(e) => handleFilterChange('clientSearch', e.target.value)}
              />
            </div>

            <div className="col-md-2">
              <label className="form-label small">Habitación</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Nº habitación..."
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
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <i className="fas fa-list"></i> Reservas 
            <span className="badge bg-primary ms-2">{pagination.totalItems}</span>
          </h5>
          <div className="d-flex gap-2 align-items-center">
            <span className="text-muted small">Mostrar:</span>
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={pagination.itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
        
        <div className="table-responsive">
          {loading ? (
            <div className="text-center p-4">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              <div className="mt-2">Cargando reservas...</div>
            </div>
          ) : error ? (
            <div className="alert alert-danger m-3">
              <i className="fas fa-exclamation-triangle"></i> {error}
            </div>
          ) : (
            <table className="table table-hover mb-0">
              <thead className="table-dark">
                <tr>
                  <th 
                    onClick={() => handleSort('checkIn')}
                    style={{ cursor: 'pointer' }}
                    className="user-select-none"
                  >
                    Check-in {getSortIcon('checkIn')}
                  </th>
                  <th 
                    onClick={() => handleSort('checkOut')}
                    style={{ cursor: 'pointer' }}
                    className="user-select-none"
                  >
                    Check-out {getSortIcon('checkOut')}
                  </th>
                  <th>Cliente</th>
                  <th 
                    onClick={() => handleSort('tipo')}
                    style={{ cursor: 'pointer' }}
                    className="user-select-none"
                  >
                    Tipo {getSortIcon('tipo')}
                  </th>
                  <th>Habitación</th>
                  <th 
                    onClick={() => handleSort('status')}
                    style={{ cursor: 'pointer' }}
                    className="user-select-none"
                  >
                    Estado {getSortIcon('status')}
                  </th>
                  <th>Total</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {reservations.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center p-4">
                      <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                      <div>No se encontraron reservas</div>
                    </td>
                  </tr>
                ) : (
                  reservations.map((reservation, index) => (
                    <ReservationRow 
                      key={reservation._id} 
                      reservation={reservation}
                      index={index}
                    />
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* PAGINACIÓN MEJORADA */}
        {pagination.totalPages > 1 && (
          <div className="card-footer">
            <nav>
              <ul className="pagination pagination-sm justify-content-center mb-2">
                <li className={`page-item ${!pagination.hasPrevPage ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => handlePageChange(1)}
                    disabled={!pagination.hasPrevPage}
                  >
                    <i className="fas fa-angle-double-left"></i>
                  </button>
                </li>
                <li className={`page-item ${!pagination.hasPrevPage ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={!pagination.hasPrevPage}
                  >
                    <i className="fas fa-angle-left"></i>
                  </button>
                </li>
                
                {getPageNumbers().map((pageNum, idx) => (
                  <li key={idx} className={`page-item ${
                    pageNum === pagination.currentPage ? 'active' : ''
                  } ${pageNum === '...' ? 'disabled' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => pageNum !== '...' && handlePageChange(pageNum)}
                      disabled={pageNum === '...'}
                    >
                      {pageNum}
                    </button>
                  </li>
                ))}
                
                <li className={`page-item ${!pagination.hasNextPage ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                  >
                    <i className="fas fa-angle-right"></i>
                  </button>
                </li>
                <li className={`page-item ${!pagination.hasNextPage ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => handlePageChange(pagination.totalPages)}
                    disabled={!pagination.hasNextPage}
                  >
                    <i className="fas fa-angle-double-right"></i>
                  </button>
                </li>
              </ul>
            </nav>
            <div className="text-center">
              <small className="text-muted">
                Mostrando {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} - {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} de {pagination.totalItems} reservas
                {stats && (
                  <span className="ms-2">
                    | Consulta ejecutada en tiempo optimizado
                  </span>
                )}
              </small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OptimizedReservationManager;