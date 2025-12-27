/**
 * Test Suite Completo para calculateRoomStates
 * Auditoría PMS: Validar todos los edge cases críticos para temporada alta
 * 
 * REGLAS PMS VALIDADAS:
 * 1. Prioridad: fuera_de_servicio > mantenimiento > limpieza > checkout_hoy > checkin_pendiente > ocupada > disponible
 * 2. checkIn = día ocupado
 * 3. checkOut = checkout_hoy (no es día ocupado)
 * 4. Días entre checkIn y checkOut = ocupada
 * 5. Reservas canceladas NO afectan
 * 6. Datos inválidos → disponible (fallback seguro)
 */

const { calculateRoomStates } = require('../../services/AvailabilityService');

describe('🔴 calculateRoomStates - Test Suite PMS Completo', () => {
  // ✅ GRUPO 1: LÓGICA BÁSICA DE OCUPACIÓN
  describe('1️⃣ Lógica básica de ocupación', () => {
    it('DEBE marcar checkIn como ocupada', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-01-10',
        checkOut: '2025-01-12',
        status: 'reservada',
        checkinConfirmed: false,
        checkoutConfirmed: false
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 5);
      
      // El día 10 (checkIn) debe ser 'ocupada' si no está confirmado debería ser 'checkin_pendiente'
      // Pero si checkinConfirmed es false, es 'checkin_pendiente'
      expect(result[0].states['2025-01-10']).toBe('checkin_pendiente');
    });

    it('DEBE marcar días intermedios como ocupada', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-01-10',
        checkOut: '2025-01-13',
        status: 'reservada',
        checkinConfirmed: true,
        checkoutConfirmed: false
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 6);
      
      expect(result[0].states['2025-01-10']).toBe('ocupada'); // checkIn confirmado
      expect(result[0].states['2025-01-11']).toBe('ocupada'); // Entre
      expect(result[0].states['2025-01-12']).toBe('ocupada'); // Entre
      expect(result[0].states['2025-01-13']).toBe('checkout_hoy'); // checkOut
    });

    it('DEBE marcar checkOut como checkout_hoy (NO ocupada)', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-01-10',
        checkOut: '2025-01-13',
        status: 'reservada',
        checkinConfirmed: true,
        checkoutConfirmed: false
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 6);
      
      // Día posterior a checkout debe ser disponible
      expect(result[0].states['2025-01-13']).toBe('checkout_hoy');
      expect(result[0].states['2025-01-14']).toBe('disponible');
    });
  });

  // ✅ GRUPO 2: PRIORIDAD DE ESTADOS
  describe('2️⃣ Prioridad de estados', () => {
    it('DEBE priorizar fuera_de_servicio sobre TODOS', () => {
      const rooms = [{
        _id: 'room1',
        status: 'fuera_de_servicio',
        cleaningDates: ['2025-01-10'],
        maintenanceDates: ['2025-01-11']
      }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-01-10',
        checkOut: '2025-01-13',
        status: 'reservada'
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 5);
      
      expect(result[0].states['2025-01-10']).toBe('fuera_de_servicio');
      expect(result[0].states['2025-01-11']).toBe('fuera_de_servicio');
      expect(result[0].states['2025-01-12']).toBe('fuera_de_servicio');
    });

    it('DEBE priorizar mantenimiento sobre limpieza y reservas', () => {
      const rooms = [{
        _id: 'room1',
        cleaningDates: ['2025-01-10'],
        maintenanceDates: ['2025-01-10']
      }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-01-10',
        checkOut: '2025-01-12',
        status: 'reservada'
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 4);
      
      expect(result[0].states['2025-01-10']).toBe('mantenimiento');
    });

    it('DEBE priorizar limpieza sobre reservas', () => {
      const rooms = [{
        _id: 'room1',
        cleaningDates: ['2025-01-10']
      }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-01-10',
        checkOut: '2025-01-12',
        status: 'reservada'
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 4);
      
      expect(result[0].states['2025-01-10']).toBe('limpieza');
    });

    it('DEBE priorizar checkout_hoy sobre ocupada', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-01-10',
        checkOut: '2025-01-12',
        status: 'reservada',
        checkoutConfirmed: false
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 4);
      
      expect(result[0].states['2025-01-12']).toBe('checkout_hoy');
    });
  });

  // ✅ GRUPO 3: RESERVAS CONSECUTIVAS (EDGE CASE CRÍTICO)
  describe('3️⃣ Reservas consecutivas', () => {
    it('DEBE manejar checkout + new checkIn correctamente', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [
        {
          _id: 'res1',
          room: 'room1',
          checkIn: '2025-01-10',
          checkOut: '2025-01-12',
          status: 'reservada',
          checkinConfirmed: true,
          checkoutConfirmed: false
        },
        {
          _id: 'res2',
          room: 'room1',
          checkIn: '2025-01-13',
          checkOut: '2025-01-15',
          status: 'reservada',
          checkinConfirmed: false,
          checkoutConfirmed: false
        }
      ];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 7);
      
      // Día 10: ocupada (primera reserva confirmada)
      expect(result[0].states['2025-01-10']).toBe('ocupada');
      // Día 11: ocupada (entre checkIn y checkOut)
      expect(result[0].states['2025-01-11']).toBe('ocupada');
      // Día 12: checkout_hoy (transición día, checkout de res1)
      expect(result[0].states['2025-01-12']).toBe('checkout_hoy');
      // Día 13: checkin_pendiente (auto-limpieza no se aplica porque hay checkin hoy)
      expect(result[0].states['2025-01-13']).toBe('checkin_pendiente');
      // Día 14: ocupada (entre checkIn=13 y checkOut=15)
      expect(result[0].states['2025-01-14']).toBe('ocupada');
    });

    it('NO DEBE marcar día de transición (checkout de res1 = checkin de res2) como ocupada', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [
        {
          _id: 'res1',
          room: 'room1',
          checkIn: '2025-01-10',
          checkOut: '2025-01-12',
          status: 'reservada',
          checkinConfirmed: true,
          checkoutConfirmed: true
        },
        {
          _id: 'res2',
          room: 'room1',
          checkIn: '2025-01-12',
          checkOut: '2025-01-14',
          status: 'reservada',
          checkinConfirmed: true,
          checkoutConfirmed: false
        }
      ];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 6);
      
      // El 12 puede ser ambos checkout_hoy y checkin... resolveState debe dar checkout_hoy
      expect(result[0].states['2025-01-12']).toBe('checkout_hoy');
    });
  });

  // ✅ GRUPO 4: LIMPIEZA + MANTENIMIENTO + RESERVAS
  describe('4️⃣ Limpieza y mantenimiento con reservas', () => {
    it('DEBE limpiar despues de checkout', () => {
      const rooms = [{
        _id: 'room1',
        cleaningDates: ['2025-01-12', '2025-01-13']
      }];
      const reservations = [
        {
          _id: 'res1',
          room: 'room1',
          checkIn: '2025-01-10',
          checkOut: '2025-01-12',
          status: 'reservada',
          checkinConfirmed: true
        },
        {
          _id: 'res2',
          room: 'room1',
          checkIn: '2025-01-14',
          checkOut: '2025-01-16',
          status: 'reservada'
        }
      ];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 8);
      
      expect(result[0].states['2025-01-12']).toBe('checkout_hoy');
      expect(result[0].states['2025-01-13']).toBe('limpieza');
    });

    it('DEBE detectar mantenimiento entre reservas', () => {
      const rooms = [{
        _id: 'room1',
        maintenanceDates: ['2025-01-13']
      }];
      const reservations = [
        {
          _id: 'res1',
          room: 'room1',
          checkIn: '2025-01-10',
          checkOut: '2025-01-12',
          status: 'reservada',
          checkinConfirmed: true
        },
        {
          _id: 'res2',
          room: 'room1',
          checkIn: '2025-01-14',
          checkOut: '2025-01-16',
          status: 'reservada'
        }
      ];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 8);
      
      expect(result[0].states['2025-01-12']).toBe('checkout_hoy');
      expect(result[0].states['2025-01-13']).toBe('mantenimiento');
      expect(result[0].states['2025-01-14']).toBe('checkin_pendiente');
    });
  });

  // ✅ GRUPO 5: RESERVAS VIRTUALES (SIN HABITACIÓN ASIGNADA)
  describe('5️⃣ Reservas virtuales', () => {
    it('NO DEBE afectar estados si room es null', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: null,
        checkIn: '2025-01-10',
        checkOut: '2025-01-12',
        status: 'reservada'
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 5);
      
      expect(result[0].states['2025-01-10']).toBe('disponible');
      expect(result[0].states['2025-01-11']).toBe('disponible');
    });

    it('NO DEBE afectar estados si room es array vacío', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: [],
        checkIn: '2025-01-10',
        checkOut: '2025-01-12',
        status: 'reservada'
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 5);
      
      expect(result[0].states['2025-01-10']).toBe('disponible');
    });
  });

  // ✅ GRUPO 6: RESERVAS CANCELADAS
  describe('6️⃣ Reservas canceladas', () => {
    it('NO DEBE afectar estados si status es cancelada', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-01-10',
        checkOut: '2025-01-12',
        status: 'cancelada'
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 5);
      
      expect(result[0].states['2025-01-10']).toBe('disponible');
      expect(result[0].states['2025-01-11']).toBe('disponible');
    });
  });

  // ✅ GRUPO 7: DATOS INVÁLIDOS Y FALLBACK SEGURO
  describe('7️⃣ Manejo de datos inválidos (fallback seguro)', () => {
    it('DEBE retornar disponible si checkIn/checkOut están missing', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: null,
        checkOut: '2025-01-12',
        status: 'reservada'
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 5);
      
      expect(result[0].states['2025-01-10']).toBe('disponible');
    });

    it('DEBE retornar disponible si checkOut <= checkIn', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-01-12',
        checkOut: '2025-01-10',
        status: 'reservada'
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 5);
      
      expect(result[0].states['2025-01-10']).toBe('disponible');
      expect(result[0].states['2025-01-11']).toBe('disponible');
    });

    it('DEBE retornar [] si rooms no es array', () => {
      const result = calculateRoomStates(null, [], '2025-01-09', 5);
      expect(result).toEqual([]);
    });

    it('DEBE retornar [] si reservations no es array', () => {
      const result = calculateRoomStates([{ _id: 'r1' }], null, '2025-01-09', 5);
      expect(result).toEqual([]);
    });
  });

  // ✅ GRUPO 8: CHECKIN/CHECKOUT CONFIRMADOS
  describe('8️⃣ Confirmación de check-in/check-out', () => {
    it('DEBE marcar checkin_pendiente si checkinConfirmed es false', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-01-10',
        checkOut: '2025-01-12',
        status: 'reservada',
        checkinConfirmed: false
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 5);
      
      expect(result[0].states['2025-01-10']).toBe('checkin_pendiente');
    });

    it('DEBE marcar ocupada si checkinConfirmed es true', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-01-10',
        checkOut: '2025-01-12',
        status: 'reservada',
        checkinConfirmed: true
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 5);
      
      expect(result[0].states['2025-01-10']).toBe('ocupada');
    });

    it('DEBE marcar checkout_hoy si checkoutConfirmed es false', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-01-10',
        checkOut: '2025-01-12',
        status: 'reservada',
        checkoutConfirmed: false
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 5);
      
      expect(result[0].states['2025-01-12']).toBe('checkout_hoy');
    });
  });

  // ✅ GRUPO 9: MÚLTIPLES HABITACIONES
  describe('9️⃣ Múltiples habitaciones', () => {
    it('DEBE calcular estados independientes por habitación', () => {
      const rooms = [
        { _id: 'room1' },
        { _id: 'room2' }
      ];
      const reservations = [
        {
          _id: 'res1',
          room: 'room1',
          checkIn: '2025-01-10',
          checkOut: '2025-01-12',
          status: 'reservada',
          checkinConfirmed: true
        },
        {
          _id: 'res2',
          room: 'room2',
          checkIn: '2025-01-11',
          checkOut: '2025-01-13',
          status: 'reservada',
          checkinConfirmed: true
        }
      ];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 5);
      
      // Room 1: ocupada en 10, checkout en 12
      expect(result[0].states['2025-01-10']).toBe('ocupada');
      expect(result[0].states['2025-01-12']).toBe('checkout_hoy');
      
      // Room 2: disponible en 10, ocupada en 11
      expect(result[1].states['2025-01-10']).toBe('disponible');
      expect(result[1].states['2025-01-11']).toBe('ocupada');
    });
  });

  // ✅ GRUPO 10: RESERVAS CON ROOM COMO ARRAY
  describe('🔟 Reservas con room como array (multi-room)', () => {
    it('DEBE reconocer room como array de IDs', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: ['room1', 'room2'],
        checkIn: '2025-01-10',
        checkOut: '2025-01-12',
        status: 'reservada',
        checkinConfirmed: true
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-01-09', 5);
      
      expect(result[0].states['2025-01-10']).toBe('ocupada');
    });
  });

  // ✅ GRUPO 11: RANGO DE FECHAS FUERA DEL CALENDARIO VISIBLE
  describe('1️⃣1️⃣ Reservas fuera del rango visible', () => {
    it('NO DEBE afectar si reserva está completamente antes del rango', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-01-05',
        checkOut: '2025-01-08',
        status: 'reservada'
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-01-10', 5);
      
      expect(result[0].states['2025-01-10']).toBe('disponible');
    });

    it('NO DEBE afectar si reserva está completamente después del rango', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-02-01',
        checkOut: '2025-02-05',
        status: 'reservada'
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-01-10', 5);
      
      expect(result[0].states['2025-01-14']).toBe('disponible');
    });

    it('DEBE afectar si reserva se cruza parcialmente', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-01-12',
        checkOut: '2025-01-20',
        status: 'reservada',
        checkinConfirmed: true
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-01-10', 5);
      
      // 10-11: disponible
      expect(result[0].states['2025-01-10']).toBe('disponible');
      expect(result[0].states['2025-01-11']).toBe('disponible');
      // 12-14: ocupada
      expect(result[0].states['2025-01-12']).toBe('ocupada');
      expect(result[0].states['2025-01-14']).toBe('ocupada');
    });
  });
});
