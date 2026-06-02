// scripts/seedDemo.js
// Poblar la base de datos con datos demo realistas para presentaciones
// Uso: node scripts/seedDemo.js
// Uso con reset: node scripts/seedDemo.js --reset

const mongoose = require('mongoose');
require('dotenv').config({ path: './config/.env' });

const Room = require('../models/Room');
const Client = require('../models/Client');
const Reservation = require('../models/Reservation');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pms';
const RESET = process.argv.includes('--reset');

// ─── Helpers de fecha ─────────────────────────────────────────────────────────
const hoy = new Date();
hoy.setHours(14, 0, 0, 0);

function diasDesdeHoy(n) {
  const d = new Date(hoy);
  d.setDate(d.getDate() + n);
  return d;
}

// ─── HABITACIONES ─────────────────────────────────────────────────────────────
const HABITACIONES = [
  // Piso 1
  { number: 101, floor: 1, type: 'doble',     price: 15000, status: 'ocupada'    },
  { number: 102, floor: 1, type: 'doble',     price: 15000, status: 'disponible' },
  { number: 103, floor: 1, type: 'triple',    price: 20000, status: 'ocupada'    },
  { number: 104, floor: 1, type: 'triple',    price: 20000, status: 'limpieza'   },
  { number: 105, floor: 1, type: 'cuadruple', price: 25000, status: 'disponible' },
  { number: 106, floor: 1, type: 'doble',     price: 15000, status: 'disponible' },
  { number: 107, floor: 1, type: 'doble',     price: 15000, status: 'ocupada'    },
  { number: 108, floor: 1, type: 'triple',    price: 20000, status: 'disponible' },
  // Piso 2
  { number: 201, floor: 2, type: 'doble',     price: 16000, status: 'disponible' },
  { number: 202, floor: 2, type: 'doble',     price: 16000, status: 'ocupada'    },
  { number: 203, floor: 2, type: 'triple',    price: 21000, status: 'disponible' },
  { number: 204, floor: 2, type: 'triple',    price: 21000, status: 'ocupada'    },
  { number: 205, floor: 2, type: 'cuadruple', price: 26000, status: 'disponible' },
  { number: 206, floor: 2, type: 'doble',     price: 16000, status: 'disponible' },
  { number: 207, floor: 2, type: 'suite',     price: 38000, status: 'ocupada'    },
  { number: 208, floor: 2, type: 'triple',    price: 21000, status: 'limpieza'   },
  // Piso 3
  { number: 301, floor: 3, type: 'doble',     price: 17000, status: 'disponible' },
  { number: 302, floor: 3, type: 'doble',     price: 17000, status: 'ocupada'    },
  { number: 303, floor: 3, type: 'triple',    price: 22000, status: 'disponible' },
  { number: 304, floor: 3, type: 'suite',     price: 40000, status: 'disponible' },
  { number: 305, floor: 3, type: 'cuadruple', price: 27000, status: 'ocupada'    },
  { number: 306, floor: 3, type: 'doble',     price: 17000, status: 'disponible' },
  // Piso 4 — pisos altos, vista al mar
  { number: 401, floor: 4, type: 'suite',     price: 45000, status: 'disponible' },
  { number: 402, floor: 4, type: 'suite',     price: 45000, status: 'ocupada'    },
  { number: 403, floor: 4, type: 'cuadruple', price: 30000, status: 'disponible' },
  { number: 404, floor: 4, type: 'triple',    price: 24000, status: 'disponible' },
];

// ─── CLIENTES ─────────────────────────────────────────────────────────────────
const CLIENTES = [
  { nombre: 'Martín',    apellido: 'González',   dni: '28456123', email: 'martin.gonzalez@gmail.com',  whatsapp: '2235461234' },
  { nombre: 'Laura',     apellido: 'Fernández',  dni: '31789456', email: 'lauraf@hotmail.com',          whatsapp: '2234567890' },
  { nombre: 'Carlos',    apellido: 'Rodríguez',  dni: '25123789', email: 'carlos.rodriguez@yahoo.com',  whatsapp: '2236781234' },
  { nombre: 'Valeria',   apellido: 'López',      dni: '33456012', email: 'vlopez@gmail.com',            whatsapp: '2237891234' },
  { nombre: 'Diego',     apellido: 'Martínez',   dni: '29876543', email: 'diego.martinez@outlook.com',  whatsapp: '2238901234' },
  { nombre: 'Sofía',     apellido: 'Pérez',      dni: '35678901', email: 'sofia.perez@gmail.com',       whatsapp: '2239012345' },
  { nombre: 'Nicolás',   apellido: 'García',     dni: '27345678', email: 'nico.garcia@gmail.com',       whatsapp: '2231234567' },
  { nombre: 'Florencia', apellido: 'Sánchez',    dni: '32101234', email: 'flor.sanchez@hotmail.com',    whatsapp: '2232345678' },
  { nombre: 'Sebastián', apellido: 'Romero',     dni: '26234567', email: 'sebas.romero@gmail.com',      whatsapp: '2233456789' },
  { nombre: 'Luciana',   apellido: 'Torres',     dni: '34567890', email: 'lu.torres@gmail.com',         whatsapp: '2235678901' },
  { nombre: 'Andrés',    apellido: 'Díaz',       dni: '24678901', email: 'andres.diaz@yahoo.com',       whatsapp: '2236789012' },
  { nombre: 'Camila',    apellido: 'Ruiz',       dni: '36789012', email: 'camila.ruiz@gmail.com',       whatsapp: '2237890123' },
];

// ─── USUARIOS ─────────────────────────────────────────────────────────────────
const USUARIOS = [
  { name: 'Administrador Demo', email: 'admin@hoteldemo.com',     password: 'Demo1234!', role: 'admin'         },
  { name: 'Recepción Demo',     email: 'recepcion@hoteldemo.com', password: 'Demo1234!', role: 'recepcionista' },
];

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function seedDemo() {
  console.log('\n🏨  SEED DEMO — Hotel PMS\n');
  console.log(`📅  Fecha base: ${hoy.toLocaleDateString('es-AR')}\n`);

  await mongoose.connect(MONGO_URI);
  console.log('✅  MongoDB conectado');

  if (RESET) {
    console.log('\n⚠️   --reset: limpiando colecciones...');
    await Promise.all([
      Room.deleteMany({}),
      Client.deleteMany({}),
      Reservation.deleteMany({}),
      User.deleteMany({}),
    ]);
    console.log('🗑️   Colecciones vaciadas\n');
  }

  // ── 1. Usuarios ──────────────────────────────────────────────────────────────
  console.log('👤  Creando usuarios...');
  const usuariosCreados = [];
  for (const u of USUARIOS) {
    const existe = await User.findOne({ email: u.email });
    if (existe) {
      console.log(`   ⏭️  ${u.email} ya existe`);
      usuariosCreados.push(existe);
      continue;
    }
    const hash = await bcrypt.hash(u.password, 12);
    const nuevo = await User.create({ name: u.name, email: u.email, password: hash, role: u.role });
    console.log(`   ✅  ${u.role}: ${u.email} / ${u.password}`);
    usuariosCreados.push(nuevo);
  }
  const adminUser = usuariosCreados[0];

  // ── 2. Habitaciones ───────────────────────────────────────────────────────────
  console.log('\n🛏️   Creando habitaciones...');
  const roomMap = {}; // number -> doc
  for (const h of HABITACIONES) {
    const existe = await Room.findOne({ number: h.number });
    if (existe) {
      roomMap[h.number] = existe;
      continue;
    }
    const doc = await Room.create({
      number:   h.number,
      floor:    h.floor,
      type:     h.type,
      price:    h.price,
      status:   h.status,
    });
    roomMap[h.number] = doc;
  }
  const creadas = Object.keys(roomMap).length;
  console.log(`   ✅  ${creadas} habitaciones listas`);

  // ── 3. Clientes ───────────────────────────────────────────────────────────────
  console.log('\n👥  Creando clientes...');
  const clientesDocs = [];
  for (const c of CLIENTES) {
    const existe = await Client.findOne({ dni: c.dni });
    if (existe) {
      clientesDocs.push(existe);
      continue;
    }
    const doc = await Client.create(c);
    clientesDocs.push(doc);
  }
  console.log(`   ✅  ${clientesDocs.length} clientes listos`);

  // ── 4. Reservas ───────────────────────────────────────────────────────────────
  console.log('\n📋  Creando reservas...');

  // Helper para precio total
  function calcPricing(pricePerNight, nights, currency = 'ARS') {
    const subtotal = pricePerNight * nights;
    const taxes    = Math.round(subtotal * 0.21); // IVA 21%
    return { pricePerNight, totalNights: nights, subtotal, taxes, total: subtotal + taxes, currency };
  }

  const reservasData = [
    // ── EN CURSO hoy (status: checkin, habitaciones ocupadas)
    {
      clientIdx: 0, roomNumber: 101, tipo: 'doble', cantidad: 1,
      checkIn:  diasDesdeHoy(-2), checkOut: diasDesdeHoy(1),
      status: 'checkin', payStatus: 'pagado', method: 'tarjeta',
      notas: 'Solicitó almohadas extra'
    },
    {
      clientIdx: 2, roomNumber: 103, tipo: 'triple', cantidad: 1,
      checkIn:  diasDesdeHoy(-1), checkOut: diasDesdeHoy(2),
      status: 'checkin', payStatus: 'parcial', method: 'efectivo',
      notas: 'Familia con niños, cuna solicitada'
    },
    {
      clientIdx: 6, roomNumber: 107, tipo: 'doble', cantidad: 1,
      checkIn:  diasDesdeHoy(-3), checkOut: diasDesdeHoy(0),
      status: 'checkin', payStatus: 'pagado', method: 'transferencia',
      notas: 'Check-out hoy — coordinar llave'
    },
    {
      clientIdx: 1, roomNumber: 202, tipo: 'doble', cantidad: 1,
      checkIn:  diasDesdeHoy(-1), checkOut: diasDesdeHoy(3),
      status: 'checkin', payStatus: 'pagado', method: 'tarjeta',
      notas: null
    },
    {
      clientIdx: 4, roomNumber: 204, tipo: 'triple', cantidad: 1,
      checkIn:  diasDesdeHoy(-2), checkOut: diasDesdeHoy(4),
      status: 'checkin', payStatus: 'parcial', method: 'efectivo',
      notas: 'Pago restante al check-out'
    },
    {
      clientIdx: 9, roomNumber: 207, tipo: 'suite', cantidad: 1,
      checkIn:  diasDesdeHoy(-1), checkOut: diasDesdeHoy(5),
      status: 'checkin', payStatus: 'pagado', method: 'tarjeta',
      notas: 'Luna de miel — flores en habitación'
    },
    {
      clientIdx: 3, roomNumber: 302, tipo: 'doble', cantidad: 1,
      checkIn:  diasDesdeHoy(0), checkOut: diasDesdeHoy(3),
      status: 'checkin', payStatus: 'pendiente', method: 'efectivo',
      notas: 'Check-in hoy'
    },
    {
      clientIdx: 7, roomNumber: 305, tipo: 'cuadruple', cantidad: 1,
      checkIn:  diasDesdeHoy(-4), checkOut: diasDesdeHoy(1),
      status: 'checkin', payStatus: 'pagado', method: 'transferencia',
      notas: 'Grupo familiar — 4 personas'
    },
    {
      clientIdx: 10, roomNumber: 402, tipo: 'suite', cantidad: 1,
      checkIn:  diasDesdeHoy(-2), checkOut: diasDesdeHoy(6),
      status: 'checkin', payStatus: 'pagado', method: 'tarjeta',
      notas: 'Aniversario — vista al mar'
    },
    // ── FUTURAS (status: reservada)
    {
      clientIdx: 5, roomNumber: 201, tipo: 'doble', cantidad: 1,
      checkIn:  diasDesdeHoy(3), checkOut: diasDesdeHoy(7),
      status: 'reservada', payStatus: 'pendiente', method: 'efectivo',
      notas: null
    },
    {
      clientIdx: 8, roomNumber: 203, tipo: 'triple', cantidad: 1,
      checkIn:  diasDesdeHoy(5), checkOut: diasDesdeHoy(9),
      status: 'reservada', payStatus: 'parcial', method: 'transferencia',
      notas: 'Seña $10.000 recibida'
    },
    {
      clientIdx: 11, roomNumber: 304, tipo: 'suite', cantidad: 1,
      checkIn:  diasDesdeHoy(7), checkOut: diasDesdeHoy(12),
      status: 'reservada', payStatus: 'pagado', method: 'tarjeta',
      notas: 'Reserva corporativa empresa Tecnoglass SA'
    },
    {
      clientIdx: 1, roomNumber: 403, tipo: 'cuadruple', cantidad: 1,
      checkIn:  diasDesdeHoy(10), checkOut: diasDesdeHoy(15),
      status: 'reservada', payStatus: 'pendiente', method: 'efectivo',
      notas: null
    },
    {
      clientIdx: 4, roomNumber: 404, tipo: 'triple', cantidad: 1,
      checkIn:  diasDesdeHoy(14), checkOut: diasDesdeHoy(17),
      status: 'reservada', payStatus: 'pendiente', method: 'efectivo',
      notas: null
    },
    // ── HISTÓRICAS (status: checkout)
    {
      clientIdx: 0, roomNumber: 106, tipo: 'doble', cantidad: 1,
      checkIn:  diasDesdeHoy(-10), checkOut: diasDesdeHoy(-7),
      status: 'checkout', payStatus: 'pagado', method: 'tarjeta',
      notas: null
    },
    {
      clientIdx: 3, roomNumber: 108, tipo: 'triple', cantidad: 1,
      checkIn:  diasDesdeHoy(-14), checkOut: diasDesdeHoy(-10),
      status: 'checkout', payStatus: 'pagado', method: 'efectivo',
      notas: null
    },
    {
      clientIdx: 6, roomNumber: 205, tipo: 'cuadruple', cantidad: 1,
      checkIn:  diasDesdeHoy(-20), checkOut: diasDesdeHoy(-15),
      status: 'checkout', payStatus: 'pagado', method: 'transferencia',
      notas: null
    },
    // ── CANCELADA (para mostrar filtro)
    {
      clientIdx: 2, roomNumber: 306, tipo: 'doble', cantidad: 1,
      checkIn:  diasDesdeHoy(2), checkOut: diasDesdeHoy(5),
      status: 'cancelada', payStatus: 'reembolsado', method: 'tarjeta',
      notas: 'Canceló por enfermedad — reembolso procesado'
    },
  ];

  let creadas2 = 0;
  for (const r of reservasData) {
    const client = clientesDocs[r.clientIdx];
    const room   = roomMap[r.roomNumber];
    if (!client || !room) {
      console.log(`   ⚠️  Falta client[${r.clientIdx}] o room[${r.roomNumber}] — saltando`);
      continue;
    }

    const nights  = Math.max(1, Math.round((r.checkOut - r.checkIn) / 86400000));
    const pricing = calcPricing(room.price, nights);
    const amountPaid = r.payStatus === 'pagado'   ? pricing.total
                     : r.payStatus === 'parcial'  ? Math.round(pricing.total * 0.3)
                     : r.payStatus === 'reembolsado' ? 0
                     : 0;

    // Evitar duplicados en reset=false
    const existe = await Reservation.findOne({
      client:  client._id,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
    });
    if (existe) continue;

    await Reservation.create({
      tipo:     r.tipo,
      cantidad: r.cantidad,
      room:     [room._id],
      client:   client._id,
      user:     adminUser._id,
      checkIn:  r.checkIn,
      checkOut: r.checkOut,
      status:   r.status,
      pricing,
      payment: {
        status:      r.payStatus,
        method:      r.method,
        amountPaid,
        paymentDate: r.payStatus === 'pagado' ? new Date() : undefined,
        notes:       r.notas || undefined,
      },
    });
    creadas2++;
  }
  console.log(`   ✅  ${creadas2} reservas nuevas creadas (${reservasData.length} total)`);

  // ── Resumen ───────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(55));
  console.log('🎉  DEMO LISTO\n');
  console.log('   ACCESO AL SISTEMA:');
  console.log('   Admin:     admin@hoteldemo.com     / Demo1234!');
  console.log('   Recepción: recepcion@hoteldemo.com / Demo1234!');
  console.log('\n   ESTADO DEL DÍA:');

  const checkins   = await Reservation.countDocuments({ status: 'checkin' });
  const futuras    = await Reservation.countDocuments({ status: 'reservada' });
  const checkouts  = await Reservation.countDocuments({ status: 'checkout' });
  const totalRooms = await Room.countDocuments();
  const ocupadas   = await Room.countDocuments({ status: 'ocupada' });
  const clientes   = await Client.countDocuments();

  console.log(`   🛏️  Habitaciones: ${ocupadas}/${totalRooms} ocupadas`);
  console.log(`   📋  En curso:     ${checkins} reservas con check-in activo`);
  console.log(`   📅  Futuras:      ${futuras} reservas próximas`);
  console.log(`   ✅  Históricas:   ${checkouts} checkouts`);
  console.log(`   👥  Clientes:     ${clientes}`);
  console.log('─'.repeat(55) + '\n');

  await mongoose.disconnect();
  process.exit(0);
}

seedDemo().catch(err => {
  console.error('\n❌ Error en seedDemo:', err.message);
  process.exit(1);
});
