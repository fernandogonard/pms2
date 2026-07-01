const { resolveRoomStatus } = require('../../services/roomStatusResolutionService');

describe('roomStatusResolutionService', () => {
  it('prioriza mantenimiento sobre reserva activa', () => {
    const room = {
      _id: 'room-1',
      number: 101,
      status: 'mantenimiento',
      currentMaintenance: {
        reason: 'Prueba',
        startDate: '2026-06-15T00:00:00.000Z',
        estimatedEndDate: '2026-06-16T00:00:00.000Z'
      }
    };

    const reservations = [
      {
        _id: 'res-1',
        room: ['room-1'],
        status: 'checkin',
        checkIn: '2026-06-15T10:00:00.000Z',
        checkOut: '2026-06-16T10:00:00.000Z',
        client: { nombre: 'Juan', apellido: 'Perez', email: 'juan@test.com' }
      }
    ];

    const result = resolveRoomStatus(room, reservations, '2026-06-15T00:00:00.000Z');

    expect(result.status).toBe('mantenimiento');
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it('marca conflicto por overbooking en la misma habitacion', () => {
    const room = {
      _id: 'room-2',
      number: 102,
      status: 'disponible'
    };

    const reservations = [
      {
        _id: 'res-a',
        room: ['room-2'],
        status: 'reservada',
        checkIn: '2026-06-15T12:00:00.000Z',
        checkOut: '2026-06-16T10:00:00.000Z',
        client: { nombre: 'A', apellido: 'A' }
      },
      {
        _id: 'res-b',
        room: ['room-2'],
        status: 'reservada',
        checkIn: '2026-06-15T14:00:00.000Z',
        checkOut: '2026-06-16T10:00:00.000Z',
        client: { nombre: 'B', apellido: 'B' }
      }
    ];

    const result = resolveRoomStatus(room, reservations, '2026-06-15T00:00:00.000Z');

    expect(result.status).toBe('conflicto');
    expect(result.conflicts.some((c) => c.code === 'OVERBOOKING_SAME_ROOM')).toBe(true);
  });

  it('incluye housekeepingState en tooltip y prioridad', () => {
    const room = {
      _id: 'room-3',
      number: 103,
      status: 'disponible',
      housekeepingState: 'DND'
    };

    const result = resolveRoomStatus(room, [], '2026-06-15T00:00:00.000Z');

    expect(result.tooltip.housekeepingStatus).toBe('DND');
    expect(result.status).toBe('dnd');
  });
});
