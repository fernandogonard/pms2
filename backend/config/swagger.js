// config/swagger.js
// Configuración de documentación OpenAPI 3.0 (Swagger)

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CRM Hotelero — API',
      version: '1.0.0',
      description:
        'API REST para el sistema de gestión hotelera (PMS). ' +
        'Incluye autenticación JWT, gestión de habitaciones, reservas, ' +
        'clientes, facturación, limpieza, mantenimiento y analíticas.',
      contact: {
        name: 'Soporte PMS',
        email: 'admin@hotel.com'
      }
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:5000',
        description: 'Servidor principal'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Ingresar token JWT obtenido en /api/auth/login'
        }
      },
      schemas: {
        // ── AUTH ──────────────────────────────────────────
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'admin@hotel.com' },
            password: { type: 'string', example: 'admin123' }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: { $ref: '#/components/schemas/User' }
          }
        },
        // ── USER ─────────────────────────────────────────
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string', example: 'Administrador' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['admin', 'recepcionista', 'cliente'] }
          }
        },
        // ── ROOM ─────────────────────────────────────────
        Room: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            number: { type: 'integer', example: 101 },
            floor: { type: 'integer', example: 1 },
            type: { type: 'string', enum: ['doble', 'triple', 'cuadruple', 'suite'] },
            price: { type: 'number', example: 8500 },
            status: {
              type: 'string',
              enum: ['disponible', 'ocupada', 'limpieza', 'mantenimiento']
            },
            lastCleaning: { type: 'string', format: 'date-time' },
            notes: { type: 'string' }
          }
        },
        // ── CLIENT ───────────────────────────────────────
        Client: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            nombre: { type: 'string', example: 'Juan' },
            apellido: { type: 'string', example: 'Pérez' },
            dni: { type: 'string', example: '12345678' },
            email: { type: 'string', format: 'email' },
            whatsapp: { type: 'string', example: '+5491112345678' }
          }
        },
        // ── RESERVATION ──────────────────────────────────
        Reservation: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            tipo: { type: 'string', enum: ['doble', 'triple', 'cuadruple', 'suite'] },
            cantidad: { type: 'integer', minimum: 1 },
            client: { $ref: '#/components/schemas/Client' },
            room: {
              type: 'array',
              items: { $ref: '#/components/schemas/Room' }
            },
            checkIn: { type: 'string', format: 'date' },
            checkOut: { type: 'string', format: 'date' },
            status: {
              type: 'string',
              enum: ['reservada', 'checkin', 'checkout', 'cancelada']
            },
            pricing: {
              type: 'object',
              properties: {
                pricePerNight: { type: 'number' },
                totalNights: { type: 'integer' },
                subtotal: { type: 'number' },
                taxes: { type: 'number' },
                total: { type: 'number' },
                currency: { type: 'string', enum: ['ARS', 'USD', 'EUR'] }
              }
            },
            payment: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['pendiente', 'parcial', 'pagado', 'reembolsado'] },
                method: { type: 'string', enum: ['efectivo', 'tarjeta', 'transferencia', 'cheque'] },
                amountPaid: { type: 'number' }
              }
            }
          }
        },
        // ── ERROR ─────────────────────────────────────────
        ErrorResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            error: { type: 'string' }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Autenticación y sesión' },
      { name: 'Rooms', description: 'Gestión de habitaciones' },
      { name: 'Reservations', description: 'Gestión de reservas' },
      { name: 'Clients', description: 'Gestión de huéspedes/clientes' },
      { name: 'Billing', description: 'Facturación y pagos' },
      { name: 'Cleaning', description: 'Gestión de limpieza' },
      { name: 'Maintenance', description: 'Gestión de mantenimiento' },
      { name: 'Reports', description: 'Reportes y exportaciones' },
      { name: 'Analytics', description: 'Estadísticas y analíticas' },
      { name: 'Users', description: 'Administración de usuarios del sistema' },
      { name: 'System', description: 'Estado del sistema y monitoreo' }
    ]
  },
  // Rutas donde están los JSDoc comments con @swagger
  apis: ['./routes/*.js', './controllers/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
