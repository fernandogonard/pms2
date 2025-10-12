const { generarCombinacionesHabitaciones } = require('../controllers/reservationController');

describe('generarCombinacionesHabitaciones', () => {
  test('Genera combinaciones válidas para el número exacto de pasajeros', () => {
    const habitaciones = [
      { id: 1, capacidad: 2 },
      { id: 2, capacidad: 3 },
      { id: 3, capacidad: 4 }
    ];
    const pasajeros = 5;
    const resultado = generarCombinacionesHabitaciones(habitaciones, pasajeros);

    expect(resultado).toEqual([
      [habitaciones[0], habitaciones[1]],
    ]);
  });

  test('Devuelve vacío si no hay combinaciones posibles', () => {
    const habitaciones = [
      { id: 1, capacidad: 2 },
      { id: 2, capacidad: 3 }
    ];
    const pasajeros = 10;
    const resultado = generarCombinacionesHabitaciones(habitaciones, pasajeros);

    expect(resultado).toEqual([]);
  });

  test('Devuelve vacío si no hay habitaciones disponibles', () => {
    const habitaciones = [];
    const pasajeros = 3;
    const resultado = generarCombinacionesHabitaciones(habitaciones, pasajeros);

    expect(resultado).toEqual([]);
  });
});