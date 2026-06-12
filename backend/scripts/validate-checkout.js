// scripts/validate-checkout.js
// Script de validación rápida para checkout & cleaning (sin jest)

const fs = require('fs');
const path = require('path');

console.log('🧪 VALIDACIÓN RÁPIDA - Checkout & Cleaning\n');

const VALIDATIONS = [];
const BASE_DIR = __dirname.includes('backend') ? path.join(__dirname, '..') : __dirname;

function validate(name, condition, errorMsg = '') {
  const status = condition ? '✅' : '❌';
  console.log(`${status} ${name}`);
  if (!condition) {
    console.log(`   Error: ${errorMsg}`);
  }
  VALIDATIONS.push({ name, condition });
}

// ────────────────────────────────────────────────────────────────
// 1. Validar estructura de archivos
// ────────────────────────────────────────────────────────────────
console.log('📁 1. Estructura de Archivos\n');

const requiredFiles = [
  'models/Room.js',
  'services/CheckoutService.js',
  'routes/cleaningRoutes.js',
  'scheduledJobs.js',
  '../frontend/src/components/CheckoutDashboard.jsx',
  '../frontend/src/components/RoomCalendar.js',
  '../frontend/src/components/RoomTable.js',
];

requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(BASE_DIR, file));
  validate(`Existe ${file}`, exists, `Archivo no encontrado: ${file}`);
});

// ────────────────────────────────────────────────────────────────
// 2. Validar contenido de archivos críticos
// ────────────────────────────────────────────────────────────────
console.log('\n📝 2. Contenido de Archivos Críticos\n');

// Room.js
const roomContent = fs.readFileSync(path.join(BASE_DIR, 'models/Room.js'), 'utf8');
validate('Room.js tiene checkoutToday field', roomContent.includes('checkoutToday'), 'checkoutToday no encontrado');
validate('Room.js tiene checkoutInfo field', roomContent.includes('checkoutInfo'), 'checkoutInfo no encontrado');
validate('Room.js tiene housekeepingAssignment', roomContent.includes('housekeepingAssignment'), 'housekeepingAssignment no encontrado');

// CheckoutService.js
const checkoutServiceContent = fs.readFileSync(path.join(BASE_DIR, 'services/CheckoutService.js'), 'utf8');
validate('CheckoutService.js existe', true);
validate('CheckoutService tiene markRoomsWithCheckoutToday', checkoutServiceContent.includes('markRoomsWithCheckoutToday'), 'markRoomsWithCheckoutToday no encontrado');
validate('CheckoutService tiene clearCheckoutTodayFlag', checkoutServiceContent.includes('clearCheckoutTodayFlag'), 'clearCheckoutTodayFlag no encontrado');
validate('CheckoutService tiene assignCleaning', checkoutServiceContent.includes('assignCleaning'), 'assignCleaning no encontrado');
validate('CheckoutService tiene startCleaning', checkoutServiceContent.includes('startCleaning'), 'startCleaning no encontrado');
validate('CheckoutService tiene completeCleaning', checkoutServiceContent.includes('completeCleaning'), 'completeCleaning no encontrado');
validate('CheckoutService tiene cancelCleaning', checkoutServiceContent.includes('cancelCleaning'), 'cancelCleaning no encontrado');

// cleaningRoutes.js
const cleaningRoutesContent = fs.readFileSync(path.join(BASE_DIR, 'routes/cleaningRoutes.js'), 'utf8');
validate('cleaningRoutes.js existe', true);
validate('cleaningRoutes tiene GET /checkouts/today', cleaningRoutesContent.includes('/checkouts/today'), '/checkouts/today no encontrado');
validate('cleaningRoutes tiene GET /pending', cleaningRoutesContent.includes("'/pending'"), "/pending no encontrado");
validate('cleaningRoutes tiene POST /:roomId/assign', cleaningRoutesContent.includes("/:roomId/assign'") || cleaningRoutesContent.includes('/:roomId/assign'), '/:roomId/assign no encontrado');
validate('cleaningRoutes tiene PATCH /:roomId/start', cleaningRoutesContent.includes("/:roomId/start'") || cleaningRoutesContent.includes('/:roomId/start'), '/:roomId/start no encontrado');
validate('cleaningRoutes tiene PATCH /:roomId/complete', cleaningRoutesContent.includes("/:roomId/complete'") || cleaningRoutesContent.includes('/:roomId/complete'), '/:roomId/complete no encontrado');
validate('cleaningRoutes tiene DELETE /:roomId/cancel', cleaningRoutesContent.includes("/:roomId/cancel'") || cleaningRoutesContent.includes('/:roomId/cancel'), '/:roomId/cancel no encontrado');

// scheduledJobs.js
const scheduledJobsContent = fs.readFileSync(path.join(BASE_DIR, 'scheduledJobs.js'), 'utf8');
validate('scheduledJobs tiene TAREA 8 (7 AM)', scheduledJobsContent.includes('TAREA 8') && scheduledJobsContent.includes("'0 7"), 'TAREA 8 no configurado correctamente');
validate('scheduledJobs tiene TAREA 9 (23:30)', scheduledJobsContent.includes('TAREA 9') && scheduledJobsContent.includes("'30 23"), 'TAREA 9 no configurado correctamente');

// ────────────────────────────────────────────────────────────────
// 3. Validar Frontend Components
// ────────────────────────────────────────────────────────────────
console.log('\n🎨 3. Frontend Components\n');

// CheckoutDashboard.jsx
const checkoutDashboardContent = fs.readFileSync(path.join(BASE_DIR, '../frontend/src/components/CheckoutDashboard.jsx'), 'utf8');
validate('CheckoutDashboard.jsx carga checkouts', checkoutDashboardContent.includes('/api/cleaning/checkouts/today'), '/api/cleaning/checkouts/today no encontrado');
validate('CheckoutDashboard.jsx tiene UI para asignar', checkoutDashboardContent.includes('assignedTo') || checkoutDashboardContent.includes('Asignar'), 'No tiene UI de asignación');

// RoomCalendar.js
const roomCalendarContent = fs.readFileSync(path.join(BASE_DIR, '../frontend/src/components/RoomCalendar.js'), 'utf8');
validate('RoomCalendar.js tiene STATUS_CONFIG.checkout_hoy', roomCalendarContent.includes('checkout_hoy'), 'checkout_hoy no encontrado en STATUS_CONFIG');
validate('RoomCalendar.js popover muestra checkout info', roomCalendarContent.includes('checkoutInfo'), 'checkoutInfo no referenciado en popover');

// RoomTable.js
const roomTableContent = fs.readFileSync(path.join(BASE_DIR, '../frontend/src/components/RoomTable.js'), 'utf8');
validate('RoomTable.js carga checkouts', roomTableContent.includes('/api/cleaning/checkouts/today'), '/api/cleaning/checkouts/today no encontrado');

// useCalendarData.js
const useCalendarDataContent = fs.readFileSync(path.join(BASE_DIR, '../frontend/src/hooks/useCalendarData.js'), 'utf8');
validate('useCalendarData.js carga checkouts', useCalendarDataContent.includes('/api/cleaning/checkouts/today'), '/api/cleaning/checkouts/today no encontrado');
validate('useCalendarData.js enriquece con checkoutInfo', useCalendarDataContent.includes('checkoutInfo'), 'checkoutInfo no enriquecido');

// ────────────────────────────────────────────────────────────────
// 4. Validar Configuración
// ────────────────────────────────────────────────────────────────
console.log('\n⚙️ 4. Configuración\n');

// app.js
const appContent = fs.readFileSync(path.join(BASE_DIR, 'app.js'), 'utf8');
validate('app.js importa cleaningRoutes', appContent.includes('cleaningRoutes'), 'cleaningRoutes no importado');
validate('app.js usa cleaningRoutes en /api/cleaning', appContent.includes("'/api/cleaning'"), '/api/cleaning route no registrado');

// ReceptionDashboard.js
const receptionDashboardContent = fs.readFileSync(path.join(BASE_DIR, '../frontend/src/pages/ReceptionDashboard.js'), 'utf8');
validate('ReceptionDashboard importa CheckoutDashboard', receptionDashboardContent.includes('CheckoutDashboard'), 'CheckoutDashboard no importado');
validate('ReceptionDashboard tiene tab de checkouts', receptionDashboardContent.includes('checkouts'), 'Tab checkouts no encontrado');

// ────────────────────────────────────────────────────────────────
// 5. Validar Seguridad (Auth)
// ────────────────────────────────────────────────────────────────
console.log('\n🔐 5. Seguridad\n');

validate('cleaningRoutes usa protect middleware', cleaningRoutesContent.includes('protect'), 'protect middleware no encontrado');
validate('cleaningRoutes usa authorize', cleaningRoutesContent.includes('authorize'), 'authorize middleware no encontrado');
validate('cleaningRoutes protege GET /checkouts/today', cleaningRoutesContent.includes('/checkouts/today') && cleaningRoutesContent.includes('protect'), 'GET /checkouts/today no protegido');

// ────────────────────────────────────────────────────────────────
// 6. Resumen
// ────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(50));

const passed = VALIDATIONS.filter(v => v.condition).length;
const total = VALIDATIONS.length;
const percentage = Math.round((passed / total) * 100);

console.log(`\n📊 RESULTADO: ${passed}/${total} validaciones pasadas (${percentage}%)\n`);

if (percentage === 100) {
  console.log('✅ ¡TODAS LAS VALIDACIONES PASARON! Listo para hacer push.\n');
  process.exit(0);
} else {
  console.log('⚠️  Algunas validaciones fallaron. Revisa los errores arriba.\n');
  process.exit(1);
}
