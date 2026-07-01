jest.mock('../../models/Room', () => ({
  find: jest.fn()
}));

jest.mock('../../models/Reservation', () => ({
  find: jest.fn()
}));

const Room = require('../../models/Room');
const Reservation = require('../../models/Reservation');
const availabilityEngine = require('../../services/availabilityEngine');

function mockRoomFindResult(rooms) {
  const lean = jest.fn().mockResolvedValue(rooms);
  const sort = jest.fn().mockReturnValue({ lean });
  Room.find.mockReturnValue({ sort });
}

function mockReservationFindResult(reservations) {
  const chain = {
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(reservations)
  };
  Reservation.find.mockReturnValue(chain);
}

describe('availabilityEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    availabilityEngine.invalidateCache();
  });

  test('multi-day occupancy: checkin, ocupada intermedia y checkout_hoy', async () => {
    mockRoomFindResult([
      { _id: 'room-101', number: 101, type: 'doble', status: 'disponible', mode: 'production' }
    ]);

    mockReservationFindResult([
      {
        _id: 'res-1',
        room: ['room-101'],
        status: 'checkin',
        checkIn: '2026-07-10T18:00:00.000Z',
        checkOut: '2026-07-15T13:00:00.000Z',
        mode: 'production',
        client: { nombre: 'QA', apellido: 'Guest' }
      }
    ]);

    const result = await availabilityEngine.getRoomStatus('2026-07-10', 6, { mode: 'production' });
    const byDate = Object.fromEntries(result[0].dates.map((d) => [d.date, d.status]));

    expect(byDate['2026-07-10']).toBe('checkin');
    expect(byDate['2026-07-11']).toBe('ocupada');
    expect(byDate['2026-07-12']).toBe('ocupada');
    expect(byDate['2026-07-13']).toBe('ocupada');
    expect(byDate['2026-07-14']).toBe('ocupada');
    expect(byDate['2026-07-15']).toBe('checkout_hoy');
  });

  test('room change: 101 disponible y 205 ocupada', async () => {
    mockRoomFindResult([
      { _id: 'room-101', number: 101, type: 'doble', status: 'disponible', mode: 'production' },
      { _id: 'room-205', number: 205, type: 'doble', status: 'disponible', mode: 'production' }
    ]);

    mockReservationFindResult([
      {
        _id: 'res-2',
        room: ['room-205'],
        status: 'checkin',
        checkIn: '2026-07-10T18:00:00.000Z',
        checkOut: '2026-07-15T13:00:00.000Z',
        mode: 'production',
        client: { nombre: 'Room', apellido: 'Change' }
      }
    ]);

    const result = await availabilityEngine.getRoomStatus('2026-07-12', 1, { mode: 'production' });
    const byRoom = Object.fromEntries(result.map((r) => [r.roomNumber, r.dates[0].status]));

    expect(byRoom[101]).toBe('disponible');
    expect(byRoom[205]).toBe('ocupada');
  });
});
