// Componente de Dashboard Analytics Avanzado
import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import './AdvancedDashboard.css';

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  ArcElement
);

const AdvancedDashboard = () => {
  const [analytics, setAnalytics] = useState({
    occupancyTrend: [],
    revenueData: [],
    roomTypeDistribution: [],
    checkinCheckoutTrend: [],
    kpis: {}
  });
  
  const [timeRange, setTimeRange] = useState('7d'); // 7d, 30d, 90d
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Llamadas paralelas a múltiples endpoints de analytics
      const [occupancy, revenue, roomTypes, checkins, kpis] = await Promise.all([
        fetch(`/api/analytics/occupancy?range=${timeRange}`).then(r => r.json()),
        fetch(`/api/analytics/revenue?range=${timeRange}`).then(r => r.json()),
        fetch(`/api/analytics/room-types?range=${timeRange}`).then(r => r.json()),
        fetch(`/api/analytics/checkin-trend?range=${timeRange}`).then(r => r.json()),
        fetch(`/api/analytics/kpis?range=${timeRange}`).then(r => r.json())
      ]);

      setAnalytics({
        occupancyTrend: occupancy,
        revenueData: revenue,
        roomTypeDistribution: roomTypes,
        checkinCheckoutTrend: checkins,
        kpis
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Configuración del gráfico de ocupación
  const occupancyChartData = {
    labels: analytics.occupancyTrend.map(d => d.date),
    datasets: [
      {
        label: 'Ocupación (%)',
        data: analytics.occupancyTrend.map(d => d.occupancyRate),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
      {
        label: 'ADR (Tarifa Promedio)',
        data: analytics.occupancyTrend.map(d => d.adr),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        yAxisID: 'y1',
        tension: 0.4,
      }
    ]
  };

  const occupancyChartOptions = {
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      title: {
        display: true,
        text: 'Tendencia de Ocupación y ADR'
      },
      legend: {
        position: 'top',
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Fecha'
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Ocupación (%)'
        },
        max: 100
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'ADR ($)'
        },
        grid: {
          drawOnChartArea: false,
        },
      }
    }
  };

  // Configuración del gráfico de ingresos
  const revenueChartData = {
    labels: analytics.revenueData.map(d => d.date),
    datasets: [
      {
        label: 'Ingresos Diarios',
        data: analytics.revenueData.map(d => d.revenue),
        backgroundColor: 'rgba(245, 158, 11, 0.8)',
        borderColor: 'rgb(245, 158, 11)',
        borderWidth: 1
      }
    ]
  };

  // Configuración del gráfico circular de tipos de habitación
  const roomTypeChartData = {
    labels: analytics.roomTypeDistribution.map(d => d.type),
    datasets: [
      {
        data: analytics.roomTypeDistribution.map(d => d.count),
        backgroundColor: [
          '#FF6384',
          '#36A2EB', 
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40'
        ],
        hoverOffset: 4
      }
    ]
  };

  const KPICard = ({ title, value, change, icon, color }) => (
    <div className="kpi-card">
      <div className="kpi-icon" style={{ backgroundColor: color }}>
        {icon}
      </div>
      <div className="kpi-content">
        <h3>{title}</h3>
        <div className="kpi-value">{value}</div>
        <div className={`kpi-change ${change >= 0 ? 'positive' : 'negative'}`}>
          {change >= 0 ? '↗' : '↘'} {Math.abs(change)}%
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando analytics...</p>
      </div>
    );
  }

  return (
    <div className="advanced-dashboard">
      <div className="dashboard-header">
        <h1>📊 Dashboard Analytics</h1>
        <div className="time-range-selector">
          <button 
            className={timeRange === '7d' ? 'active' : ''}
            onClick={() => setTimeRange('7d')}
          >
            7 días
          </button>
          <button 
            className={timeRange === '30d' ? 'active' : ''}
            onClick={() => setTimeRange('30d')}
          >
            30 días
          </button>
          <button 
            className={timeRange === '90d' ? 'active' : ''}
            onClick={() => setTimeRange('90d')}
          >
            90 días
          </button>
        </div>
      </div>

      {/* KPIs Row */}
      <div className="kpis-row">
        <KPICard
          title="Ocupación Promedio"
          value={`${analytics.kpis.avgOccupancy}%`}
          change={analytics.kpis.occupancyChange}
          icon="🏨"
          color="#3B82F6"
        />
        <KPICard
          title="RevPAR"
          value={`$${analytics.kpis.revpar}`}
          change={analytics.kpis.revparChange}
          icon="💰"
          color="#10B981"
        />
        <KPICard
          title="ADR"
          value={`$${analytics.kpis.adr}`}
          change={analytics.kpis.adrChange}
          icon="💳"
          color="#F59E0B"
        />
        <KPICard
          title="Ingresos Totales"
          value={`$${analytics.kpis.totalRevenue}`}
          change={analytics.kpis.revenueChange}
          icon="📈"
          color="#EF4444"
        />
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        <div className="chart-container large">
          <Line data={occupancyChartData} options={occupancyChartOptions} />
        </div>
        
        <div className="chart-container medium">
          <Bar 
            data={revenueChartData} 
            options={{
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Ingresos por Día'
                }
              }
            }} 
          />
        </div>

        <div className="chart-container small">
          <Doughnut 
            data={roomTypeChartData}
            options={{
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Distribución por Tipo de Habitación'
                }
              }
            }}
          />
        </div>

        <div className="metrics-table">
          <h3>📋 Métricas Detalladas</h3>
          <table>
            <thead>
              <tr>
                <th>Métrica</th>
                <th>Valor Actual</th>
                <th>Período Anterior</th>
                <th>Cambio</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Tiempo Promedio de Estadía</td>
                <td>{analytics.kpis.avgStayLength} días</td>
                <td>{analytics.kpis.prevAvgStayLength} días</td>
                <td className={analytics.kpis.stayLengthChange >= 0 ? 'positive' : 'negative'}>
                  {analytics.kpis.stayLengthChange}%
                </td>
              </tr>
              <tr>
                <td>Tasa de Cancelación</td>
                <td>{analytics.kpis.cancellationRate}%</td>
                <td>{analytics.kpis.prevCancellationRate}%</td>
                <td className={analytics.kpis.cancellationChange <= 0 ? 'positive' : 'negative'}>
                  {analytics.kpis.cancellationChange}%
                </td>
              </tr>
              <tr>
                <td>Check-in Promedio</td>
                <td>{analytics.kpis.avgCheckinTime}</td>
                <td>{analytics.kpis.prevAvgCheckinTime}</td>
                <td>--</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-time Updates Indicator */}
      <div className="realtime-indicator">
        <div className="pulse"></div>
        <span>Actualizando en tiempo real</span>
      </div>
    </div>
  );
};

export default AdvancedDashboard;