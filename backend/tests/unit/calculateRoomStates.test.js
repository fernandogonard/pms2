const { calculateRoomStates } = require('../../services/AvailabilityService');

/**
 * Test básicos para calculateRoomStates
 * 
 * REGLAS PMS (NO INVENTAR OTRAS):
 * 1. checkIn = ocupada (si confirmado) o checkin_pendiente (si no)
 * 2. checkOut = checkout_hoy (nunca ocupada)
 * 3. Entre checkIn y checkOut = ocupada
 * 4. Prioridad: fuera_de_servicio > mantenimiento > limpieza > checkout_hoy > checkin_pendiente > ocupada > disponible
 * 5. Reservas canceladas = ignorar
 * 6. Datos inválidos = disponible (fallback)
 */

describe('calculateRoomStates - Suite Básica', () => {
  describe('✅ Lógica de ocupación correcta', () => {
    it('marca checkIn como checkin_pendiente (no confirmado)', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-12-24',
        checkOut: '2025-12-26',
        status: 'reservada',
        checkinConfirmed: false
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-12-23', 5);
      expect(result[0].states['2025-12-24']).toBe('checkin_pendiente');
    });

    it('marca checkIn como ocupada (si está confirmado)', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-12-24',
        checkOut: '2025-12-26',
        status: 'reservada',
        checkinConfirmed: true
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-12-23', 5);
      expect(result[0].states['2025-12-24']).toBe('ocupada');
    });

    it('marca días intermedios como ocupada', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-12-24',
        checkOut: '2025-12-26',
        status: 'reservada',
        checkinConfirmed: true
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-12-23', 5);
      expect(result[0].states['2025-12-24']).toBe('ocupada');
      expect(result[0].states['2025-12-25']).toBe('ocupada');
    });

    it('marca checkOut como checkout_hoy (NO ocupada)', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-12-24',
        checkOut: '2025-12-26',
        status: 'reservada',
        checkinConfirmed: true,
        checkoutConfirmed: false
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-12-23', 5);
      expect(result[0].states['2025-12-26']).toBe('checkout_hoy');
    });

    it('marca día posterior a checkout como disponible', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-12-24',
        checkOut: '2025-12-26',
        status: 'reservada',
        checkinConfirmed: true
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-12-23', 5);
      expect(result[0].states['2025-12-27']).toBe('disponible');
    });
  });

  describe('✅ Prioridad de estados', () => {
    it('prioriza fuera_de_servicio sobre TODO', () => {
      const rooms = [{
        _id: 'room1',
        status: 'fuera_de_servicio',
        cleaningDates: ['2025-12-24']
      }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-12-24',
        checkOut: '2025-12-26',
        status: 'reservada'
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-12-23', 5);
      expect(result[0].states['2025-12-24']).toBe('fuera_de_servicio');
      expect(result[0].states['2025-12-25']).toBe('fuera_de_servicio');
    });

    it('prioriza mantenimiento sobre limpieza y reservas', () => {
      const rooms = [{
        _id: 'room1',
        maintenanceDates: ['2025-12-25'],
        cleaningDates: ['2025-12-25']
      }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-12-24',
        checkOut: '2025-12-26',
        status: 'reservada'
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-12-23', 5);
      expect(result[0].states['2025-12-25']).toBe('mantenimiento');
    });

    it('prioriza limpieza sobre reservas', () => {
      const rooms = [{
        _id: 'room1',
        cleaningDates: ['2025-12-25']
      }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-12-24',
        checkOut: '2025-12-26',
        status: 'reservada'
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-12-23', 5);
      expect(result[0].states['2025-12-25']).toBe('limpieza');
    });
  });

  describe('✅ Reservas virtuales', () => {
    it('no asigna estados a reservas virtuales (room: null)', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: null,
        checkIn: '2025-12-24',
        checkOut: '2025-12-26',
        status: 'reservada'
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-12-23', 5);
      expect(result[0].states['2025-12-24']).toBe('disponible');
    });

    it('no asigna estados a reservas canceladas', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-12-24',
        checkOut: '2025-12-26',
        status: 'cancelada'
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-12-23', 5);
      expect(result[0].states['2025-12-24']).toBe('disponible');
    });
  });

  describe('✅ Manejo de datos inválidos', () => {
    it('retorna [] si rooms no es array', () => {
      const result = calculateRoomStates(null, [], '2025-12-23', 5);
      expect(result).toEqual([]);
    });

    it('retorna [] si reservations no es array', () => {
      const result = calculateRoomStates([{ _id: 'r1' }], null, '2025-12-23', 5);
      expect(result).toEqual([]);
    });

    it('ignora reserva si checkIn/checkOut missing', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: null,
        checkOut: '2025-12-26',
        status: 'reservada'
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-12-23', 5);
      expect(result[0].states['2025-12-24']).toBe('disponible');
    });

    it('ignora reserva si checkOut <= checkIn', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [{
        _id: 'res1',
        room: 'room1',
        checkIn: '2025-12-26',
        checkOut: '2025-12-24',
        status: 'reservada'
      }];
      const result = calculateRoomStates(rooms, reservations, '2025-12-23', 5);
      expect(result[0].states['2025-12-24']).toBe('disponible');
    });
  });

  describe('✅ Reservas consecutivas', () => {
    it('maneja checkout + nuevo checkin en el mismo día', () => {
      const rooms = [{ _id: 'room1' }];
      const reservations = [
        {
          _id: 'res1',
          room: 'room1',
          checkIn: '2025-12-24',
          checkOut: '2025-12-25',
          status: 'reservada',
          checkinConfirmed: true
        },
        {
          _id: 'res2',
          room: 'room1',
          checkIn: '2025-12-25',
          checkOut: '2025-12-27',
          status: 'reservada',
          checkinConfirmed: false
        }
      ];
      const result = calculateRoomStates(rooms, reservations, '2025-12-23', 5);
      
      // Día 25: checkout_hoy de res1 o checkin_pendiente de res2?
      // Priority: checkout_hoy > checkin_pendiente
      expect(result[0].states['2025-12-25']).toBe('checkout_hoy');
    });
  });
});

