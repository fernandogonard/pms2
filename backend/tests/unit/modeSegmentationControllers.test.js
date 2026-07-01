// tests/unit/modeSegmentationControllers.test.js
// Regresión de segmentación demo/production y payload WS con mode

jest.mock('../../models/Room');
jest.mock('../../models/Reservation');
jest.mock('../../services/billingService');
jest.mock('../../services/auditService', () => ({ log: jest.fn() }));
jest.mock('../../services/loggerService', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    audit: { dataChange: jest.fn() },
    performance: { requestTime: jest.fn() }
  }
}));
jest.mock('../../config/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    audit: { dataChange: jest.fn() },
    performance: { requestTime: jest.fn() }
  }
}));

const Room = require('../../models/Room');
const Reservation = require('../../models/Reservation');
const BillingService = require('../../services/billingService');

const roomController = require('../../controllers/roomController');
const cleaningController = require('../../controllers/cleaningController');
const billingController = require('../../controllers/billingController');

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    headers: {},
    set(headers) {
      this.headers = { ...this.headers, ...headers };
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.payload = data;
      return this;
    }
  };
}

function createWsHarness() {
  const send = jest.fn();
  return {
    send,
    wss: {
      clients: [{ readyState: 1, send }]
    }
  };
}

describe('Mode segmentation and WS payload contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('billingController WS events include mode', () => {
    test('processPayment emits payment_processed with mode', async () => {
      const { send, wss } = createWsHarness();
      BillingService.processPayment.mockResolvedValue({ payment: { amountPaid: 1000 } });

      const req = {
        params: { id: 'res-1' },
        body: { amount: 1000, method: 'efectivo' },
        headers: { 'x-app-mode': 'demo' },
        user: { id: 'u1', email: 'a@a.com', role: 'admin' },
        ip: '127.0.0.1',
        app: { get: (key) => (key === 'wss' ? wss : undefined) }
      };
      const res = createRes();

      await billingController.processPayment(req, res);

      expect(send).toHaveBeenCalled();
      const payload = JSON.parse(send.mock.calls[0][0]);
      expect(payload.type).toBe('payment_processed');
      expect(payload.mode).toBe('demo');
      expect(res.statusCode).toBe(200);
    });

    test('addCharge emits charge_added with mode', async () => {
      const { send, wss } = createWsHarness();
      BillingService.addCharge.mockResolvedValue({ extras: [{ description: 'Minibar' }] });

      const req = {
        params: { id: 'res-1' },
        body: { description: 'Minibar', amount: 500, category: 'minibar' },
        headers: { 'x-app-mode': 'demo' },
        user: { id: 'u1', email: 'a@a.com', role: 'admin' },
        ip: '127.0.0.1',
        app: { get: (key) => (key === 'wss' ? wss : undefined) }
      };
      const res = createRes();

      await billingController.addCharge(req, res);

      const payload = JSON.parse(send.mock.calls[0][0]);
      expect(payload.type).toBe('charge_added');
      expect(payload.mode).toBe('demo');
      expect(res.statusCode).toBe(200);
    });

    test('deletePayment emits payment_deleted with mode', async () => {
      const { send, wss } = createWsHarness();
      BillingService.deletePayment.mockResolvedValue({ reservation: { _id: 'res-1' } });

      const req = {
        params: { id: 'res-1', paymentIndex: '0' },
        headers: { 'x-app-mode': 'demo' },
        user: { id: 'u1', email: 'a@a.com', role: 'admin' },
        ip: '127.0.0.1',
        app: { get: (key) => (key === 'wss' ? wss : undefined) }
      };
      const res = createRes();

      await billingController.deletePayment(req, res);

      const payload = JSON.parse(send.mock.calls[0][0]);
      expect(payload.type).toBe('payment_deleted');
      expect(payload.mode).toBe('demo');
      expect(res.statusCode).toBe(200);
    });

    test('editPayment emits payment_edited with mode', async () => {
      const { send, wss } = createWsHarness();
      BillingService.editPayment.mockResolvedValue({ reservation: { _id: 'res-1' } });

      const req = {
        params: { id: 'res-1', paymentIndex: '0' },
        body: { amount: 1200 },
        headers: { 'x-app-mode': 'demo' },
        user: { id: 'u1', email: 'a@a.com', role: 'admin' },
        ip: '127.0.0.1',
        app: { get: (key) => (key === 'wss' ? wss : undefined) }
      };
      const res = createRes();

      await billingController.editPayment(req, res);

      const payload = JSON.parse(send.mock.calls[0][0]);
      expect(payload.type).toBe('payment_edited');
      expect(payload.mode).toBe('demo');
      expect(res.statusCode).toBe(200);
    });
  });

  describe('mode-aware query filters in controllers', () => {
    test('roomController.getAvailableRooms queries Room and Reservation with demo mode', async () => {
      Room.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([])
        })
      });
      Reservation.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([])
        })
      });

      const req = {
        query: {
          type: 'doble',
          checkIn: '2026-07-01',
          checkOut: '2026-07-02',
          cantidad: '1',
          mode: 'demo'
        },
        headers: {}
      };
      const res = createRes();

      await roomController.getAvailableRooms(req, res);

      expect(Room.find).toHaveBeenCalledWith(expect.objectContaining({ type: 'doble', mode: 'demo' }));
      expect(Reservation.find).toHaveBeenCalledWith(expect.objectContaining({ mode: 'demo' }));
      expect([200, 409]).toContain(res.statusCode);
    });

    test('cleaningController.getRoomsInCleaning queries Room with mode filter', async () => {
      const sort = jest.fn().mockResolvedValue([]);
      Room.find.mockReturnValue({ sort });

      const req = {
        headers: { 'x-app-mode': 'demo' }
      };
      const res = createRes();

      await cleaningController.getRoomsInCleaning(req, res);

      expect(Room.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'limpieza', mode: 'demo' }));
      expect(sort).toHaveBeenCalledWith({ number: 1 });
      expect(res.statusCode).toBe(200);
    });
  });
});
